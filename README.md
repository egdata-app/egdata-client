# EGData Client

A desktop application built with Tauri, React, and TypeScript that scans your Epic Games Store installations and uploads game manifest data to the EGData project for preservation and research purposes.

## Features

- 🎮 **Game Library Scanning**: Automatically detects installed Epic Games Store games
- 📊 **Manifest Upload**: Uploads game manifest files to contribute to game preservation
- 🔄 **Periodic Sync**: Automatically scans and uploads new data at configurable intervals
- 📱 **System Tray**: Runs quietly in the background with system tray integration
- 🎨 **Modern UI**: Clean, responsive interface built with HeroUI components
- 📝 **Real-time Logs**: Monitor scanning and upload progress with detailed logging

## What is EGData?

EGData is a community project that collects and preserves Epic Games Store game metadata and manifest files. This data helps researchers, developers, and preservationists understand game distribution patterns and maintain historical records of games.

## Prerequisites

- Node.js (v18 or higher)
- pnpm package manager
- Rust (for Tauri development)
- Epic Games Store with installed games

## Installation

### For End Users (Recommended)

**Download from GitHub Releases** (Recommended for production use):

⚠️ **Important Security Notice**: This application is currently unsigned, which means your operating system will show security warnings when you try to run it. The app is safe to use, but you'll need to explicitly allow it to run. See platform-specific instructions below.

1. Go to the [GitHub Releases page](https://github.com/egdata-app/egdata-client/releases)
2. Download the latest release for your platform:
   - **Windows**: `.msi` installer or `.exe` portable
   - **macOS**: `.dmg` disk image or `.app` bundle
   - **Linux**: `.deb`, `.rpm`, or `.AppImage`
3. Follow the platform-specific installation steps below

#### Windows Installation
1. Download the `.msi` installer or `.exe` portable version
2. When Windows shows "Windows protected your PC" warning:
   - Click "More info"
   - Click "Run anyway"
3. Complete the installation or run the portable version

#### macOS Installation
1. Download the `.dmg` or `.app` file
2. If using `.dmg`, mount it and drag the app to Applications
3. When macOS blocks the app (choose one method):
   
   **Method A: Right-click and Open**
   - Right-click on the app
   - Select "Open" from the context menu
   - Click "Open" in the security dialog
   
   **Method B: System Preferences**
   - Try to open the app normally (it will be blocked)
   - Go to System Preferences → Security & Privacy → General
   - Click "Open Anyway" next to the blocked app message
   
   **Method C: Command Line**
   ```bash
   # Remove quarantine attribute
   xattr -dr com.apple.quarantine "/Applications/EGData Client.app"
   ```

#### Linux Installation
1. Download the appropriate package for your distribution
2. Install using your package manager or run the AppImage directly
3. You may need to make the file executable:
   ```bash
   chmod +x egdata-client.AppImage
   ./egdata-client.AppImage
   ```

### For Developers

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd egdata-client
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Run in development mode**

   ```bash
   pnpm tauri dev
   ```

4. **Build for production**
   ```bash
   pnpm tauri build
   ```

## Tech Stack

- **Frontend**: React 19, TypeScript, HeroUI, TailwindCSS
- **Backend**: Rust, Tauri 2.0
- **State Management**: TanStack Query, Custom stores
- **Build Tool**: Vite
- **Package Manager**: pnpm

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

This project is open source. Please check the license file for details.
