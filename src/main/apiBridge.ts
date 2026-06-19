import { BrowserWindow, ipcMain } from 'electron'

/**
 * Secure request/response bridge between the main-process API server and the
 * renderer's Zustand store.
 *
 * This replaces the previous `webContents.executeJavaScript()` approach, which
 * built JavaScript source from untrusted REST input and was a remote-code-
 * execution vector. Here, the main process sends a structured command with a
 * correlation id and the renderer replies with structured data only.
 */

export type RendererAction =
  | 'getStreams'
  | 'addStream'
  | 'updateStream'
  | 'removeStream'
  | 'getAllGrids'
  | 'saveGrid'
  | 'loadGrid'

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

interface ApiResponse {
  requestId: number
  ok: boolean
  result?: unknown
  error?: string
}

let sequence = 0
const pending = new Map<number, PendingRequest>()

// Register the response listener exactly once at module load.
ipcMain.on('api:response', (_event, msg: ApiResponse) => {
  const request = pending.get(msg.requestId)
  if (!request) return

  clearTimeout(request.timer)
  pending.delete(msg.requestId)

  if (msg.ok) {
    request.resolve(msg.result)
  } else {
    request.reject(new Error(msg.error || 'Renderer command failed'))
  }
})

/**
 * Send a structured command to the renderer and await its structured reply.
 * Never interpolates input into executable code.
 */
export function callRenderer<T = unknown>(
  action: RendererAction,
  payload?: unknown,
  timeoutMs = 5000
): Promise<T> {
  const targetWindow = BrowserWindow.getAllWindows()[0]
  if (!targetWindow || targetWindow.webContents.isDestroyed()) {
    return Promise.reject(new Error('Application not ready'))
  }

  const requestId = ++sequence

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId)
      reject(new Error('Renderer command timed out'))
    }, timeoutMs)

    pending.set(requestId, {
      resolve: resolve as (value: unknown) => void,
      reject,
      timer
    })

    targetWindow.webContents.send('api:command', { requestId, action, payload })
  })
}
