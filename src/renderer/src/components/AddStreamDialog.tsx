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
  Checkbox
} from '@mui/material'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { Stream, StreamFormData } from '../types/stream'

interface AddStreamDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (data: StreamFormData) => void
  onEdit?: (id: string, data: StreamFormData) => void
  editStream?: Stream
}

export const AddStreamDialog: React.FC<AddStreamDialogProps> = ({
  open,
  onClose,
  onAdd,
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
          const extension = url.split('.').pop()?.toLowerCase()
          if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v', 'flv', 'wmv'].includes(extension || '')) {
            return 'Local Video File'
          }
          if (['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'].includes(extension || '')) {
            return 'Local Audio File'
          }
          return 'Local File'
        }


        const { type } = extractStreamInfo(url)
        if (type) return type

        const urlObj = new URL(url)
        const path = urlObj.pathname.toLowerCase()
        if (path.endsWith('.m3u8')) return 'HLS'
        if (path.endsWith('.mpd')) return 'DASH'
        // Check for common streaming patterns
        if (url.includes('manifest') || url.includes('playlist')) {
          if (url.includes('m3u8')) return 'HLS'
          if (url.includes('mpd')) return 'DASH'
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

  const isValid = useCallback((): boolean => {
    return (
      formData.name.length >= 2 &&
      (formData.logoUrl.length === 0 || isValidImageUrl(formData.logoUrl)) &&
      (ReactPlayer.canPlay(formData.streamUrl) || formData.streamUrl.startsWith('file://'))
    )
  }, [formData, isValidImageUrl])

  const handleSubmit = useCallback((): void => {
    if (editStream && onEdit) {
      onEdit(editStream.id, formData)
    } else {
      onAdd(formData)
    }
    onClose()
  }, [editStream, onEdit, onAdd, formData, onClose])

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
      setStreamType(detectStreamType(fileUrl))
    }
  }, [detectStreamType])

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

          // Only auto-populate when adding a new stream
          if (!editStream) {
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
    [isValidImageUrl, trySetLogoPreview, detectStreamType, editStream, fetchYouTubeTitle, extractStreamInfo]
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

          <Box>
            <TextField
              id="stream-url"
              label="Stream URL or Local File"
              fullWidth
              value={formData.streamUrl}
              onChange={(e) => {
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
                if (ReactPlayer.canPlay(cleanUrl) || cleanUrl.startsWith('file://')) {
                  setStreamPreview(cleanUrl)
                  setStreamType(streamType)

                  // Only auto-populate when adding a new stream
                  if (!editStream) {
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
                }
              }}
              error={formData.streamUrl.length > 0 && !ReactPlayer.canPlay(formData.streamUrl) && !formData.streamUrl.startsWith('file://')}
              helperText={
                formData.streamUrl.length > 0
                  ? !ReactPlayer.canPlay(formData.streamUrl) && !formData.streamUrl.startsWith('file://')
                    ? 'Invalid stream URL'
                    : streamType
                      ? `Stream Type: ${streamType}`
                      : ' '
                  : 'Enter a URL or browse for a local file'
              }
              onPaste={handlePaste}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={handleBrowseFile}
                      edge="end"
                      title="Browse for local file"
                    >
                      <FolderOpenIcon />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            {streamPreview && (
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
          {editStream ? 'Save Changes' : 'Add Stream'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
