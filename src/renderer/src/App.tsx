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
import { Add, GitHub, VolumeOff, VolumeUp, Settings, GridOn } from '@mui/icons-material'
import StreamGridLogo from './assets/StreamGrid-mark.svg'
import { tokens } from './theme'
import { v4 as uuidv4 } from 'uuid'
import { StreamGrid } from './components/StreamGrid'
import { AddStreamDialog } from './components/AddStreamDialog'
import { GridTabs } from './components/GridTabs'
import { GridQuickSwitcher } from './components/GridQuickSwitcher'
import { GridManagementDialog } from './components/GridManagementDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { AutoArrangeDialog } from './components/AutoArrangeDialog'
import { useDebouncedStore } from './hooks/useDebouncedStore'
import { useGrids } from './hooks/useGrids'
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
  const [autoArrangeDialogOpen, setAutoArrangeDialogOpen] = useState(false)
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false)
  const [ffmpegReady, setFfmpegReady] = useState(true)
  const autoStartTriggeredRef = useRef(false)

  const {
    streams,
    layout,
    chats,
    addStream,
    addMultipleStreams,
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

  const { settings, toggleGlobalMute, autoArrangeStreams } = useStreamStore()
  const { grids: gridList, currentGridId, switchToGrid } = useGrids()
  const [editingStream, setEditingStream] = useState<Stream | undefined>(undefined)

  // Global keyboard shortcuts for grid navigation.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return

      // Ctrl/Cmd+K toggles the quick switcher even while typing.
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setQuickSwitcherOpen((open) => !open)
        return
      }

      const target = e.target as HTMLElement | null
      const typing =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (typing) return

      const key = e.key.toLowerCase()
      if (key === 's') {
        e.preventDefault()
        saveNow().catch((err) => console.error('Save failed:', err))
      } else if (key === 'n') {
        e.preventDefault()
        setNewGridDialogOpen(true)
      } else if (e.key === 'Tab') {
        e.preventDefault()
        if (gridList.length < 2) return
        const idx = gridList.findIndex((g) => g.id === currentGridId)
        const base = idx === -1 ? 0 : idx
        const next = (base + (e.shiftKey ? -1 : 1) + gridList.length) % gridList.length
        switchToGrid(gridList[next].id)
      } else if (/^[1-9]$/.test(e.key)) {
        const targetGrid = gridList[parseInt(e.key, 10) - 1]
        if (targetGrid) {
          e.preventDefault()
          switchToGrid(targetGrid.id)
        }
      }
    }

    window.addEventListener('keydown', handleKey)
    return (): void => window.removeEventListener('keydown', handleKey)
  }, [gridList, currentGridId, switchToGrid, saveNow])

  // Reflect FFmpeg availability in the status bar (RTSP transcoding readiness).
  useEffect(() => {
    let cancelled = false
    window.api
      ?.rtspCheckFfmpeg?.()
      .then((res) => {
        if (!cancelled) setFfmpegReady(Boolean(res?.available))
      })
      .catch(() => {
        if (!cancelled) setFfmpegReady(false)
      })
    return (): void => {
      cancelled = true
    }
  }, [])

  // Define all callbacks before any conditional returns
  const handleGlobalMuteToggle = useCallback(() => {
    toggleGlobalMute()
  }, [toggleGlobalMute])

  const handleAutoArrange = useCallback(async () => {
    autoArrangeStreams()
    // Save immediately after auto-arrange
    await saveNow()
  }, [autoArrangeStreams, saveNow])

  // Auto-start streams on launch
  useEffect(() => {
    if (!autoStartTriggeredRef.current && settings.autoStartOnLaunch && streams.length > 0) {
      autoStartTriggeredRef.current = true

      const delay = settings.autoStartDelay * 1000
      console.log(
        `Auto-starting ${streams.length} streams in ${settings.autoStartDelay} seconds...`
      )

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
  const handleAddStream = useCallback(
    async (data: StreamFormData): Promise<void> => {
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
    },
    [addStream, saveNow]
  )

  const handleRemoveStream = useCallback(
    async (id: string): Promise<void> => {
      removeChatsForStream(id)
      removeStream(id)
      // Save immediately after removing a stream
      await saveNow()
    },
    [removeChatsForStream, removeStream, saveNow]
  )

  const handleEditStream = useCallback((stream: Stream): void => {
    setEditingStream(stream)
    setIsAddDialogOpen(true)
  }, [])

  const handleUpdateStream = useCallback(
    async (id: string, data: StreamFormData): Promise<void> => {
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
    },
    [updateStream, saveNow]
  )

  const handleAddMultipleStreams = useCallback(
    async (importedStreams: Stream[]): Promise<void> => {
      // Add all imported streams
      addMultipleStreams(importedStreams)

      // Save immediately after import
      await saveNow()
    },
    [addMultipleStreams, saveNow]
  )

  // Auto-save is now handled by the debounced store
  // No need for manual auto-save implementation here

  if (isLoading) {
    return <LoadingScreen />
  }

  // 34×34 glass icon button used for chrome actions in the app bar.
  const glassIconSx = {
    width: 34,
    height: 34,
    borderRadius: '9px',
    color: 'text.secondary',
    backgroundColor: tokens.glass,
    border: `1px solid ${tokens.border}`,
    transition: `background-color ${tokens.motion}, color ${tokens.motion}`,
    '&:hover': { backgroundColor: tokens.glassHi, color: 'text.primary' },
    '&.Mui-disabled': { color: 'action.disabled', backgroundColor: tokens.glass }
  } as const

  const activeGridName = gridList.find((g) => g.id === currentGridId)?.name ?? 'Unsaved grid'
  const feedCount = streams.length

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: 'background.default'
      }}
    >
      {/* Soft aurora backdrop — fixed full-bleed layer behind all chrome */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background: tokens.backdrop
        }}
      />
      <UpdateAlert />
      <AppBar position="static" elevation={0} sx={{ position: 'relative', zIndex: 2 }}>
        <Toolbar
          sx={{
            gap: 2,
            px: '22px',
            py: '13px',
            minHeight: 'unset'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.375, flexShrink: 0 }}>
            <Box
              onClick={(e) => setAboutAnchorEl(e.currentTarget)}
              sx={{
                width: '28px',
                height: '28px',
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
              component="div"
              onClick={(e) => setAboutAnchorEl(e.currentTarget)}
              sx={{
                color: 'text.primary',
                fontFamily: tokens.fontDisplay,
                fontWeight: 700,
                fontSize: '17px',
                letterSpacing: '-0.02em',
                cursor: 'pointer',
                display: { xs: 'none', sm: 'block' }
              }}
            >
              StreamGrid
            </Typography>
          </Box>

          <Box
            sx={{
              width: '1px',
              height: 20,
              backgroundColor: 'divider',
              flexShrink: 0
            }}
          />

          {/* Grid tabs (inline — no extra row) */}
          <GridTabs
            onNewGrid={() => setNewGridDialogOpen(true)}
            onManageGrids={() => setGridManagementOpen(true)}
          />

          {/* Global Mute toggle — glass pill, red-tinted when muted */}
          <Box
            role="button"
            aria-label={settings.globalMuted ? 'Unmute all streams' : 'Mute all streams'}
            onClick={handleGlobalMuteToggle}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              height: 34,
              px: 1.625,
              borderRadius: '10px',
              cursor: 'pointer',
              userSelect: 'none',
              flexShrink: 0,
              color: settings.globalMuted ? tokens.errorText : 'text.secondary',
              backgroundColor: settings.globalMuted ? 'rgba(255,107,129,0.12)' : tokens.glass,
              transition: `background-color ${tokens.motion}, color ${tokens.motion}`,
              '&:hover': {
                backgroundColor: settings.globalMuted ? 'rgba(255,107,129,0.18)' : tokens.glassHi
              }
            }}
          >
            {settings.globalMuted ? (
              <VolumeOff sx={{ fontSize: 18 }} />
            ) : (
              <VolumeUp sx={{ fontSize: 18 }} />
            )}
            <Typography
              sx={{ fontSize: '13px', fontWeight: 600, display: { xs: 'none', md: 'block' } }}
            >
              {settings.globalMuted ? 'Unmute' : 'Mute all'}
            </Typography>
          </Box>

          {/* Auto-Arrange Button */}
          <Tooltip title="Auto-arrange streams">
            <span>
              <IconButton
                onClick={() => setAutoArrangeDialogOpen(true)}
                disabled={streams.length === 0 && chats.length === 0}
                sx={glassIconSx}
              >
                <GridOn sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>

          {/* Settings Button */}
          <Tooltip title="Settings">
            <IconButton onClick={() => setSettingsOpen(true)} sx={glassIconSx}>
              <Settings sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setIsAddDialogOpen(true)}
            sx={{ flexShrink: 0 }}
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
                  Created by Bernard Moerdler - v{window.api?.version || '3.0.0'}
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

      <Box sx={{ flexGrow: 1, overflow: 'hidden', position: 'relative', zIndex: 1, minHeight: 0 }}>
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

      {/* ░░░ STATUS BAR ░░░ */}
      <Box
        component="footer"
        sx={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2.5,
          px: '22px',
          py: '9px',
          borderTop: `1px solid ${tokens.border}`,
          backgroundColor: 'rgba(11,10,18,0.6)',
          backdropFilter: 'blur(30px)',
          fontSize: '12px',
          fontWeight: 500,
          color: 'text.disabled'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875 }}>
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: ffmpegReady ? tokens.live : tokens.warn
            }}
          />
          {ffmpegReady ? 'FFmpeg ready' : 'FFmpeg unavailable'}
        </Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ color: 'text.secondary' }}>
          {activeGridName} · {feedCount} {feedCount === 1 ? 'feed' : 'feeds'}
        </Box>
      </Box>

      <AddStreamDialog
        open={isAddDialogOpen}
        onClose={() => {
          setIsAddDialogOpen(false)
          setEditingStream(undefined)
        }}
        onAdd={handleAddStream}
        onAddMultiple={handleAddMultipleStreams}
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
          <Button
            onClick={() => {
              setNewGridDialogOpen(false)
              setNewGridName('')
            }}
          >
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

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <AutoArrangeDialog
        open={autoArrangeDialogOpen}
        onClose={() => setAutoArrangeDialogOpen(false)}
        onConfirm={handleAutoArrange}
        streamCount={streams.length + chats.length}
      />

      <GridQuickSwitcher
        open={quickSwitcherOpen}
        onClose={() => setQuickSwitcherOpen(false)}
        onNewGrid={() => setNewGridDialogOpen(true)}
      />
    </Box>
  )
}
