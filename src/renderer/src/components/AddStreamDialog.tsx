/* eslint-disable prettier/prettier */
import jdenticon from 'jdenticon/standalone'
import React, { useState, useEffect, useCallback, KeyboardEvent } from 'react'
import ReactPlayer from 'react-player'
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
  Paper,
  IconButton,
  InputAdornment,
  FormControlLabel,
  Checkbox,
  Chip,
  Alert
} from '@mui/material'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { Stream, StreamFormData } from '../types/stream'
import { parseM3U, ParsedM3UEntry } from '../utils/m3u8Parser'

interface AddStreamDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (data: StreamFormData) => void
  onAddMultiple?: (streams: Stream[]) => void
  onEdit?: (id: string, data: StreamFormData) => void
  editStream?: Stream
}

export const AddStreamDialog: React.FC<AddStreamDialogProps> = ({
  open,
  onClose,
  onAdd,
  onAddMultiple,
  onEdit,
  editStream
}): JSX.Element => {
  const [logoPreview, setLogoPreview] = useState<string>('')
  const [streamPreview, setStreamPreview] = useState<string>('')
  const [streamType, setStreamType] = useState<string>('')
  const [formData, setFormData] = useState<StreamFormData>({
    name: '',
    logoUrl: '',
    streamUrl: '',
    startMuted: false
  })
  const [m3uEntries, setM3uEntries] = useState<ParsedM3UEntry[]>([])
  const [m3uError, setM3uError] = useState<string | null>(null)

  const extractStreamInfo = useCallback((url: string): { type: string; id: string | null } => {
    try {
      // YouTube detection
      let match = url.match(/^(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?/\s]{11})/i)
      if (match) return { type: 'YouTube', id: match[1] }

      match = url.match(
        /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:watch\?v=|live\/|embed\/)?([^?/\s]{11})/i
      )
      if (match) return { type: 'YouTube', id: match[1] }

      const urlObj = new URL(url)
      const videoId = urlObj.searchParams.get('v')
      if (videoId && videoId.length === 11) return { type: 'YouTube', id: videoId }

      // Twitch detection
      match = url.match(/^(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]{4,25})/i)
      if (match) return { type: 'Twitch', id: match[1] }

      return { type: '', id: null }
    } catch {
      return { type: '', id: null }
    }
  }, [])

  const fetchYouTubeTitle = useCallback(async (videoId: string): Promise<string | null> => {
    try {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      )
      if (!response.ok) return null
      const data = await response.json()
      return data.title || null
    } catch {
      return null
    }
  }, [])

  const detectStreamType = useCallback(
    (url: string): string => {
      if (!url) return ''
      try {
        // Check if it's a local file
        if (url.startsWith('file://')) {
          const extension = url.split('.').pop()?.toLowerCase().split('?')[0]
          if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v', 'flv', 'wmv'].includes(extension || '')) {
            return 'Local Video File'
          }
          if (['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'].includes(extension || '')) {
            return 'Local Audio File'
          }
          if (['m3u', 'm3u8'].includes(extension || '')) {
            return 'M3U Playlist'
          }
          return 'Local File'
        }

        // Check for M3U playlist file extension (not .m3u8 HLS streams)
        const urlLower = url.toLowerCase()
        if (urlLower.endsWith('.m3u') || urlLower.includes('.m3u?')) {
          return 'M3U Playlist'
        }

        const { type } = extractStreamInfo(url)
        if (type) return type

        const urlObj = new URL(url)
        const path = urlObj.pathname.toLowerCase()
        if (path.endsWith('.m3u8')) return 'HLS Stream'
        if (path.endsWith('.mpd')) return 'DASH Stream'
        // Check for common streaming patterns
        if (url.includes('manifest') || url.includes('playlist')) {
          if (url.includes('m3u8')) return 'HLS Stream'
          if (url.includes('mpd')) return 'DASH Stream'
        }
        return 'Direct Stream'
      } catch {
        return ''
      }
    },
    [extractStreamInfo]
  )

  const isValidImageUrl = useCallback((url: string): boolean => {
    try {
      const parsedUrl = new URL(url)
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'file:'
    } catch {
      return false
    }
  }, [])

  const validateAndLoadImage = useCallback((url: string): Promise<boolean> => {
    return new Promise<boolean>((resolve: (value: boolean) => void) => {
      const img = new Image()
      img.onload = (): void => resolve(true)
      img.onerror = (): void => {
        // If loading fails, try with CORS
        img.crossOrigin = 'anonymous'
        img.src = url
        img.onerror = (): void => resolve(false)
      }
      // Try loading without CORS first
      img.src = url
    })
  }, [])

  const trySetLogoPreview = useCallback(
    async (url: string): Promise<void> => {
      if (isValidImageUrl(url)) {
        const isValidImage = await validateAndLoadImage(url)
        if (isValidImage) {
          setLogoPreview(url)
        }
      }
    },
    [isValidImageUrl, validateAndLoadImage]
  )

  const handleM3UDetection = useCallback(async (url: string): Promise<void> => {
    // Check if it's explicitly an M3U file (not .m3u8 HLS stream)
    const urlLower = url.toLowerCase()
    const isM3UFile = url.startsWith('file://') && (urlLower.endsWith('.m3u') || urlLower.endsWith('.m3u8'))
    const isM3UUrl = urlLower.endsWith('.m3u') || urlLower.includes('.m3u?')

    if (isM3UFile || isM3UUrl) {
      try {
        setM3uError(null)
        let content: string | undefined

        // Check if it's a local file or URL
        if (url.startsWith('file://')) {
          // Extract file path from file:// URL
          const filePath = url.replace('file:///', '').replace(/\//g, '\\')
          const result = await window.api.readM3UFile(filePath)
          if (result.success && result.content) {
            content = result.content
          } else {
            setM3uError(result.error || 'Failed to read M3U file')
            return
          }
        } else {
          // It's a URL
          const result = await window.api.fetchM3UUrl(url)
          if (result.success && result.content) {
            content = result.content
          } else {
            setM3uError(result.error || 'Failed to fetch M3U URL')
            return
          }
        }

        if (content) {
          const parseResult = parseM3U(content)
          if (parseResult.entries.length > 0) {
            setM3uEntries(parseResult.entries)
            if (parseResult.errors.length > 0) {
              setM3uError(`Parsed ${parseResult.entries.length} streams with ${parseResult.errors.length} errors`)
            }
          } else {
            setM3uError('No valid streams found in M3U playlist')
          }
        }
      } catch (error) {
        setM3uError(error instanceof Error ? error.message : 'Failed to parse M3U playlist')
      }
    } else {
      setM3uEntries([])
      setM3uError(null)
    }
  }, [detectStreamType])

  const isValid = useCallback((): boolean => {
    // If M3U entries exist, we're valid
    if (m3uEntries.length > 0) return true

    // Check if it's an RTSP URL
    const isRtspUrl = formData.streamUrl.startsWith('rtsp://') || formData.streamUrl.startsWith('rtsps://')

    // Otherwise check normal stream validation
    return (
      formData.name.length >= 2 &&
      (formData.logoUrl.length === 0 || isValidImageUrl(formData.logoUrl)) &&
      (ReactPlayer.canPlay(formData.streamUrl) || formData.streamUrl.startsWith('file://') || isRtspUrl)
    )
  }, [formData, isValidImageUrl, m3uEntries.length])

  const handleSubmit = useCallback((): void => {
    // If M3U entries exist, import them all
    if (m3uEntries.length > 0 && onAddMultiple) {
      const streams: Stream[] = m3uEntries.map(entry => ({
        id: crypto.randomUUID(),
        name: entry.name,
        logoUrl: entry.logoUrl || '',
        streamUrl: entry.streamUrl,
        isMuted: formData.startMuted || false
      }))
      onAddMultiple(streams)
      onClose()
      return
    }

    // Otherwise, add single stream
    if (editStream && onEdit) {
      onEdit(editStream.id, formData)
    } else {
      onAdd(formData)
    }
    onClose()
  }, [m3uEntries, onAddMultiple, editStream, onEdit, onAdd, formData, onClose])

  // Handle local file selection
  const handleBrowseFile = useCallback(async (): Promise<void> => {
    if (!window.api?.showOpenDialog) {
      console.error('File dialog API not available')
      return
    }
    const result = await window.api.showOpenDialog()
    if (result) {
      const { filePath, fileUrl } = result
      const fileName = filePath.split(/[\\/]/).pop() || 'Local File'
      const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '')

      setFormData((prev) => ({
        ...prev,
        streamUrl: fileUrl,
        name: prev.name || nameWithoutExt
      }))
      setStreamPreview(fileUrl)
      const type = detectStreamType(fileUrl)
      setStreamType(type)

      // Check if it's an M3U file
      await handleM3UDetection(fileUrl)
    }
  }, [detectStreamType, handleM3UDetection])

  // Handle URL auto-detection on paste
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent): Promise<void> => {
      const pastedText = e.clipboardData?.getData('text')
      if (!pastedText) {
        return
      }

      // Get the target element and its ID
      const target = e.target as HTMLInputElement
      const targetId = target.id

      // For logo URL field
      if (targetId === 'logo-url') {
        // Don't prevent default - let the paste happen normally
        // Validate the pasted value on the next input event
        const handleLogoUrlInput = (event: Event): void => {
          const input = event.target as HTMLInputElement
          const value = input.value
          if (isValidImageUrl(value)) {
            trySetLogoPreview(value)
          }
          input.removeEventListener('input', handleLogoUrlInput)
        }
        target.addEventListener('input', handleLogoUrlInput)
      }
      // For stream URL field
      else if (targetId === 'stream-url') {
        // Only prevent default and handle special logic if it's a valid stream URL
        if (ReactPlayer.canPlay(pastedText)) {
          e.preventDefault()

          // Clean up URL and set new value
          const streamType = detectStreamType(pastedText)
          let cleanUrl = pastedText

          if (streamType === 'YouTube' || streamType === 'Twitch') {
            const { type, id } = extractStreamInfo(pastedText)
            if (id) {
              cleanUrl =
                type === 'YouTube'
                  ? `https://www.youtube.com/watch?v=${id}`
                  : `https://www.twitch.tv/${id}`
            }
          }

          setFormData((prev) => ({ ...prev, streamUrl: cleanUrl }))
          setStreamPreview(cleanUrl)
          setStreamType(streamType)

          // Check for M3U
          await handleM3UDetection(cleanUrl)

          // Only auto-populate when adding a new stream
          if (!editStream && streamType !== 'M3U Playlist') {
            const { type, id } = extractStreamInfo(cleanUrl)
            if (id) {
              if (type === 'YouTube') {
                // Set YouTube thumbnail and title
                const thumbnailUrl = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
                setFormData((prev) => ({ ...prev, logoUrl: thumbnailUrl }))
                trySetLogoPreview(thumbnailUrl)

                fetchYouTubeTitle(id).then((title) => {
                  if (title) {
                    setFormData((prev) => ({ ...prev, name: title }))
                  }
                })
              } else if (type === 'Twitch') {
                // Set Twitch channel name as title and live preview image
                setFormData((prev) => ({
                  ...prev,
                  name: id,
                  logoUrl: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${id}-1920x1080.jpg`
                }))
                trySetLogoPreview(
                  `https://static-cdn.jtvnw.net/previews-ttv/live_user_${id}-1920x1080.jpg`
                )
              }
            }
          }
        }
        // If it's not a valid stream URL, let the default paste behavior happen
      }
    },
    [isValidImageUrl, trySetLogoPreview, detectStreamType, editStream, fetchYouTubeTitle, extractStreamInfo, handleM3UDetection]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent): void => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && isValid()) {
        handleSubmit()
      }
    },
    [isValid, handleSubmit]
  )

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (editStream) {
        // Clean up stream URL before setting form data
        const type = detectStreamType(editStream.streamUrl)
        let cleanUrl = editStream.streamUrl

        if (type === 'YouTube' || type === 'Twitch') {
          const { type: streamType, id } = extractStreamInfo(editStream.streamUrl)
          if (id) {
            cleanUrl =
              streamType === 'YouTube'
                ? `https://www.youtube.com/watch?v=${id}`
                : `https://www.twitch.tv/${id}`
          }
        }

        setFormData({
          name: editStream.name,
          logoUrl: editStream.logoUrl,
          streamUrl: cleanUrl,
          startMuted: editStream.isMuted || false
        })
        if (editStream.logoUrl) {
          trySetLogoPreview(editStream.logoUrl)
        }
        setStreamPreview(cleanUrl)
        setStreamType(type)
      } else {
        setFormData({ name: '', logoUrl: '', streamUrl: '', startMuted: false })
        setLogoPreview('')
        setStreamPreview('')
        setStreamType('')
        setM3uEntries([])
        setM3uError(null)
      }
    }
  }, [open, editStream, trySetLogoPreview, detectStreamType, extractStreamInfo])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          bgcolor: 'background.paper'
        }
      }}
    >
      <DialogTitle>
        {editStream ? 'Edit Stream' : 'Add Stream'}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Press ⌘/Ctrl + Enter to save
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {m3uEntries.length === 0 && (
            <TextField
              label="Name"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              error={formData.name.length > 0 && formData.name.length < 2}
              helperText={
                formData.name.length > 0 && formData.name.length < 2 ? 'Min 2 characters' : ' '
              }
              autoFocus
              onKeyDown={handleKeyDown}
            />
          )}

          {m3uEntries.length === 0 && (
            <Box>
              <TextField
                id="logo-url"
                label="Logo URL (optional)"
                fullWidth
                value={formData.logoUrl}
                onChange={(e) => {
                  const url = e.target.value
                  setFormData((prev) => ({ ...prev, logoUrl: url }))
                  trySetLogoPreview(url)
                }}
                error={formData.logoUrl.length > 0 && !isValidImageUrl(formData.logoUrl)}
                helperText={
                  formData.logoUrl.length > 0 && !isValidImageUrl(formData.logoUrl)
                    ? 'Invalid image URL'
                    : 'Leave empty to generate an avatar based on stream name'
                }
                onPaste={handlePaste}
              />
              {(logoPreview || formData.name) && (
                <Paper
                  elevation={1}
                  sx={{
                    mt: 1,
                    height: '80px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'black',
                    borderRadius: 1,
                    overflow: 'hidden'
                  }}
                >
                  <img
                    src={
                      logoPreview ||
                      `data:image/svg+xml,${encodeURIComponent(jdenticon.toSvg(formData.name, 200))}`
                    }
                    alt="Logo Preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      backgroundColor: !logoPreview ? '#1a1a1a' : 'transparent'
                    }}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    crossOrigin="anonymous"
                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>): void => {
                      e.currentTarget.src = `data:image/svg+xml,${encodeURIComponent(jdenticon.toSvg(formData.name, 200))}`
                    }}
                  />
                </Paper>
              )}
            </Box>
          )}

          <Box>
            <TextField
              id="stream-url"
              label="Stream URL, Local File, or M3U Playlist"
              fullWidth
              value={formData.streamUrl}
              onChange={async (e) => {
                const url = e.target.value
                const streamType = detectStreamType(url)
                let cleanUrl = url

                if (streamType === 'YouTube' || streamType === 'Twitch') {
                  const { type: streamType, id } = extractStreamInfo(url)
                  if (id) {
                    cleanUrl =
                      streamType === 'YouTube'
                        ? `https://www.youtube.com/watch?v=${id}`
                        : `https://www.twitch.tv/${id}`
                  }
                }

                setFormData((prev) => ({ ...prev, streamUrl: cleanUrl }))
                if (ReactPlayer.canPlay(cleanUrl) || cleanUrl.startsWith('file://') || cleanUrl.startsWith('rtsp://') || cleanUrl.startsWith('rtsps://')) {
                  setStreamPreview(cleanUrl)
                  setStreamType(streamType)

                  // Check for M3U
                  await handleM3UDetection(cleanUrl)

                  // Only auto-populate when adding a new stream
                  if (!editStream && streamType !== 'M3U Playlist') {
                    const { type: streamType, id } = extractStreamInfo(cleanUrl)
                    if (id) {
                      if (streamType === 'YouTube') {
                        // Set YouTube thumbnail and title
                        const thumbnailUrl = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
                        setFormData((prev) => ({ ...prev, logoUrl: thumbnailUrl }))
                        trySetLogoPreview(thumbnailUrl)

                        fetchYouTubeTitle(id).then((title) => {
                          if (title) {
                            setFormData((prev) => ({ ...prev, name: title }))
                          }
                        })
                      } else if (streamType === 'Twitch') {
                        // Set Twitch channel name as title and live preview image
                        setFormData((prev) => ({
                          ...prev,
                          name: id,
                          logoUrl: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${id}-1920x1080.jpg`
                        }))
                        trySetLogoPreview(
                          `https://static-cdn.jtvnw.net/previews-ttv/live_user_${id}-1920x1080.jpg`
                        )
                      }
                    }
                  }
                } else {
                  setStreamPreview('')
                  setStreamType('')
                  setM3uEntries([])
                  setM3uError(null)
                }
              }}
              error={formData.streamUrl.length > 0 && !ReactPlayer.canPlay(formData.streamUrl) && !formData.streamUrl.startsWith('file://') && !formData.streamUrl.startsWith('rtsp://') && !formData.streamUrl.startsWith('rtsps://') && m3uEntries.length === 0}
              helperText={
                formData.streamUrl.length > 0
                  ? !ReactPlayer.canPlay(formData.streamUrl) && !formData.streamUrl.startsWith('file://') && !formData.streamUrl.startsWith('rtsp://') && !formData.streamUrl.startsWith('rtsps://') && m3uEntries.length === 0
                    ? 'Invalid stream URL'
                    : formData.streamUrl.startsWith('rtsp://') || formData.streamUrl.startsWith('rtsps://')
                    ? 'RTSP stream (requires FFmpeg)'
                    : ' '
                  : 'Enter a URL or browse for a local file/M3U playlist. Supports YouTube, Twitch, HLS, DASH, RTSP, and local files.'
              }
              onPaste={handlePaste}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={handleBrowseFile}
                      edge="end"
                      title="Browse for local file or M3U playlist"
                    >
                      <FolderOpenIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            {/* Stream Type Indicator */}
            {streamType && (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Detected Type:
                </Typography>
                <Chip
                  label={streamType}
                  size="small"
                  color={streamType === 'M3U Playlist' ? 'primary' : 'default'}
                  sx={{ height: 20 }}
                />
              </Box>
            )}

            {/* M3U Playlist Info */}
            {m3uEntries.length > 0 && (
              <Alert severity="success" sx={{ mt: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  M3U Playlist Detected
                </Typography>
                <Typography variant="caption">
                  Found {m3uEntries.length} stream{m3uEntries.length !== 1 ? 's' : ''} in playlist.
                  All streams will be added to the grid.
                </Typography>
              </Alert>
            )}

            {m3uError && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                <Typography variant="caption">{m3uError}</Typography>
              </Alert>
            )}

            {streamPreview && m3uEntries.length === 0 && (
              <Paper
                elevation={1}
                sx={{
                  mt: 1,
                  height: '120px',
                  bgcolor: 'black',
                  borderRadius: 1,
                  overflow: 'hidden'
                }}
              >
                <ReactPlayer
                  url={streamPreview}
                  width="100%"
                  height="100%"
                  controls
                  playing={false}
                  config={{
                    file: {
                      attributes: {
                        crossOrigin: 'anonymous'
                      }
                    }
                  }}
                />
              </Paper>
            )}
          </Box>

          {m3uEntries.length === 0 && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.startMuted || false}
                  onChange={(e) => setFormData((prev) => ({ ...prev, startMuted: e.target.checked }))}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Start muted</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Stream will start with audio muted
                  </Typography>
                </Box>
              }
              sx={{ mt: 1, alignItems: 'flex-start' }}
            />
          )}

          {m3uEntries.length > 0 && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.startMuted || false}
                  onChange={(e) => setFormData((prev) => ({ ...prev, startMuted: e.target.checked }))}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Start all streams muted</Typography>
                  <Typography variant="caption" color="text.secondary">
                    All {m3uEntries.length} streams will start with audio muted
                  </Typography>
                </Box>
              }
              sx={{ mt: 1, alignItems: 'flex-start' }}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          sx={{
            color: 'text.secondary',
            '&:hover': {
              backgroundColor: 'action.hover'
            }
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!isValid()}
          sx={{
            px: 3,
            borderRadius: 1,
            textTransform: 'none'
          }}
        >
          {m3uEntries.length > 0
            ? `Add ${m3uEntries.length} Stream${m3uEntries.length !== 1 ? 's' : ''}`
            : editStream
              ? 'Save Changes'
              : 'Add Stream'
          }
        </Button>
      </DialogActions>
    </Dialog>
  )
}
