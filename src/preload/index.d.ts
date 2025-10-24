import { ElectronAPI } from '@electron-toolkit/preload'
import type { SavedGrid, GridManifest } from '../shared/types/grid'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      version: string
      getGitHubVersion: () => Promise<string | null>
      openExternal: (url: string) => Promise<void>
      showOpenDialog: () => Promise<{ filePath: string; fileUrl: string } | null>
      // M3U import APIs
      showM3UDialog: () => Promise<string | null>
      readM3UFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
      fetchM3UUrl: (url: string) => Promise<{ success: boolean; content?: string; error?: string }>
      // Grid management APIs
      saveGrid: (grid: SavedGrid) => Promise<void>
      loadGrid: (gridId: string) => Promise<SavedGrid | null>
      deleteGrid: (gridId: string) => Promise<void>
      renameGrid: (gridId: string, newName: string) => Promise<void>
      getGridManifest: () => Promise<GridManifest>
      getAllGrids: () => Promise<Array<{ id: string; name: string; lastModified: string; streamCount: number }>>
      // RTSP streaming APIs
      rtspStartStream: (streamId: string, rtspUrl: string) => Promise<{ success: boolean; url?: string; port?: number; error?: string }>
      rtspStopStream: (streamId: string) => Promise<{ success: boolean; error?: string }>
      rtspCheckFfmpeg: () => Promise<{ available: boolean }>
      // API server management
      startApiServer: (config: { port: number; apiKey: string; enabled: boolean }) => Promise<{ success: boolean; error?: string }>
      stopApiServer: () => Promise<{ success: boolean; error?: string }>
      restartApiServer: (config: { port: number; apiKey: string; enabled: boolean }) => Promise<{ success: boolean; error?: string }>
      getApiServerStatus: () => Promise<{ running: boolean; config: { port: number; apiKey: string; enabled: boolean } | null }>
      generateApiKey: () => Promise<string>
      // App lifecycle events
      onAppBeforeQuit: (callback: () => void) => () => void
    }
  }
}
