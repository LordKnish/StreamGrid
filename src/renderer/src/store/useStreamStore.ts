import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'
import { Stream, GridItem } from '../types/stream'
import { validateImportData } from './streamSelectors'
import { SavedGrid } from '../types/grid'

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
  // Grid management
  currentGridId: string | null
  currentGridName: string
  hasUnsavedChanges: boolean
  recentGridIds: string[]
  isSaving: boolean
  // Core stream methods
  setLastDraggedId: (id: string | null) => void
  addStream: (stream: Stream) => void
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
              const newLayout: GridItem = {
                i: stream.id,
                x: (state.streams.length * 3) % 9,
                y: Math.floor(state.streams.length / 3) * 3,
                w: 3,
                h: 3
              }
              return {
                streams: [...state.streams, stream],
                layout: [...state.layout, newLayout],
                hasUnsavedChanges: true
              }
            },
            false,
            'ADD_STREAM'
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
              const newLayout: GridItem = {
                i: id,
                x: (state.layout.length * 3) % 9,
                y: Math.floor(state.layout.length / 3) * 3,
                w: 2,
                h: 3
              }
              return {
                chats: [...state.chats, { id, streamId, streamType, streamName, streamIdentifier }],
                layout: [...state.layout, newLayout],
                hasUnsavedChanges: true
              }
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
        version: 1,
        partialize: (state) => ({
          // Only persist these fields
          streams: state.streams,
          layout: state.layout,
          chats: state.chats,
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
