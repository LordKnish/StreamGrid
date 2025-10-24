import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material'
import { App } from './App'
import { useStreamStore } from './store/useStreamStore'

// Expose store to window for API server access
declare global {
  interface Window {
    streamStore: typeof useStreamStore
  }
}
window.streamStore = useStreamStore

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#2196f3'
    },
    background: {
      default: '#0a1929',
      paper: '#1a2027'
    }
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif'
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none'
        }
      }
    }
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
