use super::models::{GameInfo, Settings, UploadStatus};
use super::state::{GameStore, MetadataCache, SettingsState};
use super::utils::save_settings_to_file;
use crate::mods::utils::emit_log;
use crate::scan_epic_games_with_metadata; // This needs to be public in lib.rs
use crate::upload_manifest_internal; // This needs to be public in lib.rs
use tauri::{AppHandle, Manager, State};

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
pub fn show_window(app_handle: AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
pub fn hide_window(app_handle: AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[tauri::command]
pub fn minimize_window(app_handle: AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.minimize();
    }
}

#[tauri::command]
pub fn get_installed_games(games: State<GameStore>) -> Result<Vec<GameInfo>, String> {
    let games_lock = games
        .lock()
        .map_err(|e| format!("Failed to lock games: {}", e))?;
    Ok(games_lock.values().cloned().collect())
}

#[tauri::command]
pub async fn scan_games_now(
    app_handle: AppHandle,
    games: State<'_, GameStore>,
    metadata_cache: State<'_, MetadataCache>,
) -> Result<Vec<GameInfo>, String> {
    emit_log(&app_handle, "INFO", "Starting scan for Epic Games...");

    let scanned_games = scan_epic_games_with_metadata(&*metadata_cache).await?;

    let mut games_lock = games
        .lock()
        .map_err(|e| format!("Failed to lock games: {}", e))?;
    games_lock.clear();

    for game in &scanned_games {
        games_lock.insert(game.app_name.clone(), game.clone());
    }

    emit_log(
        &app_handle,
        "SUCCESS",
        &format!(
            "Found {} Epic Games installed on your system.",
            scanned_games.len()
        ),
    );

    for game in &scanned_games {
        emit_log(
            &app_handle,
            "INFO",
            &format!(
                "Found game \"{}\" ({}) at {}",
                game.display_name, game.catalog_item_id, game.install_location
            ),
        );
    }

    Ok(scanned_games)
}

#[tauri::command]
pub fn get_settings(settings: State<SettingsState>) -> Result<Settings, String> {
    let settings_lock = settings
        .lock()
        .map_err(|e| format!("Failed to lock settings: {}", e))?;
    Ok(settings_lock.clone())
}

#[tauri::command]
pub fn set_settings(
    app_handle: AppHandle,
    settings: State<SettingsState>,
    new_settings: Settings,
) -> Result<(), String> {
    emit_log(&app_handle, "INFO", "Updating settings...");
    let mut settings_lock = settings
        .lock()
        .map_err(|e| format!("Failed to lock settings: {}", e))?;
    *settings_lock = new_settings.clone();
    save_settings_to_file(&new_settings);
    Ok(())
}

#[tauri::command]
pub async fn upload_manifest(
    app_handle: AppHandle,
    game_id: String,
    installation_guid: String,
    games: State<'_, GameStore>,
) -> Result<UploadStatus, String> {
    // Find the game by id (clone needed data, release lock before await)
    let game = {
        let games_lock = games
            .lock()
            .map_err(|e| format!("Failed to lock games: {}", e))?;
        games_lock
            .values()
            .find(|g| g.catalog_item_id == game_id && g.installation_guid == installation_guid)
            .cloned()
    };
    let game = match game {
        Some(g) => g,
        None => {
            emit_log(&app_handle, "ERROR", "Game not found for upload");
            return Err("Game not found".to_string());
        }
    };

    emit_log(
        &app_handle,
        "INFO",
        &format!("Starting manifest upload for game: {}", game.display_name),
    );

    // Use the internal upload function
    let result = upload_manifest_internal(&game).await;

    match &result {
        Ok(status) => match status.status.as_str() {
            "uploaded" => emit_log(
                &app_handle,
                "SUCCESS",
                &format!("Successfully uploaded manifest for {}", game.display_name),
            ),
            "already_uploaded" => emit_log(
                &app_handle,
                "INFO",
                &format!(
                    "Manifest for {} already exists on server",
                    game.display_name
                ),
            ),
            "failed" => emit_log(
                &app_handle,
                "ERROR",
                &format!("Failed to upload manifest for {}", game.display_name),
            ),
            _ => {}
        },
        Err(e) => emit_log(
            &app_handle,
            "ERROR",
            &format!("Upload error for {}: {}", game.display_name, e),
        ),
    }

    result
}

#[tauri::command]
pub async fn upload_all_manifests(games: State<'_, GameStore>) -> Result<Vec<UploadStatus>, String> {
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

#[tauri::command]
pub fn open_directory(path: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let path = std::path::Path::new(path);
        let path_str = path.to_str().ok_or_else(|| "Invalid path".to_string())?;

        std::process::Command::new("explorer")
            .args([path_str])
            .spawn()
            .map_err(|e| format!("Failed to open directory: {e}"))?;
    }
    #[cfg(target_os = "macos")]
    {
        // On macOS, use 'open' command
        let path = std::path::Path::new(path);
        let path_str = path.to_str().ok_or_else(|| "Invalid path".to_string())?;
        std::process::Command::new("open")
            .arg(path_str)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {e}"))?;
    }

    #[cfg(target_os = "linux")]
    {
        // On Linux, try xdg-open
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
    }

    Ok(())
}