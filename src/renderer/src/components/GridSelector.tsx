import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Divider,
  Typography,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material'
import {
  KeyboardArrowDown,
  Add,
  FolderOpen,
  Save,
  GridView,
  AccessTime,
  FileDownload,
  Delete,
  DriveFileRenameOutline
} from '@mui/icons-material'
import { useStreamStore } from '../store/useStreamStore'
import { formatDistanceToNow } from 'date-fns'

interface GridSelectorProps {
  onNewGrid: () => void
  onManageGrids: () => void
}

export const GridSelector: React.FC<GridSelectorProps> = ({ onNewGrid, onManageGrids }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [contextMenuAnchor, setContextMenuAnchor] = useState<null | HTMLElement>(null)
  const [selectedGrid, setSelectedGrid] = useState<{
    id: string
    name: string
    lastModified: string
    streamCount: number
  } | null>(null)
  const [recentGrids, setRecentGrids] = useState<Array<{
    id: string
    name: string
    lastModified: string
    streamCount: number
  }>>([])
  const [loading, setLoading] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [newGridName, setNewGridName] = useState('')
  const [gridToRename, setGridToRename] = useState<{
    id: string
    name: string
    lastModified: string
    streamCount: number
  } | null>(null)

  const {
    currentGridName,
    hasUnsavedChanges,
    recentGridIds,
    isSaving,
    saveCurrentGrid,
    loadGrid,
    deleteGrid,
    renameGrid
  } = useStreamStore()

  useEffect(() => {
    // Load recent grids info when menu opens
    if (anchorEl && recentGridIds.length > 0) {
      loadRecentGridsInfo()
    }
  }, [anchorEl, recentGridIds])

  const loadRecentGridsInfo = async (): Promise<void> => {
    try {
      if (!window.api?.getAllGrids) {
        return
      }
      const allGrids = await window.api.getAllGrids()
      const recent = recentGridIds
        .map(id => allGrids.find(g => g.id === id))
        .filter(Boolean)
        .slice(0, 4) as typeof recentGrids
      setRecentGrids(recent)
    } catch (error) {
      console.error('Error loading recent grids:', error)
    }
  }

  const handleClick = (event: React.MouseEvent<HTMLElement>): void => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = (): void => {
    setAnchorEl(null)
  }

  const handleSave = async (): Promise<void> => {
    handleClose()
    try {
      await saveCurrentGrid()
    } catch (error) {
      console.error('Error saving grid:', error)
    }
  }


  const handleLoadGrid = async (gridId: string): Promise<void> => {
    handleClose()
    if (hasUnsavedChanges) {
      // Save current grid before switching
      try {
        await saveCurrentGrid()
      } catch (error) {
        console.error('Error saving current grid:', error)
        const confirmed = confirm('Failed to save current grid. Do you want to continue without saving?')
        if (!confirmed) return
      }
    }

    setLoading(true)
    try {
      await loadGrid(gridId)
    } catch (error) {
      console.error('Error loading grid:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleNewGrid = (): void => {
    handleClose()
    onNewGrid()
  }

  const handleManageGrids = (): void => {
    handleClose()
    onManageGrids()
  }

  const handleContextMenu = (event: React.MouseEvent, grid: typeof recentGrids[0]): void => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedGrid(grid)
    setContextMenuAnchor(event.currentTarget as HTMLElement)
  }

  const handleCloseContextMenu = (): void => {
    setContextMenuAnchor(null)
    setSelectedGrid(null)
  }

  const handleExportGrid = async (): Promise<void> => {
    if (!selectedGrid) return
    handleCloseContextMenu()

    try {
      if (!window.api?.loadGrid) {
        return
      }
      const grid = await window.api.loadGrid(selectedGrid.id)
      if (grid) {
        const exportData = {
          streams: grid.streams,
          layout: grid.layout,
          chats: grid.chats
        }
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${grid.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_grid.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Error exporting grid:', error)
    }
  }

  const handleOpenRenameDialog = (): void => {
    if (!selectedGrid) return
    setGridToRename(selectedGrid) // Store the grid before closing context menu
    setNewGridName(selectedGrid.name)
    handleCloseContextMenu()
    setRenameDialogOpen(true)
  }

  const handleRenameGrid = async (): Promise<void> => {
    if (!gridToRename || !newGridName.trim()) return

    try {
      await renameGrid(gridToRename.id, newGridName.trim())
      // Refresh recent grids
      await loadRecentGridsInfo()
      setRenameDialogOpen(false)
      setNewGridName('')
      setGridToRename(null)
    } catch (error) {
      console.error('Error renaming grid:', error)
      alert(`Failed to rename grid: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleCloseRenameDialog = (): void => {
    setRenameDialogOpen(false)
    setNewGridName('')
    setGridToRename(null)
  }

  const handleDeleteGrid = async (): Promise<void> => {
    if (!selectedGrid) return
    handleCloseContextMenu()

    const confirmed = confirm(`Are you sure you want to delete "${selectedGrid.name}"?`)
    if (confirmed) {
      try {
        await deleteGrid(selectedGrid.id)
        // Refresh recent grids
        await loadRecentGridsInfo()
      } catch (error) {
        console.error('Error deleting grid:', error)
      }
    }
  }

  return (
    <>
      <Box sx={{ position: 'relative' }}>
        <Button
          variant="text"
          onClick={handleClick}
          endIcon={loading ? <CircularProgress size={16} /> : <KeyboardArrowDown />}
          sx={{
            textTransform: 'none',
            color: 'text.primary',
            px: 2,
            py: 1,
            borderRadius: 1,
            backgroundColor: 'action.hover',
            '&:hover': {
              backgroundColor: 'action.selected'
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GridView fontSize="small" />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {currentGridName}
            </Typography>
            {hasUnsavedChanges && !isSaving && (
              <Chip
                label="Unsaved"
                size="small"
                color="warning"
                sx={{ height: 20, fontSize: '0.75rem' }}
              />
            )}
            {isSaving && (
              <Chip
                label="Saving..."
                size="small"
                color="info"
                sx={{ height: 20, fontSize: '0.75rem' }}
              />
            )}
          </Box>
        </Button>
        {isSaving && (
          <LinearProgress
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 2,
              borderRadius: '0 0 4px 4px'
            }}
          />
        )}
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left'
        }}
        PaperProps={{
          sx: { minWidth: 280 }
        }}
      >
        <MenuItem onClick={handleSave} disabled={!hasUnsavedChanges}>
          <ListItemIcon>
            <Save fontSize="small" />
          </ListItemIcon>
          <ListItemText>Save</ListItemText>
          <Typography variant="body2" color="text.secondary">
            Ctrl+S
          </Typography>
        </MenuItem>

        <MenuItem onClick={handleNewGrid}>
          <ListItemIcon>
            <Add fontSize="small" />
          </ListItemIcon>
          <ListItemText>New Grid</ListItemText>
        </MenuItem>

        <Divider sx={{ my: 1 }} />

        {recentGrids.length > 0 && (
          <>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ px: 2, py: 0.5, display: 'block' }}
            >
              Recent Grids
            </Typography>
            {recentGrids.map((grid) => (
              <MenuItem
                key={grid.id}
                onClick={() => handleLoadGrid(grid.id)}
                onContextMenu={(e) => handleContextMenu(e, grid)}
                sx={{ py: 1 }}
              >
                <ListItemIcon>
                  <AccessTime fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={grid.name}
                  secondary={`${grid.streamCount} streams • ${formatDistanceToNow(
                    new Date(grid.lastModified),
                    { addSuffix: true }
                  )}`}
                />
              </MenuItem>
            ))}
            <Divider sx={{ my: 1 }} />
          </>
        )}

        <MenuItem onClick={handleManageGrids}>
          <ListItemIcon>
            <FolderOpen fontSize="small" />
          </ListItemIcon>
          <ListItemText>All Grids...</ListItemText>
        </MenuItem>
      </Menu>

      {/* Context menu for recent grids */}
      <Menu
        anchorEl={contextMenuAnchor}
        open={Boolean(contextMenuAnchor)}
        onClose={handleCloseContextMenu}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left'
        }}
      >
        <MenuItem onClick={handleExportGrid}>
          <ListItemIcon>
            <FileDownload fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export Grid</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleOpenRenameDialog}>
          <ListItemIcon>
            <DriveFileRenameOutline fontSize="small" />
          </ListItemIcon>
          <ListItemText>Rename</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteGrid} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <Delete fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Rename Dialog */}
      <Dialog
        open={renameDialogOpen}
        onClose={handleCloseRenameDialog}
        maxWidth="xs"
        fullWidth
        disableEscapeKeyDown={false}
        PaperProps={{
          sx: { minWidth: 400 }
        }}
      >
        <DialogTitle>Rename Grid</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Grid Name"
            fullWidth
            variant="outlined"
            value={newGridName}
            onChange={(e) => setNewGridName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newGridName.trim() && newGridName !== gridToRename?.name) {
                e.preventDefault()
                handleRenameGrid()
              }
            }}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRenameDialog}>Cancel</Button>
          <Button
            onClick={handleRenameGrid}
            variant="contained"
            disabled={!newGridName.trim() || newGridName === gridToRename?.name}
          >
            Rename
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
