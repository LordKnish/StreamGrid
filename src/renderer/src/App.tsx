import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Menu,
  MenuItem,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  IconButton,
  Tooltip
} from '@mui/material'
import { Add, GitHub, VolumeOff, VolumeUp, Settings } from '@mui/icons-material'
import StreamGridLogo from './assets/StreamGrid.svg'
import { v4 as uuidv4 } from 'uuid'
import { StreamGrid } from './components/StreamGrid'
import { AddStreamDialog } from './components/AddStreamDialog'
import { GridSelector } from './components/GridSelector'
import { GridManagementDialog } from './components/GridManagementDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { useDebouncedStore } from './hooks/useDebouncedStore'
import { Stream, StreamFormData } from './types/stream'
import { LoadingScreen } from './components/LoadingScreen'
import { UpdateAlert } from './components/UpdateAlert'
import { useStreamStore } from './store/useStreamStore'

export const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [aboutAnchorEl, setAboutAnchorEl] = useState<null | HTMLElement>(null)
  const [newGridDialogOpen, setNewGridDialogOpen] = useState(false)
  const [newGridName, setNewGridName] = useState('')
  const [gridManagementOpen, setGridManagementOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const autoStartTriggeredRef = useRef(false)

  const {
    streams,
    layout,
    chats,
    addStream,
    removeStream,
    updateLayout,
    updateStream,
    addChat,
    removeChat,
    removeChatsForStream,
    createNewGrid,
    saveNow,
    hasUnsavedChanges
  } = useDebouncedStore({
    layoutDebounceMs: 300,
    saveDebounceMs: 5000, // 5 seconds instead of 1 second
    streamUpdateDebounceMs: 500
  })

  const { settings, toggleGlobalMute } = useStreamStore()
  const [editingStream, setEditingStream] = useState<Stream | undefined>(undefined)

  // Define all callbacks before any conditional returns
  const handleGlobalMuteToggle = useCallback(() => {
    toggleGlobalMute()
  }, [toggleGlobalMute])

  // Auto-start streams on launch
  useEffect(() => {
    if (!autoStartTriggeredRef.current && settings.autoStartOnLaunch && streams.length > 0) {
      autoStartTriggeredRef.current = true

      const delay = settings.autoStartDelay * 1000
      console.log(`Auto-starting ${streams.length} streams in ${settings.autoStartDelay} seconds...`)

      setTimeout(() => {
        // Trigger play on all streams by dispatching custom event
        const event = new CustomEvent('auto-start-streams')
        window.dispatchEvent(event)
        console.log('Auto-start triggered for all streams')
      }, delay)
    }
  }, [settings.autoStartOnLaunch, settings.autoStartDelay, streams.length])

  useEffect(() => {
    // Set loading to false immediately as resources are already loaded
    setIsLoading(false)

    // Save on window close/refresh
    const handleBeforeUnload = async (e: BeforeUnloadEvent): Promise<void> => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
        await saveNow()
      }
    }

    // Listen for app quit event from main process
    const handleAppQuit = async (): Promise<void> => {
      if (hasUnsavedChanges) {
        await saveNow()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    // Add IPC listener for app quit (with safety check)
    let removeQuitListener: (() => void) | undefined
    if (window.api?.onAppBeforeQuit) {
      removeQuitListener = window.api.onAppBeforeQuit(handleAppQuit)
    }

    return (): void => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (removeQuitListener) {
        removeQuitListener()
      }
    }
  }, [hasUnsavedChanges, saveNow])

  // Define all event handlers before conditional return
  const handleAddStream = useCallback(async (data: StreamFormData): Promise<void> => {
    const newStream: Stream = {
      id: uuidv4(),
      name: data.name,
      logoUrl: data.logoUrl,
      streamUrl: data.streamUrl,
      isMuted: data.startMuted,
      isLivestream:
        data.streamUrl.includes('twitch.tv') ||
        data.streamUrl.includes('youtube.com/live') ||
        data.streamUrl.includes('youtube.com/@') ||
        data.streamUrl.includes('youtu.be/live')
    }
    addStream(newStream)
    // Save immediately after adding a stream
    await saveNow()
  }, [addStream, saveNow])

  const handleRemoveStream = useCallback(async (id: string): Promise<void> => {
    removeChatsForStream(id)
    removeStream(id)
    // Save immediately after removing a stream
    await saveNow()
  }, [removeChatsForStream, removeStream, saveNow])

  const handleEditStream = useCallback((stream: Stream): void => {
    setEditingStream(stream)
    setIsAddDialogOpen(true)
  }, [])

  const handleUpdateStream = useCallback(async (id: string, data: StreamFormData): Promise<void> => {
    const updates: Partial<Stream> = {
      name: data.name,
      logoUrl: data.logoUrl,
      streamUrl: data.streamUrl
    }

    // Only update isMuted if startMuted is defined
    if (data.startMuted !== undefined) {
      updates.isMuted = data.startMuted
    }

    updateStream(id, updates)
    // Save immediately after updating a stream
    await saveNow()
  }, [updateStream, saveNow])

  // Auto-save is now handled by the debounced store
  // No need for manual auto-save implementation here

  if (isLoading) {
    return <LoadingScreen />
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

          <GridSelector
            onNewGrid={() => setNewGridDialogOpen(true)}
            onManageGrids={() => setGridManagementOpen(true)}
          />

          <Box sx={{ mx: 1 }} />

          {/* Global Mute Button */}
          <Tooltip title={settings.globalMuted ? 'Unmute All Streams' : 'Mute All Streams'}>
            <IconButton
              onClick={handleGlobalMuteToggle}
              sx={{
                color: settings.globalMuted ? 'error.main' : 'text.primary',
                backgroundColor: settings.globalMuted ? 'rgba(211, 47, 47, 0.1)' : 'transparent',
                '&:hover': {
                  backgroundColor: settings.globalMuted ? 'rgba(211, 47, 47, 0.2)' : 'action.hover'
                }
              }}
            >
              {settings.globalMuted ? <VolumeOff /> : <VolumeUp />}
            </IconButton>
          </Tooltip>

          {/* Settings Button */}
          <Tooltip title="Settings">
            <IconButton
              onClick={() => setSettingsOpen(true)}
              sx={{
                color: 'text.primary',
                '&:hover': {
                  backgroundColor: 'action.hover'
                }
              }}
            >
              <Settings />
            </IconButton>
          </Tooltip>

          <Box sx={{ mx: 1 }} />

          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setIsAddDialogOpen(true)}
            sx={{
              textTransform: 'none',
              px: 2,
              borderRadius: 1
            }}
          >
            Add Stream
          </Button>

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
                  Created by Bernard Moerdler - v{window.api?.version || '2.0.0'}
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
          onLayoutChange={async (newLayout) => {
            updateLayout(newLayout)
            // Save immediately after layout change (stream movement)
            await saveNow()
          }}
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

      <Dialog
        open={newGridDialogOpen}
        onClose={() => {
          setNewGridDialogOpen(false)
          setNewGridName('')
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Create New Grid</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Grid Name"
            fullWidth
            variant="outlined"
            value={newGridName}
            onChange={(e) => setNewGridName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && newGridName.trim()) {
                createNewGrid(newGridName.trim())
                setNewGridDialogOpen(false)
                setNewGridName('')
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setNewGridDialogOpen(false)
            setNewGridName('')
          }}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (newGridName.trim()) {
                createNewGrid(newGridName.trim())
                setNewGridDialogOpen(false)
                setNewGridName('')
              }
            }}
            variant="contained"
            disabled={!newGridName.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <GridManagementDialog
        open={gridManagementOpen}
        onClose={() => setGridManagementOpen(false)}
      />

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </Box>
  )
}
