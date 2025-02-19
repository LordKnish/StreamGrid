import React, { useState, useEffect } from 'react'
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  Link
} from '@mui/material'
import { Add, KeyboardArrowDown, GitHub } from '@mui/icons-material'
import StreamGridLogo from './assets/StreamGrid.svg'
import { v4 as uuidv4 } from 'uuid'
import { StreamGrid } from './components/StreamGrid'
import { AddStreamDialog } from './components/AddStreamDialog'
import { useStreamStore } from './store/useStreamStore'
import { Stream, StreamFormData } from './types/stream'
import { LoadingScreen } from './components/LoadingScreen'
import { UpdateAlert } from './components/UpdateAlert'

export const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [aboutAnchorEl, setAboutAnchorEl] = useState<null | HTMLElement>(null)
  const {
    streams,
    layout,
    chats,
    addStream,
    removeStream,
    updateLayout,
    importStreams,
    updateStream,
    addChat,
    removeChat,
    removeChatsForStream
  } = useStreamStore()
  const [editingStream, setEditingStream] = useState<Stream | undefined>(undefined)

  useEffect((): (() => void) => {
    // Simulate loading time to ensure all resources are properly loaded
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return <LoadingScreen />
  }

  const handleAddStream = (data: StreamFormData): void => {
    const newStream: Stream = {
      id: uuidv4(),
      ...data,
      isLivestream:
        data.streamUrl.includes('twitch.tv') ||
        data.streamUrl.includes('youtube.com/live') ||
        data.streamUrl.includes('youtube.com/@') ||
        data.streamUrl.includes('youtu.be/live')
    }
    addStream(newStream)
  }

  const handleRemoveStream = (id: string): void => {
    removeChatsForStream(id)
    removeStream(id)
  }

  const handleEditStream = (stream: Stream): void => {
    setEditingStream(stream)
    setIsAddDialogOpen(true)
  }

  const handleUpdateStream = (id: string, data: StreamFormData): void => {
    updateStream(id, data)
  }

  const handleImport = (): void => {
    setMenuAnchorEl(null)
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e: Event): Promise<void> => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e): void => {
          try {
            const content = JSON.parse(e.target?.result as string)
            const result = importStreams(content)
            if (!result.success) {
              console.error('Import failed:', result.error)
            }
          } catch (error) {
            console.error('Error importing file:', error)
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  const handleExport = (): void => {
    setMenuAnchorEl(null)
    const data = useStreamStore.getState().exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'stream-config.json'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <UpdateAlert />
      <AppBar position="static" elevation={0}>
        <Toolbar sx={{ backgroundColor: 'background.paper' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
            <Box
              onClick={(e) => setAboutAnchorEl(e.currentTarget)}
              sx={{
                width: '32px',
                height: '32px',
                display: 'flex',
                userSelect: 'none',
                alignItems: 'center',
                cursor: 'pointer',
                '& img': {
                  width: '100%',
                  height: '100%'
                }
              }}
            >
              <img src={StreamGridLogo} alt="StreamGrid Logo" />
            </Box>
            <Typography
              variant="h6"
              component="div"
              onClick={(e) => setAboutAnchorEl(e.currentTarget)}
              sx={{
                color: 'text.primary',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              StreamGrid
            </Typography>
          </Box>
          <ButtonGroup variant="contained" sx={{ borderRadius: 1 }}>
            <Button
              startIcon={<Add />}
              onClick={() => setIsAddDialogOpen(true)}
              sx={{
                textTransform: 'none',
                px: 2
              }}
            >
              Add Stream
            </Button>
            <Button
              size="small"
              onClick={(e) => setMenuAnchorEl(e.currentTarget)}
              sx={{
                px: 0.5,
                minWidth: '36px',
                borderLeft: '1px solid rgba(255, 255, 255, 0.3)'
              }}
            >
              <KeyboardArrowDown />
            </Button>
          </ButtonGroup>
          <Menu
            anchorEl={menuAnchorEl}
            open={Boolean(menuAnchorEl)}
            onClose={() => setMenuAnchorEl(null)}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right'
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right'
            }}
          >
            <MenuItem onClick={handleImport}>Import JSON</MenuItem>
            <MenuItem onClick={handleExport}>Export JSON</MenuItem>
          </Menu>

          <Menu
            anchorEl={aboutAnchorEl}
            open={Boolean(aboutAnchorEl)}
            onClose={() => setAboutAnchorEl(null)}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left'
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left'
            }}
          >
            <MenuItem>
              <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 200 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  About StreamGrid
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Created by Bernard Moerdler {window.api.version}
                </Typography>
                <Link
                  href="https://github.com/LordKnish/StreamGrid"
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mt: 2,
                    color: 'primary.main',
                    textDecoration: 'none'
                  }}
                >
                  <GitHub fontSize="small" />
                  Visit GitHub
                </Link>
              </Box>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <StreamGrid
          streams={streams}
          layout={layout}
          chats={chats}
          onRemoveStream={handleRemoveStream}
          onLayoutChange={updateLayout}
          onEditStream={handleEditStream}
          onAddChat={addChat}
          onRemoveChat={removeChat}
        />
      </Box>

      <AddStreamDialog
        open={isAddDialogOpen}
        onClose={() => {
          setIsAddDialogOpen(false)
          setEditingStream(undefined)
        }}
        onAdd={handleAddStream}
        onEdit={handleUpdateStream}
        editStream={editingStream}
      />
    </Box>
  )
}
