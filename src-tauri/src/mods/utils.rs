use super::models::{LogEvent, Settings};
use std::fs::{self, File};
use std::io::Read;
use tauri::{AppHandle, Emitter};

pub fn emit_log(app_handle: &AppHandle, level: &str, message: &str) {
    let log_event = LogEvent {
        level: level.to_string(),
        message: message.to_string(),
        timestamp: chrono::Utc::now().format("%H:%M:%S").to_string(),
    };
    let _ = app_handle.emit("log-event", &log_event);
}

const SETTINGS_FILE: &str = "settings.json";

// Auto-start functionality
pub fn setup_auto_start() -> Result<(), Box<dyn std::error::Error>> {
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

pub fn get_app_data_path() -> std::path::PathBuf {
    // Use standard system app data directory
    let mut path = std::env::var("APPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    path.push("egdata-client");
    path
}

pub fn load_settings_from_file() -> Settings {
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
        upload_interval: 60,      // Default to 60 minutes
        scan_interval_minutes: 1, // Default to 1 minute
    }
}

pub fn save_settings_to_file(settings: &Settings) {
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