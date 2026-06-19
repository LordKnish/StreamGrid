import { useState, useEffect, useCallback } from 'react'
import { useStreamStore } from '../store/useStreamStore'

export interface GridSummary {
  id: string
  name: string
  lastModified: string
  streamCount: number
}

export interface UseGrids {
  /** All saved grids, stable alphabetical order, with the unsaved current grid surfaced if needed. */
  grids: GridSummary[]
  currentGridId: string | null
  currentGridName: string
  hasUnsavedChanges: boolean
  isSaving: boolean
  refresh: () => Promise<void>
  /** Switch to a grid, transparently saving the current one first. No-op if already active. */
  switchToGrid: (id: string) => Promise<void>
}

/** Sentinel id for a freshly created grid that has not been saved yet. */
export const UNSAVED_GRID_ID = '__unsaved__'

/** Event name fired whenever the saved-grid set changes (rename/duplicate/delete/import). */
export const GRIDS_CHANGED_EVENT = 'grids-changed'

/** Notify all useGrids() consumers that the saved-grid set changed. */
export function notifyGridsChanged(): void {
  window.dispatchEvent(new CustomEvent(GRIDS_CHANGED_EVENT))
}

export function useGrids(): UseGrids {
  const {
    currentGridId,
    currentGridName,
    hasUnsavedChanges,
    isSaving,
    recentGridIds,
    streams,
    loadGrid,
    saveCurrentGrid
  } = useStreamStore()

  const [saved, setSaved] = useState<GridSummary[]>([])

  const refresh = useCallback(async (): Promise<void> => {
    if (!window.api?.getAllGrids) return
    try {
      const all = await window.api.getAllGrids()
      // Stable order so tabs never reshuffle when a grid is saved.
      all.sort((a, b) => a.name.localeCompare(b.name))
      setSaved(all)
    } catch (error) {
      console.error('Error loading grids:', error)
    }
  }, [])

  // Re-fetch whenever grid identity or persistence state changes.
  useEffect(() => {
    refresh()
  }, [refresh, currentGridId, currentGridName, isSaving, recentGridIds.length])

  // Re-fetch when any view mutates the saved-grid set (rename/duplicate/delete/import).
  useEffect(() => {
    const handler = (): void => {
      refresh()
    }
    window.addEventListener(GRIDS_CHANGED_EVENT, handler)
    return (): void => window.removeEventListener(GRIDS_CHANGED_EVENT, handler)
  }, [refresh])

  // Surface the current grid as a tab even before its first save.
  const isCurrentSaved = currentGridId !== null && saved.some((g) => g.id === currentGridId)
  const grids: GridSummary[] = isCurrentSaved
    ? saved
    : [
        {
          id: currentGridId ?? UNSAVED_GRID_ID,
          name: currentGridName,
          lastModified: new Date(0).toISOString(),
          streamCount: streams.length
        },
        ...saved
      ]

  const switchToGrid = useCallback(
    async (id: string): Promise<void> => {
      if (id === currentGridId || id === UNSAVED_GRID_ID) return
      if (hasUnsavedChanges) {
        try {
          await saveCurrentGrid()
        } catch (error) {
          console.error('Error saving current grid:', error)
          const ok = confirm('Failed to save the current grid. Switch anyway and lose changes?')
          if (!ok) return
        }
      }
      try {
        await loadGrid(id)
      } catch (error) {
        console.error('Error loading grid:', error)
      }
    },
    [currentGridId, hasUnsavedChanges, saveCurrentGrid, loadGrid]
  )

  return {
    grids,
    currentGridId,
    currentGridName,
    hasUnsavedChanges,
    isSaving,
    refresh,
    switchToGrid
  }
}
