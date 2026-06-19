import { useStreamStore } from '../store/useStreamStore'

export type ImportGridResult =
  | { status: 'success'; name: string }
  | { status: 'cancelled' }
  | { status: 'error'; error: string }

/**
 * Prompt the user for a `.json` grid file, validate it, import it into the
 * store, and save it as a new grid (which becomes the current grid). Shared by
 * the "All grids" dialog and the grid-tabs "+" menu.
 */
export function importGridFromFile(): Promise<ImportGridResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'

    // Fired when the picker is dismissed without choosing a file (supported in
    // modern Chromium/Electron). Avoids leaving the promise pending forever.
    input.oncancel = (): void => resolve({ status: 'cancelled' })

    input.onchange = async (e): Promise<void> => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) {
        resolve({ status: 'cancelled' })
        return
      }
      try {
        const data = JSON.parse(await file.text())
        const store = useStreamStore.getState()
        const result = store.importStreams({
          streams: data.streams,
          layout: data.layout,
          chats: data.chats || []
        })
        if (!result.success) {
          resolve({ status: 'error', error: result.error || 'Invalid grid file.' })
          return
        }
        const name = file.name.replace(/\.json$/i, '').trim() || 'Imported Grid'
        await store.saveCurrentGrid(name)
        resolve({ status: 'success', name })
      } catch (error) {
        console.error('Error importing grid:', error)
        resolve({ status: 'error', error: 'Failed to read or parse the grid file.' })
      }
    }

    input.click()
  })
}
