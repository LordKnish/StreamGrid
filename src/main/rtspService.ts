import { app } from 'electron'
import express, { Express } from 'express'
import { Server } from 'http'
import { spawn } from 'child_process'
import { promisify } from 'util'
import { exec } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import type {
  RTSPStream,
  RTSPStartResult,
  RTSPStopResult,
  FFmpegCheckResult,
  RTSPSettings
} from '../shared/types/rtsp'

const execPromise = promisify(exec)

class RTSPService {
  private streams: Map<string, RTSPStream> = new Map()
  private expressApp: Express
  private server: Server | null = null
  private settings: RTSPSettings = {
    defaultTransport: 'tcp',
    segmentDuration: 2,
    maxRetries: 3,
    connectionTimeout: 10000,
    basePort: 8100
  }
  private usedPorts: Set<number> = new Set()
  private tempDir: string

  constructor() {
    this.expressApp = express()
    this.tempDir = path.join(app.getPath('temp'), 'streamgrid-rtsp')
    this.initialize()
  }

  private async initialize(): Promise<void> {
    // Create temp directory
    try {
      await fs.mkdir(this.tempDir, { recursive: true })
      console.log('[RTSP] Temp directory created:', this.tempDir)
    } catch (error) {
      console.error('[RTSP] Failed to create temp directory:', error)
    }

    // Clean up old directories on startup
    await this.cleanupOldDirectories()

    // Setup Express server
    this.setupExpressServer()
  }

  private async cleanupOldDirectories(): Promise<void> {
    try {
      const entries = await fs.readdir(this.tempDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(this.tempDir, entry.name)
          await fs.rm(dirPath, { recursive: true, force: true })
          console.log('[RTSP] Cleaned up old directory:', dirPath)
        }
      }
    } catch (error) {
      console.error('[RTSP] Error cleaning up old directories:', error)
    }
  }

  private setupExpressServer(): void {
    // Log all requests
    this.expressApp.use((req, _res, next) => {
      console.log(`[RTSP] Express request: ${req.method} ${req.url}`)
      next()
    })

    // Enable CORS for local access
    this.expressApp.use((_req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
      res.header('Access-Control-Allow-Headers', 'Content-Type')
      next()
    })

    // Serve HLS playlists and segments
    this.expressApp.get('/rtsp/:streamId/:file', async (req, res): Promise<void> => {
      const { streamId, file } = req.params
      console.log(`[RTSP] Request for stream ${streamId}, file: ${file}`)

      const stream = this.streams.get(streamId)

      if (!stream) {
        console.error(`[RTSP] Stream not found: ${streamId}`)
        res.status(404).send('Stream not found')
        return
      }

      const filePath = path.join(stream.outputDir, file)
      console.log(`[RTSP] Serving file: ${filePath}`)

      try {
        // Check if file exists
        await fs.access(filePath)

        // Set appropriate content type
        if (file.endsWith('.m3u8')) {
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
        } else if (file.endsWith('.ts')) {
          res.setHeader('Content-Type', 'video/mp2t')
          res.setHeader('Cache-Control', 'public, max-age=3600')
        }

        // Send file
        res.sendFile(filePath, (err) => {
          if (err) {
            console.error('[RTSP] Error sending file:', err)
          }
        })
      } catch (error) {
        console.error('[RTSP] File not found or error:', filePath, error)
        res.status(404).send('File not found')
      }
    })

    // Health check endpoint
    this.expressApp.get('/rtsp/:streamId/health', (req, res): void => {
      const { streamId } = req.params
      const stream = this.streams.get(streamId)

      if (!stream) {
        res.status(404).json({ status: 'not_found' })
        return
      }

      res.json({
        status: stream.status,
        uptime: Date.now() - stream.startTime.getTime(),
        errorCount: stream.errorCount
      })
    })

    // Debug endpoint to list all active streams
    this.expressApp.get('/rtsp/debug/streams', (_req, res): void => {
      const streamList = Array.from(this.streams.entries()).map(([id, stream]) => ({
        id,
        status: stream.status,
        outputDir: stream.outputDir,
        port: stream.port
      }))
      res.json({
        activeStreams: streamList.length,
        streams: streamList
      })
    })

    // Start server
    const port = this.settings.basePort
    this.server = this.expressApp.listen(port, 'localhost', () => {
      console.log(`[RTSP] Express server listening on http://localhost:${port}`)
      console.log(`[RTSP] Routes registered:`)
      console.log(`  - GET /rtsp/:streamId/:file`)
      console.log(`  - GET /rtsp/:streamId/health`)
      console.log(`  - GET /rtsp/debug/streams`)
    })

    this.server.on('error', (error) => {
      console.error('[RTSP] Express server error:', error)
    })
  }

  async checkFfmpeg(): Promise<FFmpegCheckResult> {
    try {
      const { stdout } = await execPromise('ffmpeg -version')
      const versionMatch = stdout.match(/ffmpeg version (\S+)/)
      const version = versionMatch ? versionMatch[1] : undefined

      console.log('[RTSP] FFmpeg found:', version)
      return {
        available: true,
        version,
        path: 'ffmpeg'
      }
    } catch (error) {
      console.error('[RTSP] FFmpeg not found:', error)
      return {
        available: false
      }
    }
  }

  private async findAvailablePort(): Promise<number> {
    const maxAttempts = 100
    for (let i = 0; i < maxAttempts; i++) {
      const port = this.settings.basePort + i
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port)
        return port
      }
    }
    throw new Error('No available ports')
  }

  async startStream(streamId: string, rtspUrl: string): Promise<RTSPStartResult> {
    try {
      console.log(`[RTSP] startStream called for ${streamId}`)
      console.log(`[RTSP] Current streams in map:`, Array.from(this.streams.keys()))

      // Check if stream already exists
      if (this.streams.has(streamId)) {
        console.log('[RTSP] Stream already running:', streamId)
        const existingStream = this.streams.get(streamId)!
        return {
          success: true,
          url: `http://localhost:${this.settings.basePort}/rtsp/${streamId}/playlist.m3u8`,
          port: existingStream.port
        }
      }

      // Check FFmpeg availability
      const ffmpegCheck = await this.checkFfmpeg()
      if (!ffmpegCheck.available) {
        return {
          success: false,
          error: 'FFmpeg is not installed or not found in PATH'
        }
      }

      // Create output directory
      const outputDir = path.join(this.tempDir, streamId)
      await fs.mkdir(outputDir, { recursive: true })

      // Find available port (not used for now, but reserved for future multi-server support)
      const port = await this.findAvailablePort()

      // Create stream object
      const stream: RTSPStream = {
        id: streamId,
        rtspUrl,
        ffmpegProcess: null,
        outputDir,
        port,
        status: 'starting',
        startTime: new Date(),
        errorCount: 0,
        retryCount: 0
      }

      // Add to streams map BEFORE spawning FFmpeg
      this.streams.set(streamId, stream)
      console.log(`[RTSP] Stream added to map: ${streamId}`)
      console.log(`[RTSP] Streams in map after add:`, Array.from(this.streams.keys()))

      // Spawn FFmpeg process
      await this.spawnFFmpeg(stream)

      console.log('[RTSP] Stream started:', streamId)
      console.log(`[RTSP] Final streams in map:`, Array.from(this.streams.keys()))
      return {
        success: true,
        url: `http://localhost:${this.settings.basePort}/rtsp/${streamId}/playlist.m3u8`,
        port: this.settings.basePort
      }
    } catch (error) {
      console.error('[RTSP] Error starting stream:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private async spawnFFmpeg(stream: RTSPStream): Promise<void> {
    const playlistPath = path.join(stream.outputDir, 'playlist.m3u8')
    const segmentPath = path.join(stream.outputDir, 'segment_%03d.ts')

    // FFmpeg arguments for RTSP to HLS transcoding
    const args = [
      '-rtsp_transport', this.settings.defaultTransport,
      '-i', stream.rtspUrl,
      '-c:v', 'copy', // Copy video codec (no re-encoding)
      '-c:a', 'aac', // Encode audio to AAC
      '-f', 'hls',
      '-hls_time', this.settings.segmentDuration.toString(),
      '-hls_list_size', '5', // Keep only 5 segments
      '-hls_flags', 'delete_segments+append_list',
      '-hls_segment_filename', segmentPath,
      playlistPath
    ]

    console.log('[RTSP] Spawning FFmpeg with args:', args.join(' '))

    const ffmpegProcess = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    stream.ffmpegProcess = ffmpegProcess

    // Handle stdout
    ffmpegProcess.stdout?.on('data', (data) => {
      console.log('[RTSP] FFmpeg stdout:', data.toString())
    })

    // Handle stderr (FFmpeg outputs to stderr)
    let lastOutput = ''
    ffmpegProcess.stderr?.on('data', (data) => {
      const output = data.toString()
      lastOutput = output

      // Log all output for debugging
      console.log('[RTSP] FFmpeg output:', output.substring(0, 200))

      // Log errors prominently
      if (output.toLowerCase().includes('error')) {
        console.error('[RTSP] FFmpeg ERROR:', output)
      }
    })

    // Handle process exit
    ffmpegProcess.on('exit', (code, signal) => {
      console.log(`[RTSP] FFmpeg process exited with code ${code}, signal ${signal}`)
      if (lastOutput) {
        console.log('[RTSP] Last FFmpeg output:', lastOutput)
      }

      if (code !== 0 && code !== null) {
        stream.errorCount++
        stream.status = 'error'

        // Retry logic
        if (stream.retryCount < this.settings.maxRetries) {
          stream.retryCount++
          console.log(`[RTSP] Retrying stream ${stream.id} (attempt ${stream.retryCount}/${this.settings.maxRetries})`)
          setTimeout(() => {
            this.spawnFFmpeg(stream)
          }, 2000 * stream.retryCount) // Exponential backoff
        } else {
          console.error(`[RTSP] Stream ${stream.id} failed after ${this.settings.maxRetries} retries`)
        }
      }
    })

    // Handle process errors
    ffmpegProcess.on('error', (error) => {
      console.error('[RTSP] FFmpeg process error:', error)
      stream.status = 'error'
      stream.errorCount++
    })

    // Wait for playlist to be created (with retries)
    let attempts = 0
    const maxAttempts = 15 // 15 seconds total
    while (attempts < maxAttempts) {
      try {
        await fs.access(playlistPath)
        stream.status = 'running'
        console.log('[RTSP] Stream running:', stream.id)
        return
      } catch {
        // Playlist not ready yet, wait and retry
        await new Promise(resolve => setTimeout(resolve, 1000))
        attempts++
      }
    }

    // If we get here, playlist was never created
    stream.status = 'error'
    console.error('[RTSP] Playlist not created after 15 seconds for stream:', stream.id)
  }

  async stopStream(streamId: string): Promise<RTSPStopResult> {
    try {
      const stream = this.streams.get(streamId)
      if (!stream) {
        return {
          success: false,
          error: 'Stream not found'
        }
      }

      // Kill FFmpeg process
      if (stream.ffmpegProcess) {
        stream.ffmpegProcess.kill('SIGTERM')
        stream.ffmpegProcess = null
      }

      // Clean up output directory
      await this.cleanupStream(streamId)

      // Remove from streams map
      this.streams.delete(streamId)

      // Release port
      this.usedPorts.delete(stream.port)

      console.log('[RTSP] Stream stopped:', streamId)
      return {
        success: true
      }
    } catch (error) {
      console.error('[RTSP] Error stopping stream:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private async cleanupStream(streamId: string): Promise<void> {
    const stream = this.streams.get(streamId)
    if (!stream) return

    try {
      await fs.rm(stream.outputDir, { recursive: true, force: true })
      console.log('[RTSP] Cleaned up stream directory:', stream.outputDir)
    } catch (error) {
      console.error('[RTSP] Error cleaning up stream directory:', error)
    }
  }

  async stopAllStreams(): Promise<void> {
    console.log('[RTSP] Stopping all streams...')
    const streamIds = Array.from(this.streams.keys())
    for (const streamId of streamIds) {
      await this.stopStream(streamId)
    }
  }

  async shutdown(): Promise<void> {
    console.log('[RTSP] Shutting down RTSP service...')

    // Stop all streams
    await this.stopAllStreams()

    // Close Express server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => {
          console.log('[RTSP] Express server closed')
          resolve()
        })
      })
    }

    // Clean up temp directory
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true })
      console.log('[RTSP] Temp directory cleaned up')
    } catch (error) {
      console.error('[RTSP] Error cleaning up temp directory:', error)
    }
  }
}

// Export singleton instance
export const rtspService = new RTSPService()
