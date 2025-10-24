# StreamGrid REST API Documentation

## Overview

StreamGrid provides a REST API for external control and automation. The API allows you to programmatically manage streams and grids.

**Base URL:** `http://localhost:3737` (default port, configurable in settings)

## Authentication

All API endpoints (except `/health`) require authentication using an API key.

### API Key Header

Include your API key in one of these headers:

```
X-API-Key: your-api-key-here
```

or

```
Authorization: Bearer your-api-key-here
```

### Generating an API Key

1. Open StreamGrid Settings
2. Navigate to API section
3. Click "Generate API Key"
4. Enable the API server
5. Copy your API key (keep it secure!)

## Rate Limiting

- **Limit:** 100 requests per 15 minutes per IP address
- **Headers:** Rate limit info included in response headers

## Endpoints

### Health Check

Check if the API server is running.

**Endpoint:** `GET /health` or `GET /api/health`

**Authentication:** Not required

**Response:**
```json
{
  "status": "ok",
  "apiEnabled": true,
  "timestamp": "2025-01-24T16:00:00.000Z"
}
```

---

### Stream Management

#### List All Streams

Get all streams in the current grid.

**Endpoint:** `GET /api/streams`

**Response:**
```json
{
  "streams": [
    {
      "id": "stream-1234567890",
      "name": "Stream 1",
      "streamUrl": "https://example.com/stream.m3u8",
      "logoUrl": "https://example.com/logo.png",
      "isMuted": false,
      "fitMode": "contain"
    }
  ]
}
```

#### Add a Stream

Add a new stream to the current grid.

**Endpoint:** `POST /api/streams`

**Request Body:**
```json
{
  "name": "My Stream",
  "streamUrl": "https://example.com/stream.m3u8",
  "logoUrl": "https://example.com/logo.png",
  "isMuted": false,
  "fitMode": "contain"
}
```

**Required Fields:**
- `name` (string): Stream name
- `streamUrl` (string): Stream URL (HLS, DASH, YouTube, Twitch, RTSP, etc.)

**Optional Fields:**
- `logoUrl` (string): Logo/thumbnail URL
- `isMuted` (boolean): Start muted (default: false)
- `fitMode` (string): "contain" or "cover" (default: "contain")

**Response:**
```json
{
  "success": true,
  "stream": {
    "id": "stream-1234567890",
    "name": "My Stream",
    "streamUrl": "https://example.com/stream.m3u8",
    "logoUrl": "https://example.com/logo.png",
    "isMuted": false,
    "fitMode": "contain"
  }
}
```

#### Update a Stream

Update an existing stream's properties.

**Endpoint:** `PUT /api/streams/:id`

**URL Parameters:**
- `id` (string): Stream ID

**Request Body:**
```json
{
  "name": "Updated Name",
  "isMuted": true,
  "fitMode": "cover"
}
```

**Response:**
```json
{
  "success": true,
  "id": "stream-1234567890",
  "updates": {
    "name": "Updated Name",
    "isMuted": true,
    "fitMode": "cover"
  }
}
```

#### Delete a Stream

Remove a stream from the current grid.

**Endpoint:** `DELETE /api/streams/:id`

**URL Parameters:**
- `id` (string): Stream ID

**Response:**
```json
{
  "success": true,
  "id": "stream-1234567890"
}
```

---

### Grid Management

#### List All Grids

Get all saved grids.

**Endpoint:** `GET /api/grids`

**Response:**
```json
{
  "grids": [
    {
      "id": "grid-1234567890",
      "name": "My Grid",
      "createdAt": "2025-01-24T16:00:00.000Z",
      "lastModified": "2025-01-24T16:30:00.000Z",
      "streamCount": 4,
      "fileName": "grid-1234567890.json"
    }
  ]
}
```

#### Create a Grid

Create a new saved grid.

**Endpoint:** `POST /api/grids`

**Request Body:**
```json
{
  "name": "My New Grid",
  "streams": [],
  "layout": [],
  "chats": []
}
```

**Required Fields:**
- `name` (string): Grid name

**Optional Fields:**
- `streams` (array): Array of stream objects
- `layout` (array): Grid layout configuration
- `chats` (array): Chat windows configuration

**Response:**
```json
{
  "success": true,
  "grid": {
    "id": "grid-1234567890",
    "name": "My New Grid",
    "createdAt": "2025-01-24T16:00:00.000Z",
    "lastModified": "2025-01-24T16:00:00.000Z",
    "streams": [],
    "layout": [],
    "chats": []
  }
}
```

#### Load a Grid

Switch to a different saved grid.

**Endpoint:** `PUT /api/grids/:id/load`

**URL Parameters:**
- `id` (string): Grid ID

**Response:**
```json
{
  "success": true,
  "id": "grid-1234567890"
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Missing required fields: name, streamUrl"
}
```

### 401 Unauthorized
```json
{
  "error": "Missing API key",
  "message": "Provide API key in X-API-Key header or Authorization: Bearer <key>"
}
```

### 403 Forbidden
```json
{
  "error": "Invalid API key",
  "message": "The provided API key is invalid"
}
```

### 404 Not Found
```json
{
  "error": "Stream not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Try again later."
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to add stream"
}
```

### 503 Service Unavailable
```json
{
  "error": "API is disabled",
  "message": "The REST API is currently disabled. Enable it in settings."
}
```

---

## Example Usage

### cURL Examples

**Add a stream:**
```bash
curl -X POST http://localhost:3737/api/streams \
  -H "X-API-Key: your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Stream",
    "streamUrl": "https://example.com/stream.m3u8",
    "logoUrl": "https://example.com/logo.png"
  }'
```

**List all streams:**
```bash
curl -X GET http://localhost:3737/api/streams \
  -H "X-API-Key: your-api-key-here"
```

**Delete a stream:**
```bash
curl -X DELETE http://localhost:3737/api/streams/stream-1234567890 \
  -H "X-API-Key: your-api-key-here"
```

**Load a grid:**
```bash
curl -X PUT http://localhost:3737/api/grids/grid-1234567890/load \
  -H "X-API-Key: your-api-key-here"
```

### Python Example

```python
import requests

API_URL = "http://localhost:3737/api"
API_KEY = "your-api-key-here"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# Add a stream
response = requests.post(
    f"{API_URL}/streams",
    headers=headers,
    json={
        "name": "My Stream",
        "streamUrl": "https://example.com/stream.m3u8"
    }
)
print(response.json())

# List all streams
response = requests.get(f"{API_URL}/streams", headers=headers)
streams = response.json()["streams"]
print(f"Total streams: {len(streams)}")
```

### JavaScript Example

```javascript
const API_URL = 'http://localhost:3737/api';
const API_KEY = 'your-api-key-here';

const headers = {
  'X-API-Key': API_KEY,
  'Content-Type': 'application/json'
};

// Add a stream
async function addStream() {
  const response = await fetch(`${API_URL}/streams`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      name: 'My Stream',
      streamUrl: 'https://example.com/stream.m3u8'
    })
  });
  const data = await response.json();
  console.log(data);
}

// List all streams
async function listStreams() {
  const response = await fetch(`${API_URL}/streams`, { headers });
  const data = await response.json();
  console.log(`Total streams: ${data.streams.length}`);
}
```

---

## Security Best Practices

1. **Keep your API key secret** - Never commit it to version control
2. **Use HTTPS in production** - Consider using a reverse proxy with SSL
3. **Restrict network access** - Use firewall rules to limit API access
4. **Rotate API keys regularly** - Generate new keys periodically
5. **Monitor API usage** - Check logs for suspicious activity
6. **Disable when not needed** - Turn off the API server when not in use

---

## Troubleshooting

### API Server Won't Start

**Problem:** Port already in use

**Solution:** Change the API port in settings or stop the conflicting service

### Authentication Fails

**Problem:** 403 Forbidden response

**Solution:**
- Verify API key is correct
- Check that API is enabled in settings
- Ensure API key header is properly formatted

### Rate Limit Exceeded

**Problem:** 429 Too Many Requests

**Solution:** Wait 15 minutes or reduce request frequency

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/LordKnish/StreamGrid/issues
- Documentation: https://github.com/LordKnish/StreamGrid
