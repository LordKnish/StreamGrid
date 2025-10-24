import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.svg?asset'
import https from 'https'
import fs from 'fs/promises'
import path from 'path'
import type { SavedGrid, GridManifest } from '../shared/types/grid'
import { rtspService } from './rtspService'

// Diagnostic logging
console.log('MAIN ENTRY', {
  type: (process as any).type,
  versions: process.versions,
  runAsNode: process.env.ELECTRON_RUN_AS_NODE || null
})

// Fail fast if running outside Electron main process
if ((process as any).type && (process as any).type !== 'browser') {
  throw new Error('Main loaded outside Electron main process')
}

// Hold reference to autoUpdater (lazy loaded)
let autoUpdater: typeof import('electron-updater').autoUpdater | null = null

// Wait for dev server to be ready
async function waitFor(url: string, opts: { timeoutMs?: number; intervalMs?: number } = {}): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 15000
  const intervalMs = opts.intervalMs ?? 250
  const start = Date.now()
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await fetch(url, { method: 'HEAD', cache: 'no-store' as any })
      if (res.ok) return
    } catch { /* ignore until timeout */ }
    if (Date.now() - start > timeoutMs) throw new Error(`Dev server not reachable: ${url}`)
    await new Promise(r => setTimeout(r, intervalMs))
  }
}

// Function to fetch latest GitHub release version
async function getLatestGitHubVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/LordKnish/StreamGrid/releases/latest',
      headers: {
        'User-Agent': 'StreamGrid'
      }
    }

    https
      .get(options, (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          try {
            const release = JSON.parse(data)
            resolve(release.tag_name.replace('v', ''))
          } catch (err) {
            reject(err)
          }
        })
      })
      .on('error', (err) => {
        reject(err)
      })
  })
}

// Wire up auto-updater events (called after lazy load)
function wireAutoUpdaterEvents(au: typeof import('electron-updater').autoUpdater): void {
  au.autoDownload = false
  au.autoInstallOnAppQuit = true

  au.on('checking-for-update', () => {
    console.log('Checking for updates...')
  })

  au.on('update-available', (info) => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `Version ${info.version} is available. Would you like to download it?`,
        buttons: ['Yes', 'No'],
        defaultId: 0
      })
      .then((result) => {
        if (result.response === 0) {
          au.downloadUpdate()
        }
      })
  })

  au.on('update-not-available', () => {
    console.log('No updates available')
  })

  au.on('error', (err) => {
    // Log but don't show error dialog for update failures
    // This prevents the Linux latest-linux.yml 404 error from being intrusive
    console.log('Auto-updater error (non-critical):', err.message || err)

    // Only show error dialog for critical update errors, not missing update files
    if (err.message && !err.message.includes('latest-linux.yml') && !err.message.includes('404')) {
      console.error('Critical auto-updater error:', err)
    }
  })

  au.on('download-progress', (progressObj) => {
    console.log(`Download progress: ${progressObj.percent}%`)
  })

  au.on('update-downloaded', (info) => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: `Version ${info.version} has been downloaded. The application will now restart to install the update.`,
        buttons: ['Restart']
      })
      .then(() => {
        au.quitAndInstall(false, true)
      })
  })
}

async function checkForUpdates(): Promise<void> {
  if (!autoUpdater) return
  try {
    await autoUpdater.checkForUpdates()
  } catch (e: any) {
    console.log('Update check failed (non-critical):', e?.message || e)
  }
}

async function createWindow(): Promise<void> {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      devTools: true,
      webSecurity: false, // Disable web security to allow local file access
      allowRunningInsecureContent: true
    }
  })

  // TEMPORARILY DISABLED: Intercept Twitch embed requests to add parent parameter
  // Commenting out to rule out webRequest interference during dev server loading
  /*
  mainWindow.webContents.session.webRequest.onBeforeRequest(
    {
      urls: ['https://player.twitch.tv/*', 'https://embed.twitch.tv/*']
    },
    (details, callback) => {
      let redirectURL = details.url

      // Parse the URL to get existing parameters
      const url = new URL(redirectURL)
      const params = url.searchParams

      // Only modify if parent is not already set
      if (!params.has('parent')) {
        // Set parent to localhost with port for development, or just localhost for production
        const parentDomain = !app.isPackaged ? 'localhost:5173' : 'localhost'
        params.set('parent', parentDomain)
        params.set('referrer', `https://${parentDomain}/`)

        redirectURL = url.toString()
        console.log('Adjusted Twitch embed URL to:', redirectURL)
      }

      callback({
        cancel: false,
        redirectURL
      })
    }
  )

  // Remove CSP headers for Twitch embeds and modify frame-ancestors
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    {
      urls: ['https://www.twitch.tv/*', 'https://player.twitch.tv/*', 'https://embed.twitch.tv/*']
    },
    (details, callback) => {
      const responseHeaders = details.responseHeaders || {}

      console.log('Processing CSP headers for:', details.url)

      // Remove CSP headers that block embedding
      delete responseHeaders['Content-Security-Policy']
      delete responseHeaders['content-security-policy']

      callback({
        cancel: false,
        responseHeaders
      })
    }
  )
  */

  // Add right-click menu for inspect element
  mainWindow.webContents.on('context-menu', (_, props): void => {
    const { x, y } = props
    const menu = require('electron').Menu.buildFromTemplate([
      {
        label: 'Inspect Element',
        click: (): void => {
          mainWindow.webContents.inspectElement(x, y)
        }
      }
    ])
    menu.popup()
  })

  // Add keyboard shortcut for DevTools
  mainWindow.webContents.on('before-input-event', (_, input): void => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
  const isDev = !app.isPackaged
  const rendererUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173'

  console.log('DEV?', isDev, 'ELECTRON_RENDERER_URL=', process.env.ELECTRON_RENDERER_URL)
  console.log(
    'Loading URL:',
    isDev ? rendererUrl : 'file://' + join(__dirname, '../renderer/index.html')
  )

  // Better diagnostics
  mainWindow.webContents.on('did-finish-load', () => console.log('did-finish-load'))
  mainWindow.webContents.on('did-navigate', (_e, url) => console.log('did-navigate', url))
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) =>
    console.error('did-fail-load', { code, desc, url })
  )
  mainWindow.webContents.on('render-process-gone', (_e, d) =>
    console.error('render-process-gone', d)
  )

  mainWindow.once('ready-to-show', () => {
    console.log('ready-to-show')
    mainWindow.show()
  })

  // Force foreground in case Windows puts it behind
  mainWindow.once('show', () => {
    mainWindow.focus()
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    setTimeout(() => mainWindow.setAlwaysOnTop(false), 500)
  })

  // Fallback show in case ready-to-show never arrives
  setTimeout(() => {
    if (!mainWindow.isVisible()) {
      console.warn('Force show fallback')
      mainWindow.show()
      mainWindow.focus()
    }
  }, 3000)

  // Wait for dev server and handle loading errors
  if (isDev) {
    try {
      await waitFor(rendererUrl)               // ensure Vite is up
      await mainWindow.loadURL(rendererUrl)    // first attempt
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    } catch (err: any) {
      const msg = String(err?.message || err)
      console.warn('loadURL error:', msg)
      // benign second navigation during HMR
      if (msg.includes('ERR_ABORTED')) {
        console.warn('loadURL aborted; continuing')
      } else {
        // brief retry once
        await new Promise(r => setTimeout(r, 500))
        try {
          await mainWindow.loadURL(rendererUrl)
          mainWindow.webContents.openDevTools({ mode: 'detach' })
        } catch (e2) {
          console.error('Second loadURL failed:', e2)
        }
      }
    }
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Lazy load electron-updater only in packaged builds
  if (app.isPackaged) {
    const mod = await import('electron-updater')
    autoUpdater = mod.autoUpdater
    wireAutoUpdaterEvents(autoUpdater)
    checkForUpdates()
    setInterval(checkForUpdates, 60 * 60 * 1000)
  }

  // Set app user model id for windows
  app.setAppUserModelId('com.streamgrid.app')

  // Default open or close DevTools by F12 in development
  app.on('browser-window-created', (_, window) => {
    // Simple keyboard shortcut handling without toolkit
    if (!app.isPackaged) {
      window.webContents.on('before-input-event', (event, input) => {
        // Reload on Ctrl/Cmd + R
        if ((input.control || input.meta) && input.key.toLowerCase() === 'r') {
          event.preventDefault()
          window.webContents.reload()
        }
      })
    }
  })

  // IPC handlers
  ipcMain.on('ping', () => console.log('pong'))
  ipcMain.on('get-app-version', (event) => {
    event.returnValue = app.getVersion()
  })

  // Add handler for getting latest GitHub version
  ipcMain.handle('get-github-version', async () => {
    try {
      return await getLatestGitHubVersion()
    } catch (error) {
      console.error('Error fetching GitHub version:', error)
      return null
    }
  })

  // Add handler for file dialog
  ipcMain.handle('show-open-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        {
          name: 'Video Files',
          extensions: ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v', 'flv', 'wmv']
        },
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'] },
        { name: 'M3U Playlists', extensions: ['m3u', 'm3u8'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (!result.canceled && result.filePaths.length > 0) {
      // Convert to file:// URL format
      const filePath = result.filePaths[0]
      const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`
      return { filePath, fileUrl }
    }
    return null
  })

  // Add handler for M3U file dialog
  ipcMain.handle('show-m3u-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'M3U Playlists', extensions: ['m3u', 'm3u8'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  })

  // Add handler for reading M3U file content
  ipcMain.handle('read-m3u-file', async (_, filePath: string) => {
    try {
      // Read file as buffer first to detect encoding
      const buffer = await fs.readFile(filePath)

      // Check for UTF-16 BOM
      let content: string
      if (buffer.length >= 2) {
        // UTF-16 LE BOM: FF FE
        if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
          content = buffer.toString('utf16le')
        }
        // UTF-16 BE BOM: FE FF
        else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
          // Node.js doesn't have utf16be, so we need to swap bytes
          const swapped = Buffer.alloc(buffer.length)
          for (let i = 0; i < buffer.length; i += 2) {
            swapped[i] = buffer[i + 1]
            swapped[i + 1] = buffer[i]
          }
          content = swapped.toString('utf16le')
        }
        // UTF-8 BOM: EF BB BF
        else if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
          content = buffer.toString('utf-8')
        }
        // No BOM, try UTF-8
        else {
          content = buffer.toString('utf-8')
        }
      } else {
        content = buffer.toString('utf-8')
      }

      return { success: true, content }
    } catch (error) {
      console.error('Error reading M3U file:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read file'
      }
    }
  })

  // Add handler for fetching M3U from URL
  ipcMain.handle('fetch-m3u-url', async (_, url: string) => {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'StreamGrid/2.0'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const content = await response.text()
      return { success: true, content }
    } catch (error) {
      console.error('Error fetching M3U URL:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch URL'
      }
    }
  })

  // RTSP streaming handlers
  ipcMain.handle('rtspCheckFfmpeg', async () => {
    return await rtspService.checkFfmpeg()
  })

  ipcMain.handle('rtspStartStream', async (_, streamId: string, rtspUrl: string) => {
    return await rtspService.startStream(streamId, rtspUrl)
  })

  ipcMain.handle('rtspStopStream', async (_, streamId: string) => {
    return await rtspService.stopStream(streamId)
  })

  // Grid management setup
  await setupGridManagement()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Grid management setup function
async function setupGridManagement(): Promise<void> {
  const gridsDir = path.join(app.getPath('userData'), 'grids')
  const manifestPath = path.join(gridsDir, 'manifest.json')

  // Ensure grids directory exists
  await fs.mkdir(gridsDir, { recursive: true })

  // Initialize manifest if it doesn't exist
  try {
    await fs.access(manifestPath)
  } catch {
    const initialManifest: GridManifest = {
      version: '1.0.0',
      currentGridId: null,
      grids: []
    }
    await fs.writeFile(manifestPath, JSON.stringify(initialManifest, null, 2))
  }

  // Save grid handler
  ipcMain.handle('save-grid', async (_, grid: SavedGrid) => {
    try {
      const fileName = `${grid.id}.json`
      const filePath = path.join(gridsDir, fileName)

      // Save grid file
      await fs.writeFile(filePath, JSON.stringify(grid, null, 2))

      // Update manifest
      const manifestData = await fs.readFile(manifestPath, 'utf-8')
      const manifest: GridManifest = JSON.parse(manifestData)

      const existingIndex = manifest.grids.findIndex((g) => g.id === grid.id)
      const gridInfo = {
        id: grid.id,
        name: grid.name,
        createdAt: grid.createdAt,
        lastModified: grid.lastModified,
        streamCount: grid.streams.length,
        fileName
      }

      if (existingIndex >= 0) {
        manifest.grids[existingIndex] = gridInfo
      } else {
        manifest.grids.push(gridInfo)
      }

      manifest.currentGridId = grid.id
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))
    } catch (error) {
      console.error('Error saving grid:', error)
      throw error
    }
  })

  // Load grid handler
  ipcMain.handle('load-grid', async (_, gridId: string) => {
    try {
      const filePath = path.join(gridsDir, `${gridId}.json`)
      const data = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(data) as SavedGrid
    } catch (error) {
      console.error('Error loading grid:', error)
      return null
    }
  })

  // Delete grid handler
  ipcMain.handle('delete-grid', async (_, gridId: string) => {
    try {
      const filePath = path.join(gridsDir, `${gridId}.json`)
      await fs.unlink(filePath)

      // Update manifest
      const manifestData = await fs.readFile(manifestPath, 'utf-8')
      const manifest: GridManifest = JSON.parse(manifestData)
      manifest.grids = manifest.grids.filter((g) => g.id !== gridId)

      if (manifest.currentGridId === gridId) {
        manifest.currentGridId = null
      }

      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))
    } catch (error) {
      console.error('Error deleting grid:', error)
      throw error
    }
  })

  // Rename grid handler
  ipcMain.handle('rename-grid', async (_, gridId: string, newName: string) => {
    try {
      const filePath = path.join(gridsDir, `${gridId}.json`)
      const data = await fs.readFile(filePath, 'utf-8')
      const grid: SavedGrid = JSON.parse(data)

      grid.name = newName
      grid.lastModified = new Date().toISOString()

      await fs.writeFile(filePath, JSON.stringify(grid, null, 2))

      // Update manifest
      const manifestData = await fs.readFile(manifestPath, 'utf-8')
      const manifest: GridManifest = JSON.parse(manifestData)
      const gridIndex = manifest.grids.findIndex((g) => g.id === gridId)

      if (gridIndex >= 0) {
        manifest.grids[gridIndex].name = newName
        manifest.grids[gridIndex].lastModified = grid.lastModified
      }

      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))
    } catch (error) {
      console.error('Error renaming grid:', error)
      throw error
    }
  })

  // Get manifest handler
  ipcMain.handle('get-grid-manifest', async () => {
    try {
      const data = await fs.readFile(manifestPath, 'utf-8')
      return JSON.parse(data) as GridManifest
    } catch (error) {
      console.error('Error getting manifest:', error)
      return null
    }
  })

  // Get all grids handler
  ipcMain.handle('get-all-grids', async () => {
    try {
      const data = await fs.readFile(manifestPath, 'utf-8')
      const manifest: GridManifest = JSON.parse(data)
      return manifest.grids
    } catch (error) {
      console.error('Error getting all grids:', error)
      return []
    }
  })
}

// Add handler for save request from renderer
ipcMain.handle('request-save', async () => {
  // This will be called by the renderer when it needs to save
  return true
})

// Handle before-quit event to ensure saving
app.on('before-quit', async (event) => {
  // Send a message to all windows to save their state
  const windows = BrowserWindow.getAllWindows()
  if (windows.length > 0) {
    event.preventDefault()

    // Stop all RTSP streams
    await rtspService.stopAllStreams()

    // Send save request to all windows
    for (const window of windows) {
      window.webContents.send('app-before-quit')
    }

    // Wait a bit for saves to complete
    setTimeout(() => {
      app.quit()
    }, 1000)
  }
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
