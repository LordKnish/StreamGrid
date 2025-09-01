import { contextBridge, ipcRenderer, shell } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { SavedGrid, GridManifest } from '../shared/types/grid'

// Custom APIs for renderer
const api = {
  version: ipcRenderer.sendSync('get-app-version'),
  getGitHubVersion: (): Promise<string | null> => ipcRenderer.invoke('get-github-version'),
  openExternal: (url: string): Promise<void> => shell.openExternal(url),
  showOpenDialog: (): Promise<{ filePath: string; fileUrl: string } | null> => ipcRenderer.invoke('show-open-dialog'),
  // Grid management APIs
  saveGrid: (grid: SavedGrid): Promise<void> => ipcRenderer.invoke('save-grid', grid),
  loadGrid: (gridId: string): Promise<SavedGrid | null> => ipcRenderer.invoke('load-grid', gridId),
  deleteGrid: (gridId: string): Promise<void> => ipcRenderer.invoke('delete-grid', gridId),
  renameGrid: (gridId: string, newName: string): Promise<void> => ipcRenderer.invoke('rename-grid', gridId, newName),
  getGridManifest: (): Promise<GridManifest> => ipcRenderer.invoke('get-grid-manifest'),
  getAllGrids: (): Promise<Array<{ id: string; name: string; lastModified: string; streamCount: number }>> => ipcRenderer.invoke('get-all-grids'),
  // App lifecycle events
  onAppBeforeQuit: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('app-before-quit', listener)
    return () => ipcRenderer.removeListener('app-before-quit', listener)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
