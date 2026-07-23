# Changelog

All notable changes to Buddy will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-07-23

### Added
- **Right-click context menu on pet**: Glassmorphism popup with Settings, Hide Pet, and Close Buddy actions
- **Double-click to open Settings**: Double-clicking the pet window opens the Settings panel instantly
- **GitHub Actions CI/CD**: Automated test workflow on every push/PR to `main`
- **GitHub Actions Release**: Cross-platform build pipeline for macOS (arm64 + x64) and Windows (x64), uploads individual installer files to GitHub Releases

### Fixed
- Pet image not displaying (WebP and PNG): Replaced `convertFileSrc` / `asset://` protocol with `readFile` + Blob URLs — eliminates CORS/tainted-canvas issues on macOS WKWebView
- Pet library thumbnails not loading: Same Blob URL fix applied to Settings > Pet Library thumbnail rendering
- Build error `core:webview:allow-asset-protocol not found`: Removed deprecated `assetProtocol.enable` from `tauri.conf.json` while preserving the required `scope`
- TypeScript error `TS2367` in `PetWindow.tsx`: Extracted `isDragging` boolean before TypeScript narrows the `petState` union type


## [0.1.0] - 2026-07-23

### Added
- Initial release of Buddy desktop pet app
- Transparent, always-on-top pet window
- Settings window with pet customization
- System tray integration
- Auto-start on login support
