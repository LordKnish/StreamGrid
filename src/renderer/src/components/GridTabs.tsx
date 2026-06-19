import React, { useState } from 'react'
import {
  Box,
  Tooltip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress
} from '@mui/material'
import {
  Add,
  MoreHoriz,
  DriveFileRenameOutline,
  ContentCopy,
  FileDownload,
  FileUpload,
  Delete,
  FolderOpen
} from '@mui/icons-material'
import type { SavedGrid } from '../types/grid'
import { useStreamStore } from '../store/useStreamStore'
import {
  useGrids,
  UNSAVED_GRID_ID,
  notifyGridsChanged,
  type GridSummary
} from '../hooks/useGrids'
import { importGridFromFile } from '../utils/importGrid'
import { tokens } from '../theme'

interface GridTabsProps {
  onNewGrid: () => void
  onManageGrids: () => void
}

export const GridTabs: React.FC<GridTabsProps> = ({ onNewGrid, onManageGrids }) => {
  const { grids, currentGridId, hasUnsavedChanges, isSaving, refresh, switchToGrid } = useGrids()
  const { renameGrid, deleteGrid } = useStreamStore()

  const [menu, setMenu] = useState<{ el: HTMLElement; grid: GridSummary } | null>(null)
  const [renameTarget, setRenameTarget] = useState<GridSummary | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [addMenuEl, setAddMenuEl] = useState<HTMLElement | null>(null)

  const handleImportGrid = async (): Promise<void> => {
    setAddMenuEl(null)
    const result = await importGridFromFile()
    if (result.status === 'success') {
      await refresh()
      notifyGridsChanged()
    } else if (result.status === 'error') {
      alert(result.error)
    }
  }

  const isActive = (g: GridSummary): boolean =>
    g.id === currentGridId || (currentGridId === null && g.id === UNSAVED_GRID_ID)

  const openMenu = (e: React.MouseEvent, grid: GridSummary): void => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ el: e.currentTarget as HTMLElement, grid })
  }
  const closeMenu = (): void => setMenu(null)

  const handleExport = async (grid: GridSummary): Promise<void> => {
    closeMenu()
    try {
      const data = await window.api.loadGrid(grid.id)
      if (!data) return
      const blob = new Blob(
        [
          JSON.stringify({ streams: data.streams, layout: data.layout, chats: data.chats }, null, 2)
        ],
        { type: 'application/json' }
      )
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${grid.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_grid.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting grid:', error)
    }
  }

  const handleDuplicate = async (grid: GridSummary): Promise<void> => {
    closeMenu()
    try {
      const data = await window.api.loadGrid(grid.id)
      if (!data) return
      const now = new Date().toISOString()
      const copy: SavedGrid = {
        ...data,
        id: `grid-${Date.now()}`,
        name: `${grid.name} (Copy)`,
        createdAt: now,
        lastModified: now
      }
      await window.api.saveGrid(copy)
      await refresh()
      notifyGridsChanged()
    } catch (error) {
      console.error('Error duplicating grid:', error)
    }
  }

  const handleDelete = async (grid: GridSummary): Promise<void> => {
    closeMenu()
    if (!confirm(`Delete "${grid.name}"? This cannot be undone.`)) return
    try {
      await deleteGrid(grid.id)
      await refresh()
      notifyGridsChanged()
    } catch (error) {
      console.error('Error deleting grid:', error)
    }
  }

  const openRename = (grid: GridSummary): void => {
    closeMenu()
    setRenameTarget(grid)
    setRenameValue(grid.name)
  }

  const submitRename = async (): Promise<void> => {
    if (!renameTarget || !renameValue.trim()) return
    try {
      await renameGrid(renameTarget.id, renameValue.trim())
      await refresh()
      notifyGridsChanged()
    } catch (error) {
      console.error('Error renaming grid:', error)
    } finally {
      setRenameTarget(null)
      setRenameValue('')
    }
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexGrow: 1, minWidth: 0 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          overflowX: 'auto',
          flexGrow: 1,
          minWidth: 0,
          // hide scrollbar — the strip scrolls but stays clean
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' }
        }}
      >
        {grids.map((grid, index) => {
          const active = isActive(grid)
          const showUnsaved = active && hasUnsavedChanges
          const shortcut = index < 9 ? `  ·  Ctrl+${index + 1}` : ''
          return (
            <Box
              key={grid.id}
              role="tab"
              aria-selected={active}
              onClick={() => switchToGrid(grid.id)}
              onContextMenu={(e) => openMenu(e, grid)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                height: 32,
                pl: 1.75,
                pr: active ? 0.5 : 1.75,
                borderRadius: '10px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                color: active ? 'text.primary' : 'text.secondary',
                backgroundColor: active ? tokens.glassHi : 'transparent',
                transition: `background-color ${tokens.motion}, color ${tokens.motion}`,
                '&:hover': {
                  backgroundColor: active ? tokens.glassHi : 'rgba(255,255,255,0.06)',
                  color: active ? 'text.primary' : 'text.primary'
                }
              }}
            >
              <Tooltip
                title={`${grid.streamCount} stream${grid.streamCount === 1 ? '' : 's'}${shortcut}`}
                placement="bottom"
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    maxWidth: 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {grid.name}
                </Typography>
              </Tooltip>

              {showUnsaved &&
                (isSaving ? (
                  <CircularProgress size={11} thickness={6} sx={{ color: 'primary.light' }} />
                ) : (
                  <Tooltip title="Unsaved changes">
                    <Box
                      sx={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        bgcolor: 'warning.main',
                        flexShrink: 0
                      }}
                    />
                  </Tooltip>
                ))}

              {active && (
                <IconButton
                  size="small"
                  aria-label="Grid options"
                  onClick={(e) => openMenu(e, grid)}
                  sx={{
                    width: 22,
                    height: 22,
                    color: 'inherit',
                    opacity: 0.7,
                    '&:hover': { opacity: 1, backgroundColor: 'rgba(255,255,255,0.1)' }
                  }}
                >
                  <MoreHoriz sx={{ fontSize: 16 }} />
                </IconButton>
              )}
            </Box>
          )
        })}

        <Tooltip title="New grid  ·  Ctrl+N  ·  right-click to import">
          <IconButton
            onClick={onNewGrid}
            onContextMenu={(e) => {
              e.preventDefault()
              setAddMenuEl(e.currentTarget)
            }}
            aria-label="New grid"
            sx={{
              ml: 0.5,
              width: 30,
              height: 30,
              borderRadius: '9px',
              flexShrink: 0,
              color: 'text.disabled',
              border: `1px solid ${tokens.border}`,
              transition: `background-color ${tokens.motion}, color ${tokens.motion}`,
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)', color: 'text.primary' }
            }}
          >
            <Add sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Divider orientation="vertical" flexItem sx={{ my: 1, mx: 0.5 }} />

      <Tooltip title="All grids  ·  Ctrl+K">
        <IconButton
          size="small"
          onClick={onManageGrids}
          aria-label="All grids"
          sx={{ color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
        >
          <FolderOpen sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>

      {/* New-grid (+) menu — left-click creates, right-click opens this */}
      <Menu anchorEl={addMenuEl} open={Boolean(addMenuEl)} onClose={() => setAddMenuEl(null)}>
        <MenuItem
          onClick={() => {
            setAddMenuEl(null)
            onNewGrid()
          }}
        >
          <ListItemIcon>
            <Add fontSize="small" />
          </ListItemIcon>
          <ListItemText>New grid</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleImportGrid}>
          <ListItemIcon>
            <FileUpload fontSize="small" />
          </ListItemIcon>
          <ListItemText>Import grid…</ListItemText>
        </MenuItem>
      </Menu>

      {/* Per-tab context menu */}
      <Menu anchorEl={menu?.el} open={Boolean(menu)} onClose={closeMenu}>
        <MenuItem
          onClick={() => menu && openRename(menu.grid)}
          disabled={menu?.grid.id === UNSAVED_GRID_ID}
        >
          <ListItemIcon>
            <DriveFileRenameOutline fontSize="small" />
          </ListItemIcon>
          <ListItemText>Rename</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => menu && handleDuplicate(menu.grid)}
          disabled={menu?.grid.id === UNSAVED_GRID_ID}
        >
          <ListItemIcon>
            <ContentCopy fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => menu && handleExport(menu.grid)}
          disabled={menu?.grid.id === UNSAVED_GRID_ID}
        >
          <ListItemIcon>
            <FileDownload fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export</ListItemText>
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem
          onClick={() => menu && handleDelete(menu.grid)}
          disabled={menu?.grid.id === UNSAVED_GRID_ID}
          sx={{ color: 'error.main', '&:hover': { backgroundColor: 'rgba(255,92,87,0.1)' } }}
        >
          <ListItemIcon>
            <Delete fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Rename dialog */}
      <Dialog
        open={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Rename grid</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Grid name"
            fullWidth
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && renameValue.trim()) {
                e.preventDefault()
                submitRename()
              }
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRenameTarget(null)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={submitRename}
            variant="contained"
            disabled={!renameValue.trim() || renameValue === renameTarget?.name}
          >
            Rename
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
