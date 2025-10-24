import express, { Express, Request, Response } from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { Server } from 'http'
import { BrowserWindow } from 'electron'
import { authenticateApiKey, healthCheck, updateAuthConfig, generateApiKey } from './apiAuth'
import type { Stream } from '../shared/types/api'
import type { SavedGrid } from '../shared/types/grid'

export interface ApiServerConfig {
  port: number
  apiKey: string
  enabled: boolean
}

let server: Server | null = null
let app: Express | null = null
let currentConfig: ApiServerConfig | null = null

/**
 * Create and configure the Express app
 */
function createApp(): Express {
  const expressApp = express()

  // Middleware
  expressApp.use(express.json({ limit: '10mb' }))
  expressApp.use(express.urlencoded({ extended: true }))

  // CORS configuration - allow all origins for local API
  expressApp.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization']
    })
  )

  // Rate limiting - 100 requests per 15 minutes per IP
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests', message: 'Rate limit exceeded. Try again later.' },
    standardHeaders: true,
    legacyHeaders: false
  })
  expressApp.use('/api', limiter)

  // Health check endpoint (no auth required)
  expressApp.get('/health', healthCheck)
  expressApp.get('/api/health', healthCheck)

  // ===== STREAM ENDPOINTS =====
  // Note: Authentication is applied to each route individually

  // GET /api/streams - List all streams
  expressApp.get('/api/streams', authenticateApiKey, async (_req: Request, res: Response) => {
    try {
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (!mainWindow) {
        res.status(503).json({ error: 'Application not ready' })
        return
      }

      const result = await mainWindow.webContents.executeJavaScript(
        'window.streamStore?.getState().streams || []'
      )
      res.json({ streams: result })
    } catch (error) {
      console.error('Error getting streams:', error)
      res.status(500).json({ error: 'Failed to get streams' })
    }
  })

  // POST /api/streams - Add a new stream
  expressApp.post('/api/streams', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const { name, streamUrl, logoUrl, isMuted, fitMode } = req.body

      if (!name || !streamUrl) {
        res.status(400).json({ error: 'Missing required fields: name, streamUrl' })
        return
      }

      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (!mainWindow) {
        res.status(503).json({ error: 'Application not ready' })
        return
      }

      // Generate unique ID
      const streamId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const newStream: Stream = {
        id: streamId,
        name,
        streamUrl,
        logoUrl: logoUrl || '',
        isMuted: isMuted !== undefined ? isMuted : false,
        fitMode: fitMode || 'contain'
      }

      await mainWindow.webContents.executeJavaScript(
        `window.streamStore?.getState().addStream(${JSON.stringify(newStream)})`
      )

      res.status(201).json({ success: true, stream: newStream })
    } catch (error) {
      console.error('Error adding stream:', error)
      res.status(500).json({ error: 'Failed to add stream' })
    }
  })

  // PUT /api/streams/:id - Update a stream
  expressApp.put('/api/streams/:id', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const { id } = req.params
      const updates = req.body

      if (!id) {
        res.status(400).json({ error: 'Missing stream ID' })
        return
      }

      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (!mainWindow) {
        res.status(503).json({ error: 'Application not ready' })
        return
      }

      // Check if stream exists
      const streams = await mainWindow.webContents.executeJavaScript(
        'window.streamStore?.getState().streams || []'
      )
      const streamExists = streams.some((s: Stream) => s.id === id)

      if (!streamExists) {
        res.status(404).json({ error: 'Stream not found' })
        return
      }

      await mainWindow.webContents.executeJavaScript(
        `window.streamStore?.getState().updateStream('${id}', ${JSON.stringify(updates)})`
      )

      res.json({ success: true, id, updates })
    } catch (error) {
      console.error('Error updating stream:', error)
      res.status(500).json({ error: 'Failed to update stream' })
    }
  })

  // DELETE /api/streams/:id - Remove a stream
  expressApp.delete('/api/streams/:id', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const { id } = req.params

      if (!id) {
        res.status(400).json({ error: 'Missing stream ID' })
        return
      }

      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (!mainWindow) {
        res.status(503).json({ error: 'Application not ready' })
        return
      }

      // Check if stream exists
      const streams = await mainWindow.webContents.executeJavaScript(
        'window.streamStore?.getState().streams || []'
      )
      const streamExists = streams.some((s: Stream) => s.id === id)

      if (!streamExists) {
        res.status(404).json({ error: 'Stream not found' })
        return
      }

      await mainWindow.webContents.executeJavaScript(
        `window.streamStore?.getState().removeStream('${id}')`
      )

      res.json({ success: true, id })
    } catch (error) {
      console.error('Error removing stream:', error)
      res.status(500).json({ error: 'Failed to remove stream' })
    }
  })

  // ===== GRID ENDPOINTS =====

  // GET /api/grids - List all grids
  expressApp.get('/api/grids', authenticateApiKey, async (_req: Request, res: Response) => {
    try {
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (!mainWindow) {
        res.status(503).json({ error: 'Application not ready' })
        return
      }

      // Get all grids via IPC
      const grids = await mainWindow.webContents.executeJavaScript(
        'window.api.getAllGrids()'
      )

      res.json({ grids: grids || [] })
    } catch (error) {
      console.error('Error getting grids:', error)
      res.status(500).json({ error: 'Failed to get grids' })
    }
  })

  // POST /api/grids - Create a new grid
  expressApp.post('/api/grids', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const { name, streams, layout, chats } = req.body

      if (!name) {
        res.status(400).json({ error: 'Missing required field: name' })
        return
      }

      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (!mainWindow) {
        res.status(503).json({ error: 'Application not ready' })
        return
      }

      const gridId = `grid-${Date.now()}`
      const now = new Date().toISOString()

      const newGrid: SavedGrid = {
        id: gridId,
        name,
        createdAt: now,
        lastModified: now,
        streams: streams || [],
        layout: layout || [],
        chats: chats || []
      }

      // Save grid via IPC
      await mainWindow.webContents.executeJavaScript(
        `window.api.saveGrid(${JSON.stringify(newGrid)})`
      )

      res.status(201).json({ success: true, grid: newGrid })
    } catch (error) {
      console.error('Error creating grid:', error)
      res.status(500).json({ error: 'Failed to create grid' })
    }
  })

  // PUT /api/grids/:id/load - Load/switch to a grid
  expressApp.put('/api/grids/:id/load', authenticateApiKey, async (req: Request, res: Response) => {
    try {
      const { id } = req.params

      if (!id) {
        res.status(400).json({ error: 'Missing grid ID' })
        return
      }

      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (!mainWindow) {
        res.status(503).json({ error: 'Application not ready' })
        return
      }

      // Load grid via store method
      await mainWindow.webContents.executeJavaScript(
        `window.streamStore?.getState().loadGrid('${id}')`
      )

      res.json({ success: true, id })
    } catch (error) {
      console.error('Error loading grid:', error)
      res.status(500).json({ error: 'Failed to load grid' })
    }
  })

  // No catch-all needed - Express will handle 404s automatically
  // or we can add a final middleware without wildcards
  expressApp.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' })
  })

  return expressApp
}

/**
 * Start the API server
 */
export async function startApiServer(config: ApiServerConfig): Promise<void> {
  if (server) {
    console.log('API server already running')
    return
  }

  if (!config.enabled) {
    console.log('API server is disabled')
    return
  }

  try {
    // Update auth configuration
    updateAuthConfig({
      apiKey: config.apiKey,
      enabled: config.enabled
    })

    // Create Express app
    app = createApp()
    currentConfig = config

    // Start server
    await new Promise<void>((resolve, reject) => {
      server = app!.listen(config.port, () => {
        console.log(`StreamGrid API server running on http://localhost:${config.port}`)
        console.log(`Health check: http://localhost:${config.port}/health`)
        resolve()
      }).on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${config.port} is already in use`))
        } else {
          reject(err)
        }
      })
    })
  } catch (error) {
    console.error('Failed to start API server:', error)
    server = null
    app = null
    currentConfig = null
    throw error
  }
}

/**
 * Stop the API server
 */
export async function stopApiServer(): Promise<void> {
  if (!server) {
    console.log('API server is not running')
    return
  }

  return new Promise((resolve, reject) => {
    server!.close((err) => {
      if (err) {
        console.error('Error stopping API server:', err)
        reject(err)
      } else {
        console.log('API server stopped')
        server = null
        app = null
        currentConfig = null
        resolve()
      }
    })
  })
}

/**
 * Restart the API server with new configuration
 */
export async function restartApiServer(config: ApiServerConfig): Promise<void> {
  await stopApiServer()
  if (config.enabled) {
    await startApiServer(config)
  }
}

/**
 * Get current server status
 */
export function getServerStatus(): {
  running: boolean
  config: ApiServerConfig | null
} {
  return {
    running: server !== null,
    config: currentConfig
  }
}

/**
 * Export generateApiKey for use in main process
 */
export { generateApiKey }
