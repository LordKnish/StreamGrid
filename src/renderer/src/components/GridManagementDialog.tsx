import React, { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  TextField,
  InputAdornment,
  Button,
  Tooltip
} from '@mui/material'
import {
  Close,
  MoreVert,
  DriveFileRenameOutline,
  Delete,
  FileDownload,
  FileUpload,
  ContentCopy,
  Search
} from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'
import { useStreamStore } from '../store/useStreamStore'
import { notifyGridsChanged } from '../hooks/useGrids'
import { importGridFromFile } from '../utils/importGrid'
import { tokens } from '../theme'
import type { SavedGrid } from '../types/grid'

interface GridManagementDialogProps {
  open: boolean
  onClose: () => void
}

interface GridInfo {
  id: string
  name: string
  lastModified: string
  streamCount: number
}

export const GridManagementDialog: React.FC<GridManagementDialogProps> = ({ open, onClose }) => {
  const [grids, setGrids] = useState<GridInfo[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; grid: GridInfo } | null>(null)
  const [renameTarget, setRenameTarget] = useState<GridInfo | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const { loadGrid, deleteGrid, renameGrid, currentGridId, hasUnsavedChanges } = useStreamStore()

  const loadGrids = useCallback(async (): Promise<void> => {
    try {
      if (!window.api?.getAllGrids) return
      const allGrids = await window.api.getAllGrids()
      allGrids.sort((a, b) => a.name.localeCompare(b.name))
      setGrids(allGrids)
    } catch (error) {
      console.error('Error loading grids:', error)
    }
  }, [])

  useEffect(() => {
    if (open) loadGrids()
  }, [open, loadGrids])

  const handleLoadGrid = async (gridId: string): Promise<void> => {
    if (gridId === currentGridId) {
      onClose()
      return
    }
    if (hasUnsavedChanges && !confirm('You have unsaved changes. Switch grids anyway?')) return
    try {
      await loadGrid(gridId)
      onClose()
    } catch (error) {
      console.error('Error loading grid:', error)
    }
  }

  const handleDelete = async (grid: GridInfo): Promise<void> => {
    if (!confirm(`Delete "${grid.name}"? This can't be undone.`)) return
    try {
      await deleteGrid(grid.id)
      await loadGrids()
      notifyGridsChanged()
    } catch (error) {
      console.error('Error deleting grid:', error)
    }
  }

  const handleExport = async (grid: GridInfo): Promise<void> => {
    try {
      const data = await window.api?.loadGrid(grid.id)
      if (!data) return
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
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

  const handleDuplicate = async (grid: GridInfo): Promise<void> => {
    try {
      const data = await window.api?.loadGrid(grid.id)
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
      await loadGrids()
      notifyGridsChanged()
    } catch (error) {
      console.error('Error duplicating grid:', error)
    }
  }

  const submitRename = async (): Promise<void> => {
    if (!renameTarget || !renameValue.trim()) return
    try {
      await renameGrid(renameTarget.id, renameValue.trim())
      await loadGrids()
      notifyGridsChanged()
    } catch (error) {
      console.error('Error renaming grid:', error)
    } finally {
      setRenameTarget(null)
      setRenameValue('')
    }
  }

  const handleImport = async (): Promise<void> => {
    const result = await importGridFromFile()
    if (result.status === 'success') {
      await loadGrids()
      notifyGridsChanged()
    } else if (result.status === 'error') {
      alert(result.error)
    }
  }

  const filteredGrids = grids.filter((grid) =>
    grid.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { height: '80vh' } }}
      >
        <DialogTitle
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 2 }}
        >
          All grids
          <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: 1 }}>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search grids…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                )
              }}
            />
            <Button
              variant="outlined"
              startIcon={<FileUpload />}
              onClick={handleImport}
              sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Import
            </Button>
          </Box>

          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
              gap: 1.5,
              alignContent: 'start',
              mx: -0.5,
              px: 0.5
            }}
          >
            {filteredGrids.map((grid) => {
              const isCurrent = grid.id === currentGridId
              return (
                <Box
                  key={grid.id}
                  onClick={() => handleLoadGrid(grid.id)}
                  sx={{
                    position: 'relative',
                    cursor: 'pointer',
                    p: 1.75,
                    borderRadius: '14px',
                    backgroundColor: isCurrent ? tokens.accentSoft : tokens.glass,
                    border: `1px solid ${isCurrent ? 'rgba(139,92,246,0.4)' : tokens.border}`,
                    transition: `border-color ${tokens.motion}, background-color ${tokens.motion}`,
                    '&:hover': {
                      borderColor: isCurrent ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.22)'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    {/* Mini gradient layout thumbnail */}
                    <Box
                      sx={{
                        flexShrink: 0,
                        width: 44,
                        height: 30,
                        borderRadius: '7px',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gridTemplateRows: '1fr 1fr',
                        gap: '2px',
                        p: '3px',
                        backgroundColor: 'rgba(0,0,0,0.25)',
                        border: `1px solid ${tokens.border}`
                      }}
                    >
                      {[0, 1, 2, 3].map((i) => (
                        <Box
                          key={i}
                          sx={{
                            borderRadius: '2px',
                            backgroundImage: tokens.gradient,
                            opacity: i < Math.min(4, Math.max(1, grid.streamCount)) ? 0.9 : 0.18
                          }}
                        />
                      ))}
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        noWrap
                        sx={{ fontFamily: tokens.fontDisplay, fontWeight: 600, fontSize: '0.95rem' }}
                      >
                        {grid.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {grid.streamCount} stream{grid.streamCount === 1 ? '' : 's'}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', color: 'text.disabled' }}
                      >
                        {formatDistanceToNow(new Date(grid.lastModified), { addSuffix: true })}
                      </Typography>
                    </Box>

                    <Tooltip title="Grid options">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuAnchor({ el: e.currentTarget, grid })
                        }}
                        sx={{ color: 'text.secondary', mt: -0.5, mr: -0.5 }}
                      >
                        <MoreVert fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {isCurrent && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 8,
                        right: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        color: tokens.live
                      }}
                    >
                      <Box
                        sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: tokens.live }}
                      />
                      ACTIVE
                    </Box>
                  )}
                </Box>
              )
            })}

            {filteredGrids.length === 0 && (
              <Typography
                sx={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  color: 'text.disabled',
                  py: 6
                }}
              >
                {grids.length === 0 ? 'No saved grids yet.' : 'No grids match your search.'}
              </Typography>
            )}
          </Box>
        </DialogContent>

        <Menu
          anchorEl={menuAnchor?.el}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          <MenuItem
            onClick={() => {
              if (menuAnchor) {
                setRenameTarget(menuAnchor.grid)
                setRenameValue(menuAnchor.grid.name)
              }
              setMenuAnchor(null)
            }}
          >
            <ListItemIcon>
              <DriveFileRenameOutline fontSize="small" />
            </ListItemIcon>
            <ListItemText>Rename</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (menuAnchor) handleDuplicate(menuAnchor.grid)
              setMenuAnchor(null)
            }}
          >
            <ListItemIcon>
              <ContentCopy fontSize="small" />
            </ListItemIcon>
            <ListItemText>Duplicate</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (menuAnchor) handleExport(menuAnchor.grid)
              setMenuAnchor(null)
            }}
          >
            <ListItemIcon>
              <FileDownload fontSize="small" />
            </ListItemIcon>
            <ListItemText>Export</ListItemText>
          </MenuItem>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem
            onClick={() => {
              if (menuAnchor) handleDelete(menuAnchor.grid)
              setMenuAnchor(null)
            }}
            disabled={currentGridId === menuAnchor?.grid.id}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <Delete fontSize="small" sx={{ color: 'error.main' }} />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        </Menu>
      </Dialog>

      {/* Rename — separate dialog so focus isn't stolen by the options menu */}
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
    </>
  )
}
