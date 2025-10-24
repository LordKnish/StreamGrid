import { ChildProcess } from 'child_process'

export interface RTSPStream {
  id: string
  rtspUrl: string
  ffmpegProcess: ChildProcess | null
  outputDir: string
  port: number
  status: 'starting' | 'running' | 'error' | 'stopped'
  startTime: Date
  errorCount: number
  retryCount: number
}

export interface RTSPStartResult {
  success: boolean
  url?: string
  port?: number
  error?: string
}

export interface RTSPStopResult {
  success: boolean
  error?: string
}

export interface FFmpegCheckResult {
  available: boolean
  version?: string
  path?: string
}

export interface RTSPSettings {
  defaultTransport: 'tcp' | 'udp'
  segmentDuration: number // 1-10 seconds
  maxRetries: number
  connectionTimeout: number
  basePort: number
}
