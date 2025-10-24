import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'
import { Stream, GridItem, AppSettings } from '../types/stream'
import { validateImportData } from './streamSelectors'
import { SavedGrid } from '../types/grid'

// Pure integer grid layout helper - no viewport math, no fractional units
const GRID_COLS = 24
const TARGET_ASPECT = 16 / 9

type LayoutOpts = {
  allowedWidths?: number[]
  preferLargerTiles?: boolean
  maxRows?: number // budget in integer grid rows. default 24.
}

function chooseLayouts(
  ids: string[],
  opts?: LayoutOpts
): GridItem[] {
  const allowed = opts?.allowedWidths ?? [12, 8, 6, 4, 3, 2] // divisors of 24
  const maxRows = opts?.maxRows ?? 24
  const n = ids.length

  type Cand = { w: number; h: number; cols: number; rows: number; waste: number; totalH: number; score: number }
  const feasible: Cand[] = []
  const all: Cand[] = []

  for (const w of allowed) {
    const cols = Math.floor(GRID_COLS / w)
    if (cols < 1) continue
    const rows = Math.ceil(n / cols)
    const h = Math.max(2, Math.round(w / TARGET_ASPECT)) // integer
    const totalH = rows * h
    const totalCells = cols * rows
    const waste = totalCells - n

    // scoring once it fits the height budget
    const sizeScore = w * h
    const wasteScore = 1 / (waste + 1)
    const balanceScore = 1 / (Math.abs(cols - rows) + 1)
    // penalize tall stacks even if under budget so 12×7 loses to 8×5 when both fit
    const heightPenalty = 1 / (totalH + 1)

    const score = sizeScore * 0.5 + wasteScore * 0.25 + balanceScore * 0.15 + heightPenalty * 0.10

    const c = { w, h, cols, rows, waste, totalH, score }
    all.push(c)
    if (totalH <= maxRows) feasible.push(c)
  }

  const pick = (list: Cand[]): Cand =>
    list.reduce((a, b) => (b.score > a.score ? b : a))

  // prefer any that fit the row budget; otherwise pick the smallest width to force-fit
  const best = feasible.length > 0
    ? pick(feasible)
    : pick(all.sort((a, b) => a.w - b.w))

  const res: GridItem[] = []
  let k = 0
  for (let r = 0; r < best.rows && k < n; r++) {
    const count = Math.min(best.cols, n - k)
    const offset = Math.floor((GRID_COLS - count * best.w) / 2)
    for (let c = 0; c < count && k < n; c++, k++) {
      res.push({
        i: ids[k],
        x: offset + c * best.w,
        y: r * best.h,
        w: best.w,
        h: best.h
      })
    }
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
              const layout = chooseLayouts(ids, { maxRows: 24 })
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
              const allIds = allStreams.map(s => s.id)
              const allLayouts = chooseLayouts(allIds, { maxRows: 24 })

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
              const layout = chooseLayouts(ids, { maxRows: 24 })
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
              const newLayout = chooseLayouts(ids, { maxRows: 24 })

              return { layout: newLayout, hasUnsavedChanges: true }
            },
            false,
            'AUTO_ARRANGE_STREAMS'
          ),

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
