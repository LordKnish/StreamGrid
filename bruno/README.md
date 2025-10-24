# StreamGrid API - Bruno Collection

This folder contains a [Bruno](https://www.usebruno.com/) API collection for testing the StreamGrid REST API.

## Setup

1. Install Bruno: https://www.usebruno.com/downloads
2. Open Bruno and import this collection
3. Configure your API key in `environments/Local.bru`
4. Enable the API in StreamGrid Settings
5. Run the requests!

## Environment Variables

Edit `environments/Local.bru` to set:
- `apiKey`: Your API key from StreamGrid Settings
- `baseUrl`: API server URL (default: http://localhost:3737)

## Available Requests

### Health Check
- **Health** - Check API server status (no auth required)

### Stream Management
- **Get Streams** - List all streams
- **Post Streams** - Add a new stream
- **Put Streams** - Update a stream
- **Delete Stream** - Remove a stream

### Grid Management
- **Get Grids** - List all saved grids
- **Post Grid** - Create a new grid
- **Load Grid** - Switch to a different grid

## Usage Tips

1. Start with **Health** to verify the API is running
2. Use **Get Streams** to see current streams
3. Use **Post Streams** to add test streams
4. Update the `streamId` parameter in **Put Streams** and **Delete Stream** with actual IDs from your responses

## Getting Your API Key

1. Open StreamGrid
2. Go to Settings (gear icon)
3. Scroll to "REST API Settings"
4. Enable REST API
5. Click "Generate API Key" if needed
6. Copy the API key
7. Paste it into `environments/Local.bru`
