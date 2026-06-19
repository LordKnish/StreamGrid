import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { App } from './App'
import { theme } from './theme'
import { useStreamStore } from './store/useStreamStore'

// Expose store to window for debugging/devtools access
declare global {
  interface Window {
    streamStore: typeof useStreamStore
  }
}
window.streamStore = useStreamStore

// Handle structured commands from the main-process REST API server.
// Replaces the previous executeJavaScript bridge: main sends a typed action,
// the renderer runs the matching store operation and returns data only.
window.api.onApiCommand(async (action, payload) => {
  const store = useStreamStore.getState()
  switch (action) {
    case 'getStreams':
      return store.streams
    case 'addStream':
      store.addStream(payload as Parameters<typeof store.addStream>[0])
      return true
    case 'updateStream': {
      const { id, updates } = payload as {
        id: string
        updates: Parameters<typeof store.updateStream>[1]
      }
      store.updateStream(id, updates)
      return true
    }
    case 'removeStream': {
      const { id } = payload as { id: string }
      store.removeStream(id)
      return true
    }
    case 'getAllGrids':
      return window.api.getAllGrids()
    case 'saveGrid':
      await window.api.saveGrid(payload as Parameters<typeof window.api.saveGrid>[0])
      return true
    case 'loadGrid': {
      const { id } = payload as { id: string }
      await store.loadGrid(id)
      return true
    }
    default:
      throw new Error(`Unknown API command: ${action}`)
  }
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
)
