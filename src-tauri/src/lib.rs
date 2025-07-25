#[cfg(target_os = "macos")]
use dirs;
use once_cell::sync::Lazy;
use reqwest;
use serde_json;
use std::collections::HashMap;
use std::fs::{self};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};
use tokio::time;
pub mod mods;
use mods::models::*;
use mods::state::*;
use mods::utils::*;

static HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .expect("Failed to create HTTP client")
});

pub async fn upload_manifest_internal(game: &GameInfo) -> Result<UploadStatus, String> {
    let manifests_path = get_manifests_path();
    let item_path = manifests_path.join(format!("{}.item", game.installation_guid));
    let manifest_path = std::path::PathBuf::from(format!(
        "{}/.egstore/{}.manifest",
        game.install_location.replace("\\", "/"),
        game.installation_guid
    ));

    // Read files first to get manifest hash from .item file
    let item_bytes =
        fs::read(&item_path).map_err(|e| format!("Failed to read .item file: {}", e))?;
    let manifest_bytes =
        fs::read(&manifest_path).map_err(|e| format!("Failed to read .manifest file: {}", e))?;

    // Parse .item file to get ManifestHash
    let item_json: serde_json::Value = serde_json::from_slice(&item_bytes)
        .map_err(|e| format!("Failed to parse .item file: {}", e))?;
    let manifest_hash = item_json["ManifestHash"]
        .as_str()
        .ok_or("ManifestHash not found in .item file")?;

    // Prepare multipart form
    let manifest_filename = format!("{}.manifest", game.installation_guid);
    let os_field = if cfg!(target_os = "macos") {
        "Mac"
    } else {
        "Windows"
    };
    let form = reqwest::multipart::Form::new()
        .text("item", item_json.to_string())
        .text("os", os_field)
        .part(
            "manifest",
            reqwest::multipart::Part::bytes(manifest_bytes).file_name(manifest_filename),
        );

    // Send request
    let client = reqwest::Client::new();
    let resp = client
        .post("https://egdata-builds-api.snpm.workers.dev/upload-manifest")
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Failed to send upload request: {}", e))?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();

    if status.is_success() {
        Ok(UploadStatus {
            status: "uploaded".to_string(),
            message: Some(text),
            manifest_hash: Some(manifest_hash.to_string()),
        })
    } else {
        // Check if the error is about identical content already existing
        if text.contains("A manifest file with identical content already exists") {
            return Ok(UploadStatus {
                status: "already_uploaded".to_string(),
                message: Some("Manifest with identical content already exists".to_string()),
                manifest_hash: Some(manifest_hash.to_string()),
            });
        }

        Ok(UploadStatus {
            status: "failed".to_string(),
            message: Some(text),
            manifest_hash: Some(manifest_hash.to_string()),
        })
    }
}

async fn fetch_game_metadata(catalog_item_id: &str, cache: &MetadataCache) -> Option<GameMetadata> {
    // Check cache first
    {
        let cache_lock = cache.lock().ok()?;
        if let Some(cached_metadata) = cache_lock.get(catalog_item_id) {
            return Some(cached_metadata.clone());
        }
    }

    // Fetch from API
    let url = format!("https://api.egdata.app/items/{}", catalog_item_id);

    match HTTP_CLIENT.get(&url).send().await {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<GameMetadata>().await {
                    Ok(metadata) => {
                        // Cache the result
                        if let Ok(mut cache_lock) = cache.lock() {
                            cache_lock.insert(catalog_item_id.to_string(), metadata.clone());
                        }
                        Some(metadata)
                    }
                    Err(e) => {
                        eprintln!("Failed to parse metadata for {}: {}", catalog_item_id, e);
                        None
                    }
                }
            } else {
                eprintln!(
                    "API request failed for {}: {}",
                    catalog_item_id,
                    response.status()
                );
                None
            }
        }
        Err(e) => {
            eprintln!("Failed to fetch metadata for {}: {}", catalog_item_id, e);
            None
        }
    }
}

fn get_manifests_path() -> std::path::PathBuf {
    #[cfg(target_os = "windows")]
    {
        std::path::PathBuf::from(r"C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests")
    }
    #[cfg(target_os = "macos")]
    {
        let mut path = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("~"));
        path.push("Library/Application Support/Epic/EpicGamesLauncher/Data/Manifests");
        path
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        std::path::PathBuf::from("") // Unsupported
    }
}

pub async fn scan_epic_games_with_metadata(
    metadata_cache: &MetadataCache,
) -> Result<Vec<GameInfo>, String> {
    let manifests_path = get_manifests_path();
    if !manifests_path.exists() {
        return Err("Epic Games manifests directory not found".to_string());
    }
    let mut games = Vec::new();
    let entries = fs::read_dir(manifests_path)
        .map_err(|e| format!("Failed to read manifests directory: {}", e))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("item") {
            match parse_manifest_file_with_metadata(&path, metadata_cache).await {
                Ok(game_info) => games.push(game_info),
                Err(e) => {
                    eprintln!("Failed to parse manifest file {:?}: {}", path, e);
                    // Continue processing other files
                }
            }
        }
    }
    Ok(games)
}

async fn parse_manifest_file_with_metadata(
    path: &Path,
    metadata_cache: &MetadataCache,
) -> Result<GameInfo, String> {
    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))?;

    let manifest: EpicGameManifest =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let metadata = fetch_game_metadata(&manifest.catalog_item_id, metadata_cache).await;

    Ok(GameInfo {
        display_name: manifest.display_name,
        app_name: manifest.app_name,
        install_location: manifest.install_location,
        install_size: manifest.install_size,
        version: manifest.app_version_string,
        catalog_namespace: manifest.catalog_namespace,
        catalog_item_id: manifest.catalog_item_id,
        installation_guid: manifest.installation_guid,
        manifest_hash: manifest.manifest_hash,
        metadata,
    })
}

async fn periodic_upload(app_handle: AppHandle, games: GameStore, settings: SettingsState) {
    let mut current_interval_minutes = {
        let settings_lock = settings.lock().unwrap();
        settings_lock.upload_interval
    };

    let mut interval = time::interval(Duration::from_secs(current_interval_minutes * 60));

    loop {
        interval.tick().await;

        // Check if interval has changed
        let new_interval_minutes = {
            let settings_lock = settings.lock().unwrap();
            settings_lock.upload_interval
        };

        if new_interval_minutes != current_interval_minutes {
            current_interval_minutes = new_interval_minutes;
            interval = time::interval(Duration::from_secs(current_interval_minutes * 60));
            emit_log(
                &app_handle,
                "INFO",
                &format!(
                    "Upload interval updated to {} minutes",
                    current_interval_minutes
                ),
            );
        }

        emit_log(&app_handle, "INFO", "Starting periodic manifest upload...");

        match upload_all_manifests_internal(&games).await {
            Ok(results) => {
                let uploaded_count = results.iter().filter(|r| r.status == "uploaded").count();
                let already_uploaded_count = results
                    .iter()
                    .filter(|r| r.status == "already_uploaded")
                    .count();
                let failed_count = results.iter().filter(|r| r.status == "failed").count();

                emit_log(
                    &app_handle,
                    "SUCCESS",
                    &format!(
                        "Periodic upload completed: {} uploaded, {} already uploaded, {} failed",
                        uploaded_count, already_uploaded_count, failed_count
                    ),
                );

                // Emit event to frontend
                let _ = app_handle.emit("periodic-upload-completed", &results);
            }
            Err(e) => {
                emit_log(
                    &app_handle,
                    "ERROR",
                    &format!("Periodic upload failed: {}", e),
                );
            }
        }
    }
}

async fn upload_all_manifests_internal(games: &GameStore) -> Result<Vec<UploadStatus>, String> {
    let games_to_upload = {
        let games_lock = games
            .lock()
            .map_err(|e| format!("Failed to lock games: {}", e))?;
        games_lock.values().cloned().collect::<Vec<_>>()
    };

    let mut results = Vec::new();

    for game in games_to_upload {
        match upload_manifest_internal(&game).await {
            Ok(status) => results.push(status),
            Err(e) => results.push(UploadStatus {
                status: "failed".to_string(),
                message: Some(e),
                manifest_hash: None,
            }),
        }
    }

    Ok(results)
}

async fn periodic_scan(
    app_handle: AppHandle,
    games: GameStore,
    metadata_cache: MetadataCache,
    settings: SettingsState,
) {
    let mut current_interval_minutes = {
        let settings_lock = settings.lock().unwrap();
        settings_lock.scan_interval_minutes
    };

    let mut interval = time::interval(Duration::from_secs(current_interval_minutes * 60));

    loop {
        interval.tick().await;

        // Check if interval has changed
        let new_interval_minutes = {
            let settings_lock = settings.lock().unwrap();
            settings_lock.scan_interval_minutes
        };

        if new_interval_minutes != current_interval_minutes {
            current_interval_minutes = new_interval_minutes;
            interval = time::interval(Duration::from_secs(current_interval_minutes * 60));
            emit_log(
                &app_handle,
                "INFO",
                &format!(
                    "Scan interval updated to {} minutes",
                    current_interval_minutes
                ),
            );
        }

        match scan_epic_games_with_metadata(&metadata_cache).await {
            Ok(scanned_games) => {
                let mut games_lock = match games.lock() {
                    Ok(lock) => lock,
                    Err(e) => {
                        eprintln!("Failed to lock games during periodic scan: {}", e);
                        continue;
                    }
                };

                let old_count = games_lock.len();
                games_lock.clear();

                for game in &scanned_games {
                    games_lock.insert(game.app_name.clone(), game.clone());
                }

                let new_count = games_lock.len();
                drop(games_lock);

                // Emit event to frontend if game count changed
                if old_count != new_count {
                    emit_log(
                        &app_handle,
                        "INFO",
                        &format!(
                            "Games updated from background scan. Found {} games.",
                            new_count
                        ),
                    );
                    let _ = app_handle.emit("games-updated", &scanned_games);
                } else {
                    emit_log(
                        &app_handle,
                        "INFO",
                        &format!(
                            "Background scan completed. {} games found (no changes).",
                            new_count
                        ),
                    );
                }
            }
            Err(e) => {
                eprintln!("Periodic scan failed: {}", e);
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let games: GameStore = Arc::new(Mutex::new(HashMap::new()));
    let metadata_cache: MetadataCache = Arc::new(Mutex::new(HashMap::new()));
    let settings: SettingsState = Arc::new(Mutex::new(load_settings_from_file()));

    // Setup auto-start
    let _ = setup_auto_start();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // When a second instance is launched, show the existing window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(games.clone())
        .manage(metadata_cache.clone())
        .manage(settings.clone())
        // Removed uploaded_manifests management - API handles duplicates
        .invoke_handler(tauri::generate_handler![
            mods::commands::show_window,
            mods::commands::hide_window,
            mods::commands::minimize_window,
            mods::commands::get_installed_games,
            mods::commands::scan_games_now,
            mods::commands::get_settings,
            mods::commands::set_settings,
            mods::commands::upload_manifest,
            mods::commands::upload_all_manifests,
            mods::commands::open_directory,
        ])
        .setup(move |app| {
            let app_handle = app.handle().clone();

            // Create tray menu
            let show_item = MenuItemBuilder::new("Show").id("show").build(app)?;
            let hide_item = MenuItemBuilder::new("Hide").id("hide").build(app)?;
            let quit_item = MenuItemBuilder::new("Quit").id("quit").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&hide_item)
                .separator()
                .item(&quit_item)
                .build()?;

            // Create tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("EGData Client")
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } => {
                        let app_handle = tray.app_handle();
                        if let Some(window) = app_handle.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            // Ensure the main window starts hidden
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
            }

            // Handle window events
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    match event {
                        WindowEvent::CloseRequested { api, .. } => {
                            // Prevent the window from closing and hide it instead
                            api.prevent_close();
                            let _ = window_clone.hide();
                        }
                        _ => {}
                    }
                });
            }

            let app_handle_for_periodic = app_handle.clone();
            let games_for_periodic = games.clone();
            let metadata_cache_for_periodic = metadata_cache.clone();
            let settings_for_periodic = settings.clone();

            // Perform initial scan
            let games_for_initial = games.clone();
            let metadata_cache_for_initial = metadata_cache.clone();
            tauri::async_runtime::spawn(async move {
                match scan_epic_games_with_metadata(&metadata_cache_for_initial).await {
                    Ok(scanned_games) => {
                        let mut games_lock = match games_for_initial.lock() {
                            Ok(lock) => lock,
                            Err(e) => {
                                eprintln!("Failed to lock games during initial scan: {}", e);
                                return;
                            }
                        };

                        for game in &scanned_games {
                            games_lock.insert(game.app_name.clone(), game.clone());
                        }

                        println!(
                            "Initial scan completed. Found {} games.",
                            scanned_games.len()
                        );

                        // Emit initial games to frontend
                        let _ = app_handle.emit("games-updated", &scanned_games);
                    }
                    Err(e) => {
                        eprintln!("Initial scan failed: {}", e);
                    }
                }
            });

            // Start periodic scanning
            tauri::async_runtime::spawn(periodic_scan(
                app_handle_for_periodic.clone(),
                games_for_periodic.clone(),
                metadata_cache_for_periodic,
                settings_for_periodic.clone(),
            ));

            // Start periodic upload
            tauri::async_runtime::spawn(periodic_upload(
                app_handle_for_periodic,
                games_for_periodic,
                settings_for_periodic,
            ));

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
