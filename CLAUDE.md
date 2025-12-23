# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EGData Client is a Tauri 2.0 desktop application that scans Epic Games Store installations and uploads game manifest data to the EGData preservation project. It runs in the background with system tray integration.

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm tauri dev        # Run in development mode (starts Vite on :1420 + Rust backend)
pnpm tauri build      # Production build (creates installers for all platforms)
```

## Architecture

**Frontend (React/TypeScript)** - `src/`
- React 19 with shadcn/ui components (Radix UI primitives) and TailwindCSS
- TanStack Query for server state, TanStack DB for local state
- Communicates with backend via Tauri IPC (`invoke()` and `listen()`)
- UI components in `src/components/ui/` following shadcn/ui patterns

**Backend (Rust)** - `src-tauri/`
- `lib.rs` - Main Tauri app: window management, system tray, periodic tasks, game scanning
- `mods/commands.rs` - IPC command handlers exposed to frontend
- `mods/models.rs` - Data structures (Game, Settings, ManifestUpload)
- `mods/state.rs` - Thread-safe shared state (Arc<Mutex<>>)
- `mods/utils.rs` - Utility functions

**Data Flow:**
```
Frontend → Tauri Commands (invoke) → Rust Backend → Epic Games Manifests → EGData API
         ← Tauri Events (listen)  ←
```

## Key Patterns

**Tauri Commands** - Functions decorated with `#[tauri::command]` in Rust are callable from frontend via `invoke("command_name", { args })`.

**Tauri Events** - Backend emits events (`games-updated`, `log-event`, `periodic-upload-completed`) that frontend listens to via `listen()`.

**State Management** - Backend uses `Arc<Mutex<AppState>>` passed through Tauri's state system. Frontend uses TanStack DB collections for games, settings, logs, and upload status.

## Important Paths

**Epic Games Manifests:**
- Windows: `C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests`
- macOS: `~/Library/Application Support/Epic/EpicGamesLauncher/Data/Manifests`

**APIs:**
- Metadata: `https://api.egdata.app/items/{id}`
- Upload: `https://egdata-builds-api.snpm.workers.dev/upload-manifest`

## Configuration

- `tauri.conf.json` - Tauri app config (window size, bundle settings, build commands)
- `vite.config.ts` - Frontend build config (path alias `@/` → `./src/`)
- `src/App.css` - TailwindCSS v4 with CSS-based config, shadcn/ui variables, dark theme

## Platform-Specific Notes

- Window starts hidden (`visible: false`) and shows after initialization
- App hides to system tray on close instead of quitting
- Auto-start registration only implemented for Windows (registry)
- Single-instance enforcement via `tauri-plugin-single-instance`
