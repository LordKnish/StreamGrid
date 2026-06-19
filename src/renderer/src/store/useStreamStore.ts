import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'
import { Stream, GridItem, AppSettings } from '../types/stream'
import { validateImportData } from './streamSelectors'
import { SavedGrid } from '../types/grid'

const GRID_COLS = 24
const TARGET_ASPECT = 16 / 9 // 16:9 video tiles

/**
 * Live grid geometry pushed from <StreamGrid> so layout math can fit the real
 * window. `rowHeight`/`columnWidth` are the pixel size of one grid cell; `rows`
 * is how many cell-rows fit in the visible canvas (the no-scroll budget).
 */
export type GridViewport = {
  cols: number
  rowHeight: number
  columnWidth: number
  rows: number
}

/** Split `total` into `parts` integers that sum to exactly `total` (remainder
 *  spread across the first cells), so a row/column track fills with no gaps. */
function distribute(total: number, parts: number): number[] {
  const base = Math.floor(total / parts)
  const rem = total - base * parts
  return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0))
}

/**
 * Arrange N tiles to completely FILL the visible grid — every tile stretches so
 * there are no gaps or letterboxing between tiles (the video itself keeps its
 * aspect via each card's fit mode). This is the video-wall "justified grid".
 *
 * Step 1 — pick the row/column split. We brute-force the per-row column count
 * c = 1..min(N, cols); rows = ceil(N/c). When the tiles are stretched to fill
 * the canvas, one tile is about `(cols/c) × (rowBudget/rows)` cells, whose pixel
 * aspect is `((cols·rows)/(c·rowBudget)) · cellAspect`. We choose the split whose
 * filled-tile aspect is closest to 16:9 (log distance), tie-broken by fewer
 * empty trailing cells, a balanced grid, then a landscape bias.
 *
 * Step 2 — fill. Row heights are `distribute(rowBudget, rows)` so they sum to the
 * full canvas height; each row's tiles get `distribute(cols, itemsInRow)` so they
 * sum to the full width. A short last row stretches across the whole width. The
 * result tiles the entire canvas exactly, with no scroll.
 */
function computeLayout(ids: string[], vp?: GridViewport | null): GridItem[] {
  const n = ids.length
  if (n === 0) return []

  const cols = vp?.cols && vp.cols > 0 ? vp.cols : GRID_COLS
  const rowBudget = vp?.rows && vp.rows > 0 ? vp.rows : cols
  // Pixel aspect of a single grid cell (columnWidth : rowHeight). Defaults to
  // 16:9 (a cell is one 16:9 unit) before real geometry is known.
  const cellAspect =
    vp && vp.rowHeight > 0 && vp.columnWidth > 0 ? vp.columnWidth / vp.rowHeight : TARGET_ASPECT

  type Cand = { c: number; rows: number; distortion: number; empty: number; balance: number }
  const EPS = 1e-6

  // Smaller aspect distortion wins; then fewer empty cells; then squarer grid;
  // then a slight landscape preference (more columns).
  const better = (a: Cand, b: Cand): boolean => {
    if (Math.abs(a.distortion - b.distortion) > EPS) return a.distortion < b.distortion
    if (a.empty !== b.empty) return a.empty < b.empty
    if (a.balance !== b.balance) return a.balance < b.balance
    return a.c > b.c
  }

  let best: Cand | null = null
  for (let c = 1; c <= Math.min(n, cols); c++) {
    const rows = Math.ceil(n / c)
    const tileAspect = ((cols * rows) / (c * rowBudget)) * cellAspect
    const cand: Cand = {
      c,
      rows,
      distortion: Math.abs(Math.log(tileAspect / TARGET_ASPECT)),
      empty: c * rows - n,
      balance: Math.abs(c - rows)
    }
    if (!best || better(cand, best)) best = cand
  }
  if (!best) return []

  const { c, rows } = best
  // Heights that fill the canvas when it fits; otherwise keep tiles ~16:9 and
  // allow vertical scroll (too many tiles for the window).
  const rowHeights =
    rowBudget >= rows
      ? distribute(rowBudget, rows)
      : Array.from({ length: rows }, () =>
          Math.max(1, Math.round((cols / c) / cellAspect))
        )

  const res: GridItem[] = []
  let idx = 0
  let y = 0
  for (let r = 0; r < rows && idx < n; r++) {
    const itemsInRow = Math.min(c, n - idx)
    const colWidths = distribute(cols, itemsInRow)
    let x = 0
    for (let j = 0; j < itemsInRow; j++, idx++) {
      res.push({ i: ids[idx], x, y, w: colWidths[j], h: rowHeights[r] })
      x += colWidths[j]
    }
    y += rowHeights[r]
  }
  return res
}

export interface ChatItem {
  id: string
  streamId: string
  streamType: string
  streamName: string
  streamIdentifier: string
}

interface StreamStore {
  streams: Stream[]
  layout: GridItem[]
  chats: ChatItem[]
  lastDraggedId: string | null
  settings: AppSettings
  gridViewport: GridViewport | null
  // Grid management
  currentGridId: string | null
  currentGridName: string
  hasUnsavedChanges: boolean
  recentGridIds: string[]
  isSaving: boolean
  // Core stream methods
  setLastDraggedId: (id: string | null) => void
  addStream: (stream: Stream) => void
  addMultipleStreams: (streams: Stream[]) => void
  removeStream: (id: string) => void
  updateStream: (id: string, updates: Partial<Stream>) => void
  updateLayout: (newLayout: GridItem[]) => void
  importStreams: (data: unknown) => { success: boolean; error?: string }
  exportData: () => {
    streams: Stream[]
    layout: GridItem[]
    chats: ChatItem[]
  }
  batchUpdate: (updates: Partial<{ streams: Stream[]; layout: GridItem[] }>) => void
  addChat: (streamIdentifier: string, streamId: string, streamName: string) => string
  removeChat: (id: string) => void
  removeChatsForStream: (streamId: string) => void
  // Settings methods
  updateSettings: (updates: Partial<AppSettings>) => void
  toggleGlobalMute: () => void
  muteAllStreams: () => void
  unmuteAllStreams: () => void
  autoArrangeStreams: () => void
  setGridViewport: (viewport: GridViewport) => void
  // Grid management methods
  saveCurrentGrid: (name?: string) => Promise<SavedGrid>
  loadGrid: (gridId: string) => Promise<void>
  deleteGrid: (gridId: string) => Promise<void>
  renameGrid: (gridId: string, newName: string) => Promise<void>
  createNewGrid: (name: string) => void
  setCurrentGridName: (name: string) => void
  markAsUnsaved: () => void
  markAsSaved: () => void
  updateRecentGrids: (gridId: string) => void
}

const createInitialState = (): {
  streams: Stream[]
  layout: GridItem[]
  chats: ChatItem[]
  lastDraggedId: string | null
  settings: AppSettings
  gridViewport: GridViewport | null
  currentGridId: string | null
  currentGridName: string
  hasUnsavedChanges: boolean
  recentGridIds: string[]
  isSaving: boolean
} => ({
  streams: [],
  layout: [],
  chats: [],
  lastDraggedId: null,
  gridViewport: null,
  settings: {
    defaultMuteNewStreams: false,
    globalMuted: false,
    autoStartOnLaunch: false,
    autoStartDelay: 0,
    apiEnabled: false,
    apiPort: 3737,
    apiKey: ''
  },
  currentGridId: null,
  currentGridName: 'Untitled Grid',
  hasUnsavedChanges: false,
  recentGridIds: [],
  isSaving: false
})

export const useStreamStore = create<StreamStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...createInitialState(),

        batchUpdate: (updates): void => {
          set(
            (state) => ({
              ...state,
              ...updates
            }),
            false,
            'BATCH_UPDATE'
          )
        },

        addStream: (stream): void =>
          set(
            (state) => {
              const streamWithMute = {
                ...stream,
                isMuted: stream.isMuted !== undefined ? stream.isMuted : state.settings.defaultMuteNewStreams
              }
              const streams = [...state.streams, streamWithMute]
              const ids = [...streams.map(s => s.id), ...state.chats.map(c => c.id)]
              const layout = computeLayout(ids, state.gridViewport)
              return { streams, layout, hasUnsavedChanges: true }
            },
            false,
            'ADD_STREAM'
          ),

        addMultipleStreams: (streams): void =>
          set(
            (state) => {
              const streamsWithMute = streams.map(stream => ({
                ...stream,
                isMuted: stream.isMuted !== undefined ? stream.isMuted : state.settings.defaultMuteNewStreams
              }))

              const allStreams = [...state.streams, ...streamsWithMute]
              const allIds = [...allStreams.map(s => s.id), ...state.chats.map(c => c.id)]
              const allLayouts = computeLayout(allIds, state.gridViewport)

              return {
                streams: allStreams,
                layout: allLayouts,
                hasUnsavedChanges: true
              }
            },
            false,
            'ADD_MULTIPLE_STREAMS'
          ),

        removeStream: (id): void =>
          set(
            (state) => {
              // Remove stream and its layout
              return {
                streams: state.streams.filter((stream) => stream.id !== id),
                layout: state.layout.filter((item) => item.i !== id),
                // Also remove any associated chats
                chats: state.chats.filter((chat) => chat.streamId !== id),
                hasUnsavedChanges: true
              }
            },
            false,
            'REMOVE_STREAM'
          ),

        updateStream: (id, updates): void =>
          set(
            (state) => ({
              streams: state.streams.map((stream) =>
                stream.id === id ? { ...stream, ...updates } : stream
              ),
              // Update stream name in chats if it changed
              chats: updates.name
                ? state.chats.map((chat) =>
                    chat.streamId === id ? { ...chat, streamName: updates.name! } : chat
                  )
                : state.chats,
              hasUnsavedChanges: true
            }),
            false,
            'UPDATE_STREAM'
          ),

        setLastDraggedId: (id): void => set({ lastDraggedId: id }, false, 'SET_LAST_DRAGGED_ID'),

        updateLayout: (newLayout): void => {
          set({ layout: newLayout, hasUnsavedChanges: true }, false, 'UPDATE_LAYOUT')
        },

        importStreams: (data): { success: boolean; error?: string } => {
          const validation = validateImportData(data)
          if (!validation.isValid) {
            return { success: false, error: validation.error }
          }

          const { streams, layout, chats } = data as {
            streams: Stream[]
            layout: GridItem[]
            chats?: ChatItem[]
          }
          set({ streams, layout, chats: chats || [] }, false, 'IMPORT_STREAMS')
          return { success: true }
        },

        addChat: (streamIdentifier, streamId, streamName): string => {
          const id = `chat-${Date.now()}`
          const stream = get().streams.find((s) => s.id === streamId)
          if (!stream) return id

          const streamType =
            stream.streamUrl.includes('youtube.com') || stream.streamUrl.includes('youtu.be')
              ? 'YouTube'
              : stream.streamUrl.includes('twitch.tv')
                ? 'Twitch'
                : ''

          if (!streamType) return id

          set(
            (state) => {
              const chats = [...state.chats, { id, streamId, streamType, streamName, streamIdentifier }]
              const ids = [...state.streams.map(s => s.id), ...chats.map(c => c.id)]
              const layout = computeLayout(ids, state.gridViewport)
              return { chats, layout, hasUnsavedChanges: true }
            },
            false,
            'ADD_CHAT'
          )
          return id
        },

        removeChat: (id): void =>
          set(
            (state) => ({
              chats: state.chats.filter((chat) => chat.id !== id),
              layout: state.layout.filter((item) => item.i !== id),
              hasUnsavedChanges: true
            }),
            false,
            'REMOVE_CHAT'
          ),

        removeChatsForStream: (streamId): void =>
          set(
            (state) => ({
              chats: state.chats.filter((chat) => chat.streamId !== streamId),
              layout: state.layout.filter(
                (item) =>
                  !state.chats.find((chat) => chat.streamId === streamId && chat.id === item.i)
              ),
              hasUnsavedChanges: true
            }),
            false,
            'REMOVE_CHATS_FOR_STREAM'
          ),

        exportData: (): {
          streams: Stream[]
          layout: GridItem[]
          chats: ChatItem[]
        } => {
          const { streams, layout, chats } = get()
          return { streams, layout, chats }
        },

        // Settings methods
        updateSettings: (updates): void =>
          set(
            (state) => ({
              settings: { ...state.settings, ...updates }
            }),
            false,
            'UPDATE_SETTINGS'
          ),

        toggleGlobalMute: (): void =>
          set(
            (state) => {
              const newGlobalMuted = !state.settings.globalMuted
              return {
                settings: { ...state.settings, globalMuted: newGlobalMuted },
                // Update all streams to match global mute state
                streams: state.streams.map(stream => ({
                  ...stream,
                  isMuted: newGlobalMuted
                }))
              }
            },
            false,
            'TOGGLE_GLOBAL_MUTE'
          ),

        muteAllStreams: (): void =>
          set(
            (state) => ({
              streams: state.streams.map(stream => ({ ...stream, isMuted: true })),
              settings: { ...state.settings, globalMuted: true }
            }),
            false,
            'MUTE_ALL_STREAMS'
          ),

        unmuteAllStreams: (): void =>
          set(
            (state) => ({
              streams: state.streams.map(stream => ({ ...stream, isMuted: false })),
              settings: { ...state.settings, globalMuted: false }
            }),
            false,
            'UNMUTE_ALL_STREAMS'
          ),

        autoArrangeStreams: (): void =>
          set(
            (state) => {
              const allItems = [...state.streams, ...state.chats]
              if (allItems.length === 0) return state

              // Stable order: streams first by insertion, then chats by insertion
              const ids = allItems.map(it => it.id)
              const newLayout = computeLayout(ids, state.gridViewport)

              return { layout: newLayout, hasUnsavedChanges: true }
            },
            false,
            'AUTO_ARRANGE_STREAMS'
          ),

        setGridViewport: (viewport): void =>
          set({ gridViewport: viewport }, false, 'SET_GRID_VIEWPORT'),

        // Grid management methods
        saveCurrentGrid: async (name?: string): Promise<SavedGrid> => {
          set({ isSaving: true }, false, 'START_SAVING')

          try {
            const state = get()
            // If name is provided, always create a new grid (Save As)
            const isNewGrid = !state.currentGridId || !!name
            const gridId = name ? `grid-${Date.now()}` : (state.currentGridId || `grid-${Date.now()}`)
            const gridName = name || state.currentGridName

            // Get existing grid's createdAt if updating
            let createdAt = new Date().toISOString()
            if (!isNewGrid && state.currentGridId) {
              try {
                const existingGrid = await window.api.loadGrid(state.currentGridId)
                if (existingGrid) {
                  createdAt = existingGrid.createdAt
                }
              } catch (error) {
                // If we can't load the existing grid, use current time
              }
            }

            const savedGrid: SavedGrid = {
              id: gridId,
              name: gridName,
              createdAt: createdAt,
              lastModified: new Date().toISOString(),
              streams: state.streams,
              layout: state.layout,
              chats: state.chats
            }

            // Save via IPC
            await window.api.saveGrid(savedGrid)

            set({
              currentGridId: gridId,
              currentGridName: gridName,
              hasUnsavedChanges: false,
              isSaving: false
            }, false, 'SAVE_GRID')

            get().updateRecentGrids(gridId)

            return savedGrid
          } catch (error) {
            set({ isSaving: false }, false, 'SAVE_ERROR')
            throw error
          }
        },

        loadGrid: async (gridId: string): Promise<void> => {
          const grid = await window.api.loadGrid(gridId)
          if (grid) {
            set({
              streams: grid.streams,
              layout: grid.layout,
              chats: grid.chats,
              currentGridId: grid.id,
              currentGridName: grid.name,
              hasUnsavedChanges: false
            }, false, 'LOAD_GRID')

            get().updateRecentGrids(gridId)
          }
        },

        deleteGrid: async (gridId: string): Promise<void> => {
          await window.api.deleteGrid(gridId)
          const state = get()

          if (state.currentGridId === gridId) {
            // Reset to empty grid if deleting current
            set({
              ...createInitialState(),
              gridViewport: state.gridViewport,
              recentGridIds: state.recentGridIds.filter(id => id !== gridId)
            }, false, 'DELETE_GRID')
          } else {
            set({
              recentGridIds: state.recentGridIds.filter(id => id !== gridId)
            }, false, 'UPDATE_RECENT_GRIDS')
          }
        },

        renameGrid: async (gridId: string, newName: string): Promise<void> => {
          await window.api.renameGrid(gridId, newName)
          const state = get()

          if (state.currentGridId === gridId) {
            set({ currentGridName: newName }, false, 'RENAME_GRID')
          }
        },

        createNewGrid: (name: string): void => {
          set({
            ...createInitialState(),
            currentGridName: name,
            gridViewport: get().gridViewport,
            recentGridIds: get().recentGridIds
          }, false, 'CREATE_NEW_GRID')
        },

        setCurrentGridName: (name: string): void => {
          set({ currentGridName: name }, false, 'SET_GRID_NAME')
        },

        markAsUnsaved: (): void => {
          set({ hasUnsavedChanges: true }, false, 'MARK_UNSAVED')
        },

        markAsSaved: (): void => {
          set({ hasUnsavedChanges: false }, false, 'MARK_SAVED')
        },

        updateRecentGrids: (gridId: string): void => {
          set((state) => {
            const filtered = state.recentGridIds.filter(id => id !== gridId)
            return {
              recentGridIds: [gridId, ...filtered].slice(0, 5)
            }
          }, false, 'UPDATE_RECENT_GRIDS')
        }
      }),
      {
        name: 'stream-grid-storage',
        version: 2, // Increment version for settings addition
        partialize: (state) => ({
          // Only persist these fields
          streams: state.streams,
          layout: state.layout,
          chats: state.chats,
          settings: state.settings,
          currentGridId: state.currentGridId,
          currentGridName: state.currentGridName,
          recentGridIds: state.recentGridIds,
          // Explicitly exclude transient states:
          // hasUnsavedChanges, isSaving, lastDraggedId
        })
      }
    )
  )
)
