use serde::{Deserialize, Serialize};

// Logging utility for emitting log events to frontend
#[derive(Debug, Clone, Serialize)]
pub struct LogEvent {
    pub level: String,
    pub message: String,
    pub timestamp: String,
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Settings {
    pub concurrency: u32,
    pub upload_speed_limit: u32,
    pub allowed_environments: Vec<String>,
    pub upload_interval: u64,       // in minutes
    pub scan_interval_minutes: u64, // in minutes
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadStatus {
    pub status: String,
    pub message: Option<String>,
    pub manifest_hash: Option<String>,
}