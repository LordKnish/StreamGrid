// Shared API types for main and renderer processes

export interface Stream {
  id: string
  name: string
  logoUrl: string
  streamUrl: string
  position?: {
    x: number
    y: number
  }
  chatId?: string
  isLivestream?: boolean
  fitMode?: 'contain' | 'cover'
  isMuted?: boolean
}

export interface ApiSettings {
  enabled: boolean
  port: number
  apiKey: string
}
