export interface Stream {
  id: string
  name: string
  logoUrl: string
  streamUrl: string
  position?: {
    x: number
    y: number
  }
  chatId?: string // ID for associated chat window
  isLivestream?: boolean // Flag to indicate if it's a livestream
  fitMode?: 'contain' | 'cover' // Video scaling mode: 'contain' (default) or 'cover'
  isMuted?: boolean // Audio mute state for this stream
}

export interface StreamFormData {
  name: string
  logoUrl: string
  streamUrl: string
  startMuted?: boolean // Whether to start the stream muted
}

export interface GridItem {
  i: string
  x: number
  y: number
  w: number
  h: number
  static?: boolean
}

export interface AppSettings {
  // Audio settings
  defaultMuteNewStreams: boolean
  globalMuted: boolean

  // Auto-start settings
  autoStartOnLaunch: boolean
  autoStartDelay: number // 0-5 seconds

  // API settings
  apiEnabled: boolean
  apiPort: number
  apiKey: string
}
