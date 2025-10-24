# StreamGrid v2.0.0 - Automation & Advanced Controls

## 🆕 Release Notes

## 🎉 Major Features

### REST API for External Control (Closes #17)
- Complete REST API with 7 endpoints for programmatic control
- Stream management: GET, POST, PUT, DELETE `/api/streams`
- Grid management: GET, POST `/api/grids`, PUT `/api/grids/:id/load`
- API key authentication with Bearer token support
- Rate limiting (100 requests per 15 minutes per IP)
- CORS support for cross-origin requests
- Comprehensive API documentation ([docs/API.md](docs/API.md))
- Bruno API test collection for easy testing ([bruno/README.md](bruno/README.md))
- Settings UI with API key generation and server controls
- Disabled by default (user opt-in for security)

### RTSP Stream Support
- Production-ready RTSP/RTSPS streaming with FFmpeg transcoding
- Express server on localhost:8100 for HLS segment delivery
- Support for authentication (username:password in URL)
- Multiple concurrent RTSP streams with isolated directories
- Automatic retry logic (3 attempts with exponential backoff)
- Low-latency transcoding (2-second HLS segments)
- Progressive loading messages for better UX
- Automatic resource cleanup on stream stop and app quit
- Comprehensive error handling and FFmpeg availability checking

### M3U Playlist Import
- Import M3U/M3U8 playlists with one click
- Automatic grid arrangement with intelligent layout algorithm
- Support for UTF-16 encoded playlists (LE and BE)
- Viewport-aware grid sizing for optimal display
- Row-budget constrained integer grid algorithm
- Support for both local files and remote URLs

### Sound Management System (Closes #15)
- Global mute/unmute all streams with single button
- Per-stream audio controls for individual management
- Auto-start streams muted option
- Default mute setting for new streams
- Persistent audio state across sessions
- Settings dialog for audio preferences

### Auto-Start Streams on Launch (Closes #19)
- Automatically play all streams when app opens
- Configurable startup delay (0-5 seconds)
- Perfect for monitoring and surveillance setups
- Toggle in settings for user control
- Respects mute settings during auto-start

### Auto-Restart Failed Streams (Closes #16)
- Automatic retry with exponential backoff (30s, 60s, 120s)
- Configurable max retry attempts (default: 3)
- Manual retry button for failed streams
- Retry status indicators in UI
- Persistent retry settings across sessions
- Smart error detection and recovery

### Auto-Arrange Grid
- Intelligent grid layout with row-budget algorithm
- Viewport-aware sizing for optimal space utilization
- Optimal stream distribution across rows
- One-click grid organization
- Maintains aspect ratios during arrangement

## 🐛 Bug Fixes

### Linux Auto-Updater (Closes #18)
- Fixed missing `latest-linux.yml` errors
- Graceful handling of update check failures
- Non-intrusive error logging for update issues
- Improved error handling for missing update files

### Twitch Embedding
- Resolved Content Security Policy (CSP) violations
- Fixed Twitch stream embedding issues
- Improved iframe handling for Twitch streams

### Build System
- Fixed TypeScript compilation errors in rtspService.ts
- Resolved electron-updater import failures in production builds
- Improved error handling for missing dependencies
- Enhanced build reliability across all platforms

### Stream Management
- Enhanced error handling across all components
- Improved RTSP URL validation and detection
- Fixed ReactPlayer race conditions with RTSP streams
- Added Express server request logging for debugging
- Enhanced FFmpeg output logging for troubleshooting

## 🔧 Technical Improvements

### New Dependencies
- `cors@^2.8.5` - CORS support for REST API
- `express-rate-limit@^8.1.0` - API rate limiting
- `fluent-ffmpeg@^2.1.3` - RTSP transcoding (already present)
- `express@^5.1.0` - REST API server (already present)

### New Files Created
- `src/main/apiServer.ts` (390 lines) - REST API implementation
- `src/main/apiAuth.ts` (79 lines) - API authentication middleware
- `src/main/rtspService.ts` (454 lines) - RTSP transcoding service
- `src/shared/types/api.ts` (21 lines) - API type definitions
- `src/shared/types/rtsp.ts` (38 lines) - RTSP type definitions
- `docs/API.md` (455 lines) - Complete API documentation
- `bruno/*.bru` - Bruno API test collection
- `src/renderer/src/components/M3U8ImportDialog.tsx` - M3U playlist import UI
- `src/renderer/src/components/AutoArrangeDialog.tsx` - Auto-arrange UI
- `src/renderer/src/utils/m3u8Parser.ts` - M3U playlist parser

### Architecture Changes
- Express REST server in main process (port 3737)
- Express HLS server for RTSP (port 8100)
- IPC bridge for renderer-main API communication
- Shared type definitions for cross-process safety
- FFmpeg process lifecycle management
- Automatic server shutdown on app quit
- Enhanced error boundaries and recovery mechanisms

### Documentation
- Complete REST API documentation with examples
- Bruno API collection for all endpoints
- Comprehensive RTSP setup guide in README
- Updated README with all v2.0.0 features
- API documentation links prominently displayed

## 🔄 Upgrading

This version is fully compatible with previous configurations. Your existing stream layouts and settings will be preserved.

**Breaking Changes:** None

## 📦 What's Changed

**Phase 1 - Foundation (Issues #15, #18, #19):**
- Sound Management, Auto-Start, and Linux Updater Fix by @LordKnish in 36fefaf

**Phase 2 - Advanced Features:**
- M3U playlist import with UTF-16 support by @LordKnish in 8a38881, 335b6d7
- Auto-arrange with row-budget algorithm by @LordKnish in b9752bb
- Production-ready RTSP stream support by @LordKnish in c846023
- REST API for external control by @LordKnish in 17d8cb4

**Bug Fixes:**
- Resolve Twitch embedding CSP violations by @LordKnish in 091a850, 776d30b
- Use valid compression type for deb packages by @LordKnish in 17f34ad
- Resolve build failures and improve release workflow by @LordKnish in 4220776
- Fix TypeScript errors in rtspService.ts by @LordKnish in 6e50df4
- Handle electron-updater import failure gracefully by @LordKnish in 471a48a

**Full Changelog:** v1.2.3...v2.0.0

## 🧪 Testing

✓ REST API endpoints tested with Bruno collection
✓ RTSP streaming tested with multiple concurrent streams
✓ M3U playlist import tested with various formats
✓ Sound management tested across all scenarios
✓ Auto-start and auto-restart tested
✓ Cross-platform builds verified (Windows, macOS, Linux)
✓ GitHub Actions workflow validated
✓ Production build successful

## Contributors

@LordKnish

---

**Release Date:** January 24, 2025
**Version:** 2.0.0
