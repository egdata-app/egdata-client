use super::models::{GameInfo, GameMetadata, Settings};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub type GameStore = Arc<Mutex<HashMap<String, GameInfo>>>;
pub type MetadataCache = Arc<Mutex<HashMap<String, GameMetadata>>>;
pub type SettingsState = Arc<Mutex<Settings>>;