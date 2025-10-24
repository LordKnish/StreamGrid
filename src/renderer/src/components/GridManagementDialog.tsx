import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Grid,
  Card,
  CardContent,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Box,
  TextField,
  InputAdornment
} from '@mui/material'
import {
  Close,
  MoreVert,
  Edit,
  Delete,
  FileDownload,
  FileUpload,
  ContentCopy,
  Search
} from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'
import { useStreamStore } from '../store/useStreamStore'
import { Button } from '@mui/material'
import { Stream, GridItem } from '../types/stream'

interface GridManagementDialogProps {
  open: boolean
  onClose: () => void
}

interface GridInfo {
  id: string
  name: string
  createdAt: string
  lastModified: string
  streamCount: number
}

export const GridManagementDialog: React.FC<GridManagementDialogProps> = ({ open, onClose }) => {
  const [grids, setGrids] = useState<GridInfo[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; grid: GridInfo } | null>(null)
  const [editingGrid, setEditingGrid] = useState<GridInfo | null>(null)
  const [editName, setEditName] = useState('')

  const { loadGrid, deleteGrid, renameGrid, currentGridId, hasUnsavedChanges } = useStreamStore()

  useEffect(() => {
    if (open) {
      loadGrids()
    }
  }, [open])

  const loadGrids = async (): Promise<void> => {
    try {
      if (!window.api?.getAllGrids) {
        return
      }
      const allGrids = await window.api.getAllGrids()
      // Map the API response to include createdAt field
      const gridsWithCreatedAt = allGrids.map(grid => ({
        ...grid,
        createdAt: grid.lastModified // Use lastModified as createdAt if not available
      }))
      setGrids(gridsWithCreatedAt)
    } catch (error) {
      console.error('Error loading grids:', error)
    }
  }

  const handleLoadGrid = async (gridId: string): Promise<void> => {
    if (hasUnsavedChanges) {
      const confirmed = confirm('You have unsaved changes. Do you want to continue?')
      if (!confirmed) return
    }

    try {
      await loadGrid(gridId)
      onClose()
    } catch (error) {
      console.error('Error loading grid:', error)
    }
  }

  const handleDeleteGrid = async (grid: GridInfo): Promise<void> => {
    const confirmed = confirm(`Are you sure you want to delete "${grid.name}"?`)
    if (!confirmed) return

    try {
      await deleteGrid(grid.id)
      await loadGrids()
    } catch (error) {
      console.error('Error deleting grid:', error)
    }
  }

  const handleRenameGrid = async (): Promise<void> => {
    if (!editingGrid || !editName.trim()) return

    try {
      await renameGrid(editingGrid.id, editName.trim())
      await loadGrids()
      setEditingGrid(null)
      setEditName('')
    } catch (error) {
      console.error('Error renaming grid:', error)
    }
  }

  const handleExportGrid = async (grid: GridInfo): Promise<void> => {
    try {
      if (!window.api?.loadGrid) {
        return
      }
      const gridData = await window.api.loadGrid(grid.id)
      if (!gridData) return

      const blob = new Blob([JSON.stringify(gridData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${grid.name.replace(/[^a-z0-9]/gi, '_')}_grid.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting grid:', error)
    }
  }

  const handleDuplicateGrid = async (grid: GridInfo): Promise<void> => {
    try {
      if (!window.api?.loadGrid) {
        return
      }
      const gridData = await window.api.loadGrid(grid.id)
      if (!gridData) return

      const newName = `${grid.name} (Copy)`
      await useStreamStore.getState().saveCurrentGrid(newName)
      await loadGrids()
    } catch (error) {
      console.error('Error duplicating grid:', error)
    }
  }

  const handleImportGrid = async (): Promise<void> => {
    try {
      // Create file input element
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'

      input.onchange = async (e): Promise<void> => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return

        try {
          const text = await file.text()
          const data = JSON.parse(text)

          // Validate the imported data structure
          if (!data.streams || !Array.isArray(data.streams) ||
              !data.layout || !Array.isArray(data.layout)) {
            alert('Invalid grid file format. Please ensure the file contains streams and layout arrays.')
            return
          }

          // Validate each stream has required fields
          const validStreams = data.streams.every((stream: Stream) =>
            stream.id && stream.name && stream.logoUrl && stream.streamUrl
          )

          if (!validStreams) {
            alert('Invalid stream data. Each stream must have id, name, logoUrl, and streamUrl.')
            return
          }

          // Validate each layout item has required fields
          const validLayout = data.layout.every((item: GridItem) =>
            item.i !== undefined &&
            item.x !== undefined &&
            item.y !== undefined &&
            item.w !== undefined &&
            item.h !== undefined
          )

          if (!validLayout) {
            alert('Invalid layout data. Each layout item must have i, x, y, w, and h properties.')
            return
          }

          // Import the data using the store's import method
          const result = useStreamStore.getState().importStreams({
            streams: data.streams,
            layout: data.layout,
            chats: data.chats || []
          })

          if (result.success) {
            // Save as a new grid with the file name (without extension)
            const gridName = file.name.replace(/\.json$/, '') || 'Imported Grid'
            await useStreamStore.getState().saveCurrentGrid(gridName)
            await loadGrids()
            alert(`Grid "${gridName}" imported successfully!`)
          } else {
            alert(`Import failed: ${result.error}`)
          }
        } catch (error) {
          console.error('Error parsing JSON file:', error)
          alert('Failed to parse JSON file. Please ensure it is a valid JSON format.')
        }
      }

      // Trigger file selection
      input.click()
    } catch (error) {
      console.error('Error importing grid:', error)
      alert('Failed to import grid.')
    }
  }

  const filteredGrids = grids.filter(grid =>
    grid.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Manage Grids</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <TextField
            fullWidth
            placeholder="Search grids..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              )
            }}
          />
          <Button
            variant="contained"
            startIcon={<FileUpload />}
            onClick={handleImportGrid}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Import Grid
          </Button>
        </Box>

        <Grid container spacing={2}>
          {filteredGrids.map((grid) => (
            <Grid item xs={12} sm={6} md={4} key={grid.id}>
              <Card
                sx={{
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: currentGridId === grid.id ? '2px solid' : '1px solid',
                  borderColor: currentGridId === grid.id ? 'primary.main' : 'divider',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 3
                  }
                }}
                onClick={() => handleLoadGrid(grid.id)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Box sx={{ flex: 1 }}>
                      {editingGrid?.id === grid.id ? (
                        <TextField
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleRenameGrid()
                            }
                          }}
                          onBlur={handleRenameGrid}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          size="small"
                          fullWidth
                        />
                      ) : (
                        <Typography variant="h6" gutterBottom>
                          {grid.name}
                        </Typography>
                      )}
                      <Typography variant="body2" color="text.secondary">
                        {grid.streamCount} streams
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Modified {formatDistanceToNow(new Date(grid.lastModified), { addSuffix: true })}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuAnchor({ el: e.currentTarget, grid })
                      }}
                    >
                      <MoreVert />
                    </IconButton>
                  </Box>
                </CardContent>
                {currentGridId === grid.id && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      fontSize: '0.75rem'
                    }}
                  >
                    Current
                  </Box>
                )}
              </Card>
            </Grid>
          ))}
        </Grid>

        <Menu
          anchorEl={menuAnchor?.el}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
        >
          <MenuItem
            onClick={() => {
              if (menuAnchor) {
                setEditingGrid(menuAnchor.grid)
                setEditName(menuAnchor.grid.name)
                setMenuAnchor(null)
              }
            }}
          >
            <ListItemIcon>
              <Edit fontSize="small" />
            </ListItemIcon>
            <ListItemText>Rename</ListItemText>
          </MenuItem>

          <MenuItem
            onClick={() => {
              if (menuAnchor) {
                handleDuplicateGrid(menuAnchor.grid)
                setMenuAnchor(null)
              }
            }}
          >
            <ListItemIcon>
              <ContentCopy fontSize="small" />
            </ListItemIcon>
            <ListItemText>Duplicate</ListItemText>
          </MenuItem>

          <MenuItem
            onClick={() => {
              if (menuAnchor) {
                handleExportGrid(menuAnchor.grid)
                setMenuAnchor(null)
              }
            }}
          >
            <ListItemIcon>
              <FileDownload fontSize="small" />
            </ListItemIcon>
            <ListItemText>Export</ListItemText>
          </MenuItem>

          <MenuItem
            onClick={() => {
              if (menuAnchor) {
                handleDeleteGrid(menuAnchor.grid)
                setMenuAnchor(null)
              }
            }}
            disabled={currentGridId === menuAnchor?.grid.id}
          >
            <ListItemIcon>
              <Delete fontSize="small" />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        </Menu>
      </DialogContent>
    </Dialog>
  )
}
