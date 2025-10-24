import React, { useState, useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Box,
  Typography,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Paper,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material'
import { FolderOpen, Link as LinkIcon, CheckBox, CheckBoxOutlineBlank } from '@mui/icons-material'
import { parseM3U, ParsedM3UEntry } from '../utils/m3u8Parser'
import { v4 as uuidv4 } from 'uuid'
import { Stream } from '../types/stream'
import jdenticon from 'jdenticon/standalone'

interface M3U8ImportDialogProps {
  open: boolean
  onClose: () => void
  onImport: (streams: Stream[], replaceExisting: boolean) => void
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps): JSX.Element {
  const { children, value, index, ...other } = props
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`import-tabpanel-${index}`}
      aria-labelledby={`import-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  )
}

export const M3U8ImportDialog: React.FC<M3U8ImportDialogProps> = ({
  open,
  onClose,
  onImport
}): JSX.Element => {
  const [tabValue, setTabValue] = useState(0)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsedEntries, setParsedEntries] = useState<ParsedM3UEntry[]>([])
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set())
  const [parseErrors, setParseErrors] = useState<string[]>([])

  const handleTabChange = useCallback((_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
    setError(null)
  }, [])

  const handleFileSelect = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const filePath = await window.api.showM3UDialog()
      if (!filePath) {
        setLoading(false)
        return
      }

      const result = await window.api.readM3UFile(filePath)
      if (!result.success || !result.content) {
        setError(result.error || 'Failed to read file')
        setLoading(false)
        return
      }

      const parseResult = parseM3U(result.content)
      setParsedEntries(parseResult.entries)
      setParseErrors(parseResult.errors)

      // Select all entries by default
      setSelectedEntries(new Set(parseResult.entries.map((_, index) => index)))

      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file')
      setLoading(false)
    }
  }, [])

  const handleUrlLoad = useCallback(async () => {
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const result = await window.api.fetchM3UUrl(url.trim())
      if (!result.success || !result.content) {
        setError(result.error || 'Failed to fetch URL')
        setLoading(false)
        return
      }

      const parseResult = parseM3U(result.content)
      setParsedEntries(parseResult.entries)
      setParseErrors(parseResult.errors)

      // Select all entries by default
      setSelectedEntries(new Set(parseResult.entries.map((_, index) => index)))

      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch URL')
      setLoading(false)
    }
  }, [url])

  const handleToggleEntry = useCallback((index: number) => {
    setSelectedEntries(prev => {
      const newSet = new Set(prev)
      if (newSet.has(index)) {
        newSet.delete(index)
      } else {
        newSet.add(index)
      }
      return newSet
    })
  }, [])

  const handleToggleAll = useCallback(() => {
    if (selectedEntries.size === parsedEntries.length) {
      setSelectedEntries(new Set())
    } else {
      setSelectedEntries(new Set(parsedEntries.map((_, index) => index)))
    }
  }, [selectedEntries.size, parsedEntries.length])

  const handleImport = useCallback((replaceExisting: boolean) => {
    const selectedStreams = parsedEntries
      .filter((_, index) => selectedEntries.has(index))
      .map(entry => ({
        id: uuidv4(),
        name: entry.name,
        logoUrl: entry.logoUrl || '',
        streamUrl: entry.streamUrl,
        isMuted: false
      }))

    onImport(selectedStreams, replaceExisting)
    handleClose()
  }, [parsedEntries, selectedEntries, onImport])

  const handleClose = useCallback(() => {
    setParsedEntries([])
    setSelectedEntries(new Set())
    setParseErrors([])
    setError(null)
    setUrl('')
    setTabValue(0)
    onClose()
  }, [onClose])

  const allSelected = selectedEntries.size === parsedEntries.length && parsedEntries.length > 0
  const someSelected = selectedEntries.size > 0 && selectedEntries.size < parsedEntries.length

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          bgcolor: 'background.paper',
          minHeight: '500px'
        }
      }}
    >
      <DialogTitle>
        Import M3U Playlist
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Import streams from M3U/M3U8 playlist files or URLs
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2}>
          {parsedEntries.length === 0 ? (
            <>
              <Tabs value={tabValue} onChange={handleTabChange}>
                <Tab label="From File" />
                <Tab label="From URL" />
              </Tabs>

              <TabPanel value={tabValue} index={0}>
                <Stack spacing={2}>
                  <Button
                    variant="outlined"
                    startIcon={<FolderOpen />}
                    onClick={handleFileSelect}
                    disabled={loading}
                    fullWidth
                    sx={{ py: 2 }}
                  >
                    {loading ? 'Loading...' : 'Select M3U File'}
                  </Button>
                  {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                      <CircularProgress size={40} />
                    </Box>
                  )}
                </Stack>
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <Stack spacing={2}>
                  <TextField
                    label="M3U URL"
                    fullWidth
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/playlist.m3u8"
                    disabled={loading}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleUrlLoad()
                      }
                    }}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<LinkIcon />}
                    onClick={handleUrlLoad}
                    disabled={loading || !url.trim()}
                    fullWidth
                    sx={{ py: 2 }}
                  >
                    {loading ? 'Loading...' : 'Load from URL'}
                  </Button>
                  {loading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                      <CircularProgress size={40} />
                    </Box>
                  )}
                </Stack>
              </TabPanel>

              {error && (
                <Alert severity="error" onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}
            </>
          ) : (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1">
                  Found {parsedEntries.length} stream{parsedEntries.length !== 1 ? 's' : ''}
                  {selectedEntries.size > 0 && ` (${selectedEntries.size} selected)`}
                </Typography>
                <Tooltip title={allSelected ? 'Deselect All' : 'Select All'}>
                  <IconButton onClick={handleToggleAll} size="small">
                    {allSelected ? <CheckBox /> : someSelected ? <CheckBoxOutlineBlank /> : <CheckBoxOutlineBlank />}
                  </IconButton>
                </Tooltip>
              </Box>

              {parseErrors.length > 0 && (
                <Alert severity="warning" sx={{ mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {parseErrors.length} parsing error{parseErrors.length !== 1 ? 's' : ''}:
                  </Typography>
                  <Box component="ul" sx={{ mt: 0.5, mb: 0, pl: 2 }}>
                    {parseErrors.slice(0, 3).map((err, i) => (
                      <li key={i}>
                        <Typography variant="caption">{err}</Typography>
                      </li>
                    ))}
                    {parseErrors.length > 3 && (
                      <li>
                        <Typography variant="caption">
                          ...and {parseErrors.length - 3} more
                        </Typography>
                      </li>
                    )}
                  </Box>
                </Alert>
              )}

              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" />
                      <TableCell>Logo</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>URL</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {parsedEntries.map((entry, index) => (
                      <TableRow
                        key={index}
                        hover
                        onClick={() => handleToggleEntry(index)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox checked={selectedEntries.has(index)} />
                        </TableCell>
                        <TableCell>
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: 'black',
                              borderRadius: 1
                            }}
                          >
                            <img
                              src={
                                entry.logoUrl ||
                                `data:image/svg+xml,${encodeURIComponent(jdenticon.toSvg(entry.name, 40))}`
                              }
                              alt={entry.name}
                              style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain'
                              }}
                              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                e.currentTarget.src = `data:image/svg+xml,${encodeURIComponent(jdenticon.toSvg(entry.name, 40))}`
                              }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                            {entry.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
                            {entry.streamUrl}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        {parsedEntries.length > 0 && (
          <Button
            onClick={() => {
              setParsedEntries([])
              setSelectedEntries(new Set())
              setParseErrors([])
            }}
            sx={{ mr: 'auto' }}
          >
            Back
          </Button>
        )}
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        {parsedEntries.length > 0 && (
          <>
            <Button
              onClick={() => handleImport(false)}
              variant="outlined"
              disabled={selectedEntries.size === 0}
            >
              Add to Grid ({selectedEntries.size})
            </Button>
            <Button
              onClick={() => handleImport(true)}
              variant="contained"
              disabled={selectedEntries.size === 0}
            >
              Replace Grid ({selectedEntries.size})
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
