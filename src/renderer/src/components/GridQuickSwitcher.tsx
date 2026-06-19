import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Dialog, Box, InputBase, Typography, Chip } from '@mui/material'
import { Search, GridView, Add, KeyboardReturn } from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'
import { useGrids, UNSAVED_GRID_ID } from '../hooks/useGrids'
import { tokens } from '../theme'

interface GridQuickSwitcherProps {
  open: boolean
  onClose: () => void
  onNewGrid: () => void
}

export const GridQuickSwitcher: React.FC<GridQuickSwitcherProps> = ({
  open,
  onClose,
  onNewGrid
}) => {
  const { grids, currentGridId, switchToGrid } = useGrids()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
    }
  }, [open])

  const filtered = useMemo(
    () => grids.filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase())),
    [grids, query]
  )

  // Rows = matching grids + a trailing "create new grid" action.
  const rowCount = filtered.length + 1
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, rowCount - 1)))
  }, [rowCount])

  const choose = (index: number): void => {
    if (index >= filtered.length) {
      onClose()
      onNewGrid()
      return
    }
    const grid = filtered[index]
    if (grid) switchToGrid(grid.id)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % rowCount)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + rowCount) % rowCount)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(active)
    }
  }

  // Keep the highlighted row scrolled into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-row="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const newRowActive = active === filtered.length

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ backdrop: { sx: { backgroundColor: 'rgba(4,8,14,0.6)' } } }}
      PaperProps={{
        sx: {
          position: 'fixed',
          top: 96,
          m: 0,
          width: 'min(560px, 92vw)',
          overflow: 'hidden'
        }
      }}
    >
      {/* Search field */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          height: 56,
          borderBottom: `1px solid ${tokens.border}`
        }}
      >
        <Search sx={{ color: 'text.secondary' }} />
        <InputBase
          autoFocus
          fullWidth
          placeholder="Switch grid or create a new one…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{ fontSize: '0.95rem', color: 'text.primary' }}
        />
        <Chip label="Esc" size="small" variant="outlined" sx={{ color: 'text.secondary' }} />
      </Box>

      {/* Results */}
      <Box ref={listRef} sx={{ maxHeight: 340, overflowY: 'auto', p: 1 }}>
        {filtered.map((grid, i) => {
          const isCurrent =
            grid.id === currentGridId || (currentGridId === null && grid.id === UNSAVED_GRID_ID)
          const rowActive = active === i
          return (
            <Box
              key={grid.id}
              data-row={i}
              onClick={() => choose(i)}
              onMouseMove={() => setActive(i)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.5,
                py: 1,
                borderRadius: 2,
                cursor: 'pointer',
                backgroundColor: rowActive ? tokens.accentSoft : 'transparent'
              }}
            >
              <GridView
                sx={{ fontSize: 20, color: rowActive ? 'primary.light' : 'text.secondary' }}
              />
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                  {grid.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {grid.streamCount} stream{grid.streamCount === 1 ? '' : 's'}
                  {grid.id !== UNSAVED_GRID_ID &&
                    ` · ${formatDistanceToNow(new Date(grid.lastModified), { addSuffix: true })}`}
                </Typography>
              </Box>
              {isCurrent && (
                <Chip label="Current" size="small" color="primary" variant="outlined" />
              )}
              {rowActive && !isCurrent && (
                <KeyboardReturn sx={{ fontSize: 16, color: 'text.secondary' }} />
              )}
            </Box>
          )
        })}

        {/* Create-new action */}
        <Box
          data-row={filtered.length}
          onClick={() => choose(filtered.length)}
          onMouseMove={() => setActive(filtered.length)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 1.5,
            py: 1,
            mt: filtered.length ? 0.5 : 0,
            borderRadius: 2,
            cursor: 'pointer',
            backgroundColor: newRowActive ? tokens.accentSoft : 'transparent'
          }}
        >
          <Add sx={{ fontSize: 20, color: newRowActive ? 'primary.light' : 'text.secondary' }} />
          <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 500 }}>
            Create new grid
          </Typography>
          {newRowActive && <KeyboardReturn sx={{ fontSize: 16, color: 'text.secondary' }} />}
        </Box>
      </Box>
    </Dialog>
  )
}
