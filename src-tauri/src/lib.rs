use chrono::{DateTime, Utc};
#[cfg(target_os = "macos")]
use dirs;
use once_cell::sync::Lazy;
use reqwest;
use serde::{Deserialize, Serialize};
use serde_json;
use std::collections::HashMap;
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::Read;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WindowEvent,
};
use tokio::time;

// Logging utility for emitting log events to frontend
#[derive(Debug, Clone, Serialize)]
pub struct LogEvent {
    pub level: String,
    pub message: String,
    pub timestamp: String,
}

pub fn emit_log(app_handle: &AppHandle, level: &str, message: &str) {
    let log_event = LogEvent {
        level: level.to_string(),
        message: message.to_string(),
        timestamp: chrono::Utc::now().format("%H:%M:%S").to_string(),
    };
    let _ = app_handle.emit("log-event", &log_event);
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpicGameManifest {
    #[serde(rename = "FormatVersion")]
    pub format_version: i32,
    #[serde(rename = "bIsIncompleteInstall")]
    pub is_incomplete_install: bool,
    #[serde(rename = "LaunchCommand")]
    pub launch_command: String,
    #[serde(rename = "LaunchExecutable")]
    pub launch_executable: String,
    #[serde(rename = "ManifestLocation")]
    pub manifest_location: String,
    #[serde(rename = "ManifestHash")]
    pub manifest_hash: String,
    #[serde(rename = "bIsApplication")]
    pub is_application: bool,
    #[serde(rename = "bIsExecutable")]
    pub is_executable: bool,
    #[serde(rename = "DisplayName")]
    pub display_name: String,
    #[serde(rename = "InstallationGuid")]
    pub installation_guid: String,
    #[serde(rename = "InstallLocation")]
    pub install_location: String,
    #[serde(rename = "InstallSize")]
    pub install_size: u64,
    #[serde(rename = "CatalogNamespace")]
    pub catalog_namespace: String,
    #[serde(rename = "CatalogItemId")]
    pub catalog_item_id: String,
    #[serde(rename = "AppName")]
    pub app_name: String,
    #[serde(rename = "AppVersionString")]
    pub app_version_string: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct GameInfo {
    pub display_name: String,
    pub app_name: String,
    pub install_location: String,
    pub install_size: u64,
    pub version: String,
    pub catalog_namespace: String,
    pub catalog_item_id: String,
    pub metadata: Option<GameMetadata>,
    pub installation_guid: String,
    pub manifest_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyImage {
    #[serde(rename = "type")]
    pub image_type: String,
    pub url: String,
    pub md5: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameMetadata {
    pub id: String,
    pub title: String,
    pub description: String,
    #[serde(rename = "keyImages")]
    pub key_images: Vec<KeyImage>,
    pub developer: Option<String>,
    #[serde(rename = "developerId")]
    pub developer_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct EnrichedGameInfo {
    pub game_info: GameInfo,
    pub metadata: Option<GameMetadata>,
}

pub type GameStore = Arc<Mutex<HashMap<String, GameInfo>>>;
pub type MetadataCache = Arc<Mutex<HashMap<String, GameMetadata>>>;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Settings {
    pub concurrency: u32,
    pub upload_speed_limit: u32,
    pub allowed_environments: Vec<String>,
    pub upload_interval: u64,       // in hours
    pub scan_interval_minutes: u64, // in minutes
}

pub type SettingsState = Arc<Mutex<Settings>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadedManifest {
    pub manifest_hash: String,
    pub uploaded_at: DateTime<Utc>,
}

pub type UploadedManifestSet = Arc<Mutex<HashSet<String>>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadStatus {
    pub status: String,
    pub message: Option<String>,
    pub manifest_hash: Option<String>,
}

const SETTINGS_FILE: &str = "settings.json";
const UPLOADED_MANIFESTS_FILE: &str = "uploaded_manifests.json";

// Auto-start functionality
fn setup_auto_start() -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        let exe_path = std::env::current_exe()?;
        let app_name = "EGDataClient";

        // Add to Windows startup registry
        let output = Command::new("reg")
            .args([
                "add",
                "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                app_name,
                "/t",
                "REG_SZ",
                "/d",
                &format!("\"{}\"", exe_path.display()),
                "/f",
            ])
            .output();

        match output {
            Ok(result) if result.status.success() => {
                println!("Auto-start enabled successfully");
            }
            Ok(result) => {
                eprintln!(
                    "Failed to enable auto-start: {}",
                    String::from_utf8_lossy(&result.stderr)
                );
            }
            Err(e) => {
                eprintln!("Error setting up auto-start: {}", e);
            }
        }
    }

    Ok(())
}

fn get_app_data_path() -> std::path::PathBuf {
    // Use standard system app data directory
    let mut path = std::env::var("APPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    path.push("egdata-client");
    path
}

fn load_settings_from_file() -> Settings {
    let app_data_path = get_app_data_path();
    let settings_path = app_data_path.join(SETTINGS_FILE);

    if let Ok(mut file) = File::open(settings_path) {
        let mut contents = String::new();
        if file.read_to_string(&mut contents).is_ok() {
            if let Ok(settings) = serde_json::from_str::<Settings>(&contents) {
                return settings;
            }
        }
    }
    // Default settings
    Settings {
        concurrency: 3,
        upload_speed_limit: 0,
        allowed_environments: vec!["Live".to_string(), "Production".to_string()],
        upload_interval: 6,       // Default to 6 hours
        scan_interval_minutes: 1, // Default to 1 minute
    }
}

fn save_settings_to_file(settings: &Settings) {
    let app_data_path = get_app_data_path();
    // Ensure the directory exists
    if let Err(e) = fs::create_dir_all(&app_data_path) {
        eprintln!("Failed to create app data directory: {}", e);
        return;
    }

    let settings_path = app_data_path.join(SETTINGS_FILE);
    if let Ok(json) = serde_json::to_string_pretty(settings) {
        let _ = fs::write(settings_path, json);
    }
}

fn load_uploaded_manifests_from_file() -> HashSet<String> {
    let app_data_path = get_app_data_path();
    let manifests_path = app_data_path.join(UPLOADED_MANIFESTS_FILE);

    if let Ok(file) = File::open(manifests_path) {
        if let Ok(set) = serde_json::from_reader::<_, HashSet<String>>(file) {
            return set;
        }
    }
    HashSet::new()
}

fn save_uploaded_manifests_to_file(set: &HashSet<String>) {
    let app_data_path = get_app_data_path();
    // Ensure the directory exists
    if let Err(e) = fs::create_dir_all(&app_data_path) {
        eprintln!("Failed to create app data directory: {}", e);
        return;
    }

    let manifests_path = app_data_path.join(UPLOADED_MANIFESTS_FILE);
    if let Ok(json) = serde_json::to_string_pretty(set) {
        let _ = fs::write(manifests_path, json);
    }
}

static HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .expect("Failed to create HTTP client")
});

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn show_window(app_handle: AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn hide_window(app_handle: AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[tauri::command]
fn minimize_window(app_handle: AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.minimize();
    }
}

#[tauri::command]
fn get_installed_games(games: State<GameStore>) -> Result<Vec<GameInfo>, String> {
    let games_lock = games
        .lock()
        .map_err(|e| format!("Failed to lock games: {}", e))?;
    Ok(games_lock.values().cloned().collect())
}

#[tauri::command]
async fn scan_games_now(
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
fn get_settings(settings: State<SettingsState>) -> Result<Settings, String> {
    let settings_lock = settings
        .lock()
        .map_err(|e| format!("Failed to lock settings: {}", e))?;
    Ok(settings_lock.clone())
}

#[tauri::command]
fn set_settings(settings: State<SettingsState>, new_settings: Settings) -> Result<(), String> {
    let mut settings_lock = settings
        .lock()
        .map_err(|e| format!("Failed to lock settings: {}", e))?;
    *settings_lock = new_settings.clone();
    save_settings_to_file(&new_settings);
    Ok(())
}

#[tauri::command]
fn clear_uploaded_manifests(
    app_handle: AppHandle,
    uploaded_manifests: State<UploadedManifestSet>,
) -> Result<(), String> {
    let mut uploaded = uploaded_manifests
        .lock()
        .map_err(|e| format!("Failed to lock uploaded manifests: {}", e))?;

    let count = uploaded.len();
    uploaded.clear();
    save_uploaded_manifests_to_file(&uploaded);

    emit_log(
        &app_handle,
        "INFO",
        &format!("Cleared {} uploaded manifest records", count),
    );

    Ok(())
}

#[tauri::command]
async fn upload_manifest(
    app_handle: AppHandle,
    game_id: String,
    installation_guid: String,
    games: State<'_, GameStore>,
    uploaded_manifests: State<'_, UploadedManifestSet>,
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
    let install_dir = &game.install_location;
    let manifests_path = get_manifests_path();
    let item_path = manifests_path.join(format!("{}.item", installation_guid));
    let manifest_path = std::path::PathBuf::from(format!(
        "{}/.egstore/{}.manifest",
        install_dir.replace("\\", "/"),
        installation_guid
    ));

    // Read files first to get manifest hash from .item file
    emit_log(&app_handle, "INFO", "Reading manifest files...");
    let item_bytes = fs::read(&item_path).map_err(|e| {
        emit_log(
            &app_handle,
            "ERROR",
            &format!("Failed to read .item file: {}", e),
        );
        format!("Failed to read .item file: {}", e)
    })?;
    let manifest_bytes = fs::read(&manifest_path).map_err(|e| {
        emit_log(
            &app_handle,
            "ERROR",
            &format!("Failed to read .manifest file: {}", e),
        );
        format!("Failed to read .manifest file: {}", e)
    })?;

    // Parse .item file to get ManifestHash
    let item_json: serde_json::Value = serde_json::from_slice(&item_bytes)
        .map_err(|e| format!("Failed to parse .item file: {}", e))?;
    let manifest_hash = item_json["ManifestHash"]
        .as_str()
        .ok_or("ManifestHash not found in .item file")?;

    // Check if already uploaded (clone set, release lock before await)
    let already_uploaded = {
        let uploaded = uploaded_manifests
            .lock()
            .map_err(|e| format!("Failed to lock uploaded manifests: {}", e))?;
        uploaded.contains(manifest_hash)
    };
    if already_uploaded {
        emit_log(
            &app_handle,
            "INFO",
            &format!("Manifest for {} already uploaded", game.display_name),
        );
        return Ok(UploadStatus {
            status: "already_uploaded".to_string(),
            message: Some("Manifest already uploaded".to_string()),
            manifest_hash: Some(manifest_hash.to_string()),
        });
    }

    emit_log(&app_handle, "INFO", "Uploading manifest to server...");

    // Prepare multipart form
    let manifest_filename = format!("{}.manifest", installation_guid);
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
        emit_log(
            &app_handle,
            "SUCCESS",
            &format!("Successfully uploaded manifest for {}", game.display_name),
        );
        // Mark as uploaded (lock only for writing)
        {
            let mut uploaded = uploaded_manifests
                .lock()
                .map_err(|e| format!("Failed to lock uploaded manifests: {}", e))?;
            uploaded.insert(manifest_hash.to_string());
            save_uploaded_manifests_to_file(&uploaded);
        }
        Ok(UploadStatus {
            status: "uploaded".to_string(),
            message: Some(text),
            manifest_hash: Some(manifest_hash.to_string()),
        })
    } else {
        emit_log(
            &app_handle,
            "ERROR",
            &format!(
                "Failed to upload manifest for {}: {}",
                game.display_name, text
            ),
        );
        // Check if the error is about identical content already existing
        if text.contains("A manifest file with identical content already exists") {
            // Mark as uploaded since the content is identical
            {
                let mut uploaded = uploaded_manifests
                    .lock()
                    .map_err(|e| format!("Failed to lock uploaded manifests: {}", e))?;
                uploaded.insert(manifest_hash.to_string());
                save_uploaded_manifests_to_file(&uploaded);
            }
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

#[tauri::command]
async fn upload_all_manifests(
    games: State<'_, GameStore>,
    uploaded_manifests: State<'_, UploadedManifestSet>,
) -> Result<Vec<UploadStatus>, String> {
    let games_to_upload = {
        let games_lock = games
            .lock()
            .map_err(|e| format!("Failed to lock games: {}", e))?;
        games_lock.values().cloned().collect::<Vec<_>>()
    };

    let mut results = Vec::new();

    for game in games_to_upload {
        match upload_manifest_internal(&game, &uploaded_manifests).await {
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

async fn upload_manifest_internal(
    game: &GameInfo,
    uploaded_manifests: &UploadedManifestSet,
) -> Result<UploadStatus, String> {
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

    // Check if already uploaded
    let already_uploaded = {
        let uploaded = uploaded_manifests
            .lock()
            .map_err(|e| format!("Failed to lock uploaded manifests: {}", e))?;
        uploaded.contains(manifest_hash)
    };
    if already_uploaded {
        return Ok(UploadStatus {
            status: "already_uploaded".to_string(),
            message: Some("Manifest already uploaded".to_string()),
            manifest_hash: Some(manifest_hash.to_string()),
        });
    }

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
        // Mark as uploaded
        {
            let mut uploaded = uploaded_manifests
                .lock()
                .map_err(|e| format!("Failed to lock uploaded manifests: {}", e))?;
            uploaded.insert(manifest_hash.to_string());
            save_uploaded_manifests_to_file(&uploaded);
        }
        Ok(UploadStatus {
            status: "uploaded".to_string(),
            message: Some(text),
            manifest_hash: Some(manifest_hash.to_string()),
        })
    } else {
        // Check if the error is about identical content already existing
        if text.contains("A manifest file with identical content already exists") {
            // Mark as uploaded since the content is identical
            {
                let mut uploaded = uploaded_manifests
                    .lock()
                    .map_err(|e| format!("Failed to lock uploaded manifests: {}", e))?;
                uploaded.insert(manifest_hash.to_string());
                save_uploaded_manifests_to_file(&uploaded);
            }
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

async fn scan_epic_games_with_metadata(
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

async fn periodic_upload(
    app_handle: AppHandle,
    games: GameStore,
    uploaded_manifests: UploadedManifestSet,
    settings: SettingsState,
) {
    let mut interval = time::interval(Duration::from_secs(3600)); // Check every hour

    loop {
        interval.tick().await;

        // Get current settings
        let upload_interval = match settings.lock() {
            Ok(settings_lock) => settings_lock.upload_interval,
            Err(e) => {
                eprintln!("Failed to lock settings during periodic upload: {}", e);
                continue;
            }
        };

        // Calculate when next upload should happen
        let next_upload = Duration::from_secs(upload_interval * 3600);

        // Sleep until next upload time
        time::sleep(next_upload).await;

        println!("Starting periodic manifest upload...");

        match upload_all_manifests_internal(&games, &uploaded_manifests).await {
            Ok(results) => {
                let uploaded_count = results.iter().filter(|r| r.status == "uploaded").count();
                let already_uploaded_count = results
                    .iter()
                    .filter(|r| r.status == "already_uploaded")
                    .count();
                let failed_count = results.iter().filter(|r| r.status == "failed").count();

                println!(
                    "Periodic upload completed: {} uploaded, {} already uploaded, {} failed",
                    uploaded_count, already_uploaded_count, failed_count
                );

                // Emit event to frontend
                let _ = app_handle.emit("periodic-upload-completed", &results);
            }
            Err(e) => {
                eprintln!("Periodic upload failed: {}", e);
            }
        }
    }
}

async fn upload_all_manifests_internal(
    games: &GameStore,
    uploaded_manifests: &UploadedManifestSet,
) -> Result<Vec<UploadStatus>, String> {
    let games_to_upload = {
        let games_lock = games
            .lock()
            .map_err(|e| format!("Failed to lock games: {}", e))?;
        games_lock.values().cloned().collect::<Vec<_>>()
    };

    let mut results = Vec::new();

    for game in games_to_upload {
        match upload_manifest_internal(&game, uploaded_manifests).await {
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
    let uploaded_manifests: UploadedManifestSet =
        Arc::new(Mutex::new(load_uploaded_manifests_from_file()));

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
        .manage(uploaded_manifests.clone())
        .invoke_handler(tauri::generate_handler![
            greet,
            show_window,
            hide_window,
            minimize_window,
            get_installed_games,
            scan_games_now,
            get_settings,
            set_settings,
            clear_uploaded_manifests,
            upload_manifest,
            upload_all_manifests
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
                uploaded_manifests.clone(),
                settings_for_periodic,
            ));

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
