import jdenticon from 'jdenticon/standalone'
import React, {
  useState,
  useCallback,
  useRef,
  memo,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useImperativeHandle,
  forwardRef
} from 'react'
import { Card, IconButton, Typography, Box, CircularProgress, Tooltip } from '@mui/material'
import { PlayArrow, Stop, Close, Edit, Chat, AspectRatio, CropFree, VolumeOff, VolumeUp } from '@mui/icons-material'
import { Stream } from '../types/stream'
import { StreamErrorBoundary } from './StreamErrorBoundary'
import { useStreamStore } from '../store/useStreamStore'

// Lazy load ReactPlayer for better initial load time
const ReactPlayer = lazy(() => import('react-player'))

// Declare Twitch global
declare global {
  interface Window {
    Twitch: {
      Embed: new (elementId: string, options: any) => any
      Player: any
    }
  }
}

// Helper function to detect stream type
const extractYoutubeVideoId = (url: string): string | null => {
  try {
    const url_obj = new URL(url)
    if (url_obj.hostname.includes('youtube.com')) {
      // Handle youtube.com URLs
      if (url_obj.pathname === '/watch') {
        return url_obj.searchParams.get('v')
      } else if (url_obj.pathname.startsWith('/live/')) {
        return url_obj.pathname.split('/')[2]
      } else if (url_obj.pathname.startsWith('/embed/')) {
        return url_obj.pathname.split('/')[2]
      }
    } else if (url_obj.hostname === 'youtu.be') {
      // Handle youtu.be URLs
      return url_obj.pathname.slice(1)
    }
  } catch (error) {
    console.error('Error parsing URL:', error)
  }
  return null
}

const detectStreamType = (url: string): 'hls' | 'dash' | 'youtube' | 'twitch' | 'local' | 'rtsp' | 'other' => {
  // Check for RTSP first
  if (url.startsWith('rtsp://') || url.startsWith('rtsps://')) {
    return 'rtsp'
  }

  // Check for local file
  if (url.startsWith('file://')) {
    return 'local'
  }

  const hlsPatterns = [/\.m3u8(\?.*)?$/i]
  const dashPatterns = [/\.mpd(\?.*)?$/i, /manifest\.mpd/i]
  const youtubePatterns = [
    // Standard YouTube watch URLs
    /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]+/i,
    // Short YouTube URLs
    /^(https?:\/\/)?youtu\.be\/[a-zA-Z0-9_-]+/i,
    // YouTube live URLs
    /^(https?:\/\/)?(www\.)?youtube\.com\/@[^/]+\/live/i,
    /^(https?:\/\/)?(www\.)?youtube\.com\/live\/[a-zA-Z0-9_-]+/i,
    // YouTube embed URLs
    /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[a-zA-Z0-9_-]+/i
  ]
  const twitchPatterns = [
    // Twitch channel URLs
    /^(https?:\/\/)?(www\.)?twitch\.tv\/([a-zA-Z0-9_]{4,25})/i
  ]
  if (hlsPatterns.some((pattern) => pattern.test(url))) {
    return 'hls'
  }
  if (dashPatterns.some((pattern) => pattern.test(url))) {
    return 'dash'
  }
  if (youtubePatterns.some((pattern) => pattern.test(url))) {
    return 'youtube'
  }
  if (twitchPatterns.some((pattern) => pattern.test(url))) {
    return 'twitch'
  }
  return 'other'
}

const extractTwitchChannelName = (url: string): string | null => {
  try {
    const match = url.match(/^(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]{4,25})/i)
    return match ? match[1] : null
  } catch {
    return null
  }
}

// Base player config
const BASE_CONFIG = {
  attributes: {
    crossOrigin: 'anonymous'
  }
}

// HLS specific config
const HLS_CONFIG = {
  ...BASE_CONFIG,
  forceHLS: true,
  hlsVersion: '1.4.12',
  hlsOptions: {
    enableWorker: false,
    lowLatencyMode: true,
    backBufferLength: 90,
    liveDurationInfinity: true,
    debug: false,
    xhrSetup: (xhr: XMLHttpRequest): void => {
      xhr.withCredentials = false
    },
    manifestLoadingTimeOut: 10000,
    manifestLoadingMaxRetry: 3,
    levelLoadingTimeOut: 10000,
    levelLoadingMaxRetry: 3
  }
}

// DASH specific config
const DASH_CONFIG = {
  ...BASE_CONFIG,
  forceDASH: true,
  dashVersion: '4.7.2', // Current version of dashjs
  dashOptions: {
    lowLatencyMode: true,
    streaming: {
      lowLatencyEnabled: true,
      abr: {
        useDefaultABRRules: true
      },
      liveCatchup: {
        enabled: true,
        maxDrift: 12
      }
    }
  }
}

interface StreamCardProps {
  stream: Stream
  onRemove: (id: string) => void
  onEdit: (stream: Stream) => void
  onAddChat?: (videoId: string, streamId: string, streamName: string) => void
}

export interface StreamCardRef {
  play: () => void
  stop: () => void
}

const StreamCard = memo(
  forwardRef<StreamCardRef, StreamCardProps>(({ stream, onRemove, onEdit, onAddChat }, ref) => {
  const { removeChatsForStream, updateStream } = useStreamStore()
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState<string>('')
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [transcodedUrl, setTranscodedUrl] = useState<string | null>(null)
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null)
  const currentFitMode = stream.fitMode || 'contain'
  const currentMuteState = stream.isMuted || false

  // Generate avatar data URL if no logo URL is provided
  const generatedAvatarUrl = useMemo(() => {
    if (!stream.logoUrl) {
      return `data:image/svg+xml,${encodeURIComponent(jdenticon.toSvg(stream.name, 200))}`
    }
    return null
  }, [stream.logoUrl, stream.name])

  // Clean up URL and determine player config
  const { videoId, channelName, playerConfig, cleanUrl, streamType } = useMemo(() => {
    const type = detectStreamType(stream.streamUrl)
    console.log(`Stream type detected for ${stream.name}:`, type)

    let vid: string | null = null
    let channel: string | null = null
    let url = stream.streamUrl
    let config = {}

    if (type === 'youtube') {
      vid = extractYoutubeVideoId(stream.streamUrl)
      // Construct clean YouTube URL
      url = vid ? `https://www.youtube.com/watch?v=${vid}` : stream.streamUrl
      config = {} // For YouTube, pass URL directly without config
    } else if (type === 'twitch') {
      channel = extractTwitchChannelName(stream.streamUrl)
      url = channel ? `https://www.twitch.tv/${channel}` : stream.streamUrl
      config = {} // For Twitch, pass URL directly without config
    } else if (type === 'dash') {
      config = { file: DASH_CONFIG }
    } else if (type === 'local') {
      // For local files, use minimal config
      config = { file: BASE_CONFIG }
    } else if (type === 'rtsp') {
      // RTSP streams will be transcoded to HLS, so use HLS config
      config = { file: HLS_CONFIG }
    } else {
      config = { file: HLS_CONFIG }
    }

    return {
      videoId: vid,
      channelName: channel,
      playerConfig: config,
      cleanUrl: url,
      streamType: type
    }
  }, [stream.streamUrl, stream.name])

  // Update logoUrl when stream.logoUrl changes
  useEffect(() => {
    setLogoUrl(stream.logoUrl || generatedAvatarUrl || '')
  }, [stream.logoUrl, generatedAvatarUrl])

  const handlePlay = useCallback(async (): Promise<void> => {
    // Reset state before playing
    setIsPlaying(false)
    setError(null)
    setIsLoading(false)
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = null
    }

    // Handle RTSP streams
    if (streamType === 'rtsp') {
      console.log('Starting RTSP stream:', cleanUrl)

      // Show loading immediately with custom message
      setLoadingMessage('Starting RTSP transcoding...')
      setIsLoading(true)
      setIsPlaying(true) // Set playing to show the player container with loading overlay

      // Check FFmpeg availability
      const ffmpegCheck = await window.api.rtspCheckFfmpeg()
      if (!ffmpegCheck.available) {
        setError('FFmpeg not installed. Please install FFmpeg to play RTSP streams.')
        setIsLoading(false)
        setIsPlaying(false)
        setLoadingMessage('')
        return
      }

      // Start RTSP transcoding
      setLoadingMessage('Connecting to RTSP stream...')
      const result = await window.api.rtspStartStream(stream.id, stream.streamUrl)
      if (result.success && result.url) {
        console.log('RTSP transcoding started, HLS URL:', result.url)
        console.log('Will play HLS stream with config:', HLS_CONFIG)
        setLoadingMessage('Buffering stream...')
        setTranscodedUrl(result.url)
        // Keep loading state - will be cleared by onReady callback
      } else {
        setError(result.error || 'Failed to start RTSP stream')
        setIsLoading(false)
        setIsPlaying(false)
        setLoadingMessage('')
      }
      return
    }

    // Start playing in next tick for non-RTSP streams
    setTimeout(() => {
      console.log('Attempting to play stream:', cleanUrl)
      setIsPlaying(true)
      setIsLoading(true)
    }, 0)
  }, [cleanUrl, streamType, stream.id, stream.streamUrl])

  // Expose play/stop methods via ref
  useImperativeHandle(ref, () => ({
    play: handlePlay,
    stop: handleStop
  }))

  // Listen for auto-start event
  useEffect(() => {
    const handleAutoStart = (): void => {
      if (!isPlaying) {
        handlePlay()
      }
    }

    window.addEventListener('auto-start-streams', handleAutoStart)
    return (): void => {
      window.removeEventListener('auto-start-streams', handleAutoStart)
    }
  }, [isPlaying, handlePlay])

  const handleStop = useCallback(async (): Promise<void> => {
    setIsPlaying(false)
    setError(null)
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = null
    }

    // Stop RTSP transcoding if this is an RTSP stream
    if (streamType === 'rtsp') {
      console.log('Stopping RTSP stream:', stream.id)
      await window.api.rtspStopStream(stream.id)
      setTranscodedUrl(null)
    }

    removeChatsForStream(stream.id)
  }, [stream.id, streamType, removeChatsForStream])

  const handleReady = useCallback(() => {
    const displayUrl = transcodedUrl || cleanUrl
    console.log('Stream ready:', displayUrl)
    setIsLoading(false)
    setLoadingMessage('')
    setError(null)
    // Clear any pending error timer when stream recovers
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = null
    }
  }, [cleanUrl, transcodedUrl])

  const handleError = useCallback((error: any) => {
    const displayUrl = transcodedUrl || cleanUrl
    console.error('Stream connection issue:', displayUrl, error)
    setIsLoading(true)

    // Clear any existing timer
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current)
    }

    // Set new timer for 15 seconds
    errorTimerRef.current = setTimeout(() => {
      console.error('Stream failed to recover:', displayUrl)
      setError('Failed to load stream')
      setIsLoading(false)
      errorTimerRef.current = null
    }, 15000)
  }, [cleanUrl, transcodedUrl])

  // Cleanup timer and RTSP stream on unmount
  React.useEffect(() => {
    return (): void => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current)
      }
      // Stop RTSP stream on unmount
      if (streamType === 'rtsp' && isPlaying) {
        window.api.rtspStopStream(stream.id)
      }
    }
  }, [streamType, isPlaying, stream.id])

  const handleToggleFitMode = useCallback(() => {
    const newFitMode = currentFitMode === 'contain' ? 'cover' : 'contain'
    updateStream(stream.id, { fitMode: newFitMode })
  }, [currentFitMode, stream.id, updateStream])

  const handleToggleMute = useCallback(() => {
    const newMuteState = !currentMuteState
    updateStream(stream.id, { isMuted: newMuteState })
  }, [currentMuteState, stream.id, updateStream])

  return (
    <Card
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        bgcolor: 'background.paper',
        borderRadius: 2,
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      <Box
        sx={{
          position: 'relative',
          height: '40px',
          flexShrink: 0,
          bgcolor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          px: 1
        }}
      >
        <Typography
          variant="subtitle2"
          noWrap
          className="drag-handle"
          sx={{
            color: 'white',
            minWidth: 0,
            mr: 1,
            cursor: 'move',
            flex: 1,
            '&:hover': {
              bgcolor: 'rgba(255,255,255,0.1)'
            }
          }}
        >
          {stream.name}
        </Typography>

        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {isPlaying && (
            <>
              <Tooltip title={currentMuteState ? 'Unmute' : 'Mute'}>
                <IconButton
                  onClick={handleToggleMute}
                  sx={{
                    backgroundColor: currentMuteState ? 'rgba(211, 47, 47, 0.4)' : 'rgba(0,0,0,0.4)',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: currentMuteState ? 'rgba(211, 47, 47, 0.6)' : 'rgba(0,0,0,0.6)',
                      color: currentMuteState ? 'error.main' : 'primary.main'
                    },
                    padding: '4px'
                  }}
                  size="small"
                >
                  {currentMuteState ? <VolumeOff fontSize="small" /> : <VolumeUp fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Tooltip title={currentFitMode === 'contain' ? 'Switch to Fill Mode' : 'Switch to Fit Mode'}>
                <IconButton
                  onClick={handleToggleFitMode}
                  sx={{
                    backgroundColor: currentFitMode === 'cover' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.4)',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: currentFitMode === 'cover' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.6)',
                      color: 'primary.main'
                    },
                    padding: '4px'
                  }}
                  size="small"
                >
                  {currentFitMode === 'contain' ? <CropFree fontSize="small" /> : <AspectRatio fontSize="small" />}
                </IconButton>
              </Tooltip>
              <IconButton
                onClick={handleStop}
                sx={{
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    color: 'error.main'
                  },
                  padding: '4px'
                }}
                size="small"
              >
                <Stop fontSize="small" />
              </IconButton>
              {(videoId || channelName) && onAddChat && (
                <IconButton
                  onClick={() => {
                    if (streamType === 'youtube' && videoId) {
                      onAddChat(videoId, stream.id, stream.name)
                    } else if (streamType === 'twitch' && channelName) {
                      onAddChat(channelName, stream.id, stream.name)
                    }
                  }}
                  sx={{
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      color: 'primary.main'
                    },
                    padding: '4px',
                    ml: 0.5
                  }}
                  size="small"
                >
                  <Chat fontSize="small" />
                </IconButton>
              )}
            </>
          )}
          <IconButton
            onClick={(e) => {
              e.stopPropagation()
              onEdit(stream)
            }}
            sx={{
              backgroundColor: 'rgba(0,0,0,0.4)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.6)',
                color: 'primary.main'
              },
              padding: '4px'
            }}
            size="small"
          >
            <Edit fontSize="small" />
          </IconButton>
          <IconButton
            onClick={(e) => {
              e.stopPropagation()
              onRemove(stream.id)
            }}
            sx={{
              backgroundColor: 'rgba(0,0,0,0.4)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.6)',
                color: 'error.main'
              },
              padding: '4px'
            }}
            size="small"
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {!isPlaying ? (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            cursor: 'pointer',
            '&:hover': {
              '& .play-overlay': {
                opacity: 1
              }
            }
          }}
          onClick={handlePlay}
        >
          <Box
            sx={{
              width: '100%',
              height: '100%',
              backgroundColor: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <img
              src={logoUrl}
              alt={stream.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                backgroundColor: !stream.logoUrl ? '#1a1a1a' : 'transparent'
              }}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>): void => {
                const img = e.currentTarget
                if (!img.hasAttribute('crossOrigin')) {
                  // If first attempt failed, try with CORS
                  img.setAttribute('crossOrigin', 'anonymous')
                  img.src = logoUrl
                } else {
                  // If CORS attempt also failed, use generated avatar
                  img.src = generatedAvatarUrl || ''
                  console.error('Failed to load logo:', logoUrl)
                }
              }}
            />
          </Box>
          <Box
            className="play-overlay"
            sx={{
              position: 'absolute',
              top: 40,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.3)',
              opacity: 0,
              transition: 'opacity 0.2s'
            }}
          >
            <PlayArrow sx={{ fontSize: 48, color: 'white' }} />
          </Box>
        </Box>
      ) : (
        <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
          <Box
            sx={{
              position: 'absolute',
              top: '0px',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <StreamErrorBoundary>
              <Suspense
                fallback={
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      height: '100%'
                    }}
                  >
                    <CircularProgress />
                  </Box>
                }
              >
                {streamType === 'twitch' && channelName ? (
                  <Box
                    sx={{
                      width: '100%',
                      height: '100%',
                      position: 'relative',
                      overflow: currentFitMode === 'contain' ? 'visible' : 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      '& iframe': {
                        width: currentFitMode === 'contain' ? '100%' : '100%',
                        height: currentFitMode === 'contain' ? '100%' : '100%',
                        transform: currentFitMode === 'cover' ? 'scale(1.35)' : 'none',
                        transformOrigin: 'center'
                      }
                    }}
                  >
                    <iframe
                      src={`https://player.twitch.tv/?channel=${channelName}&parent=${window.location.hostname}&muted=${currentMuteState}`}
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      allowFullScreen={true}
                      scrolling="no"
                      allow="autoplay; fullscreen"
                      onLoad={handleReady}
                      onError={handleError}
                    />
                  </Box>
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      height: '100%',
                      position: 'relative',
                      overflow: currentFitMode === 'contain' ? 'visible' : 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#000',
                      '& > div': {
                        width: currentFitMode === 'cover' ? '135%' : '100%',
                        height: currentFitMode === 'cover' ? '135%' : '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      },
                      '& video': {
                        objectFit: currentFitMode,
                        width: '100%',
                        height: '100%',
                        maxWidth: currentFitMode === 'contain' ? '100%' : 'none',
                        maxHeight: currentFitMode === 'contain' ? '100%' : 'none'
                      },
                      '& iframe': {
                        transform: currentFitMode === 'cover' ? 'scale(1.35)' : 'none',
                        transformOrigin: 'center'
                      }
                    }}
                  >
                    {/* Only render ReactPlayer when we have a valid URL */}
                    {(streamType !== 'rtsp' || transcodedUrl) && (
                      <ReactPlayer
                        key={transcodedUrl || cleanUrl}
                        url={transcodedUrl || cleanUrl}
                        width="100%"
                        height="100%"
                        playing={true}
                        muted={currentMuteState}
                        controls={true}
                        onReady={handleReady}
                        onError={handleError}
                        onProgress={(state) => {
                          // Log progress for RTSP streams to debug
                          if (streamType === 'rtsp' && transcodedUrl) {
                            console.log('RTSP stream progress:', state)
                          }
                        }}
                        config={playerConfig}
                        playsinline
                        stopOnUnmount
                        pip={false}
                      />
                    )}
                  </Box>
                )}
              </Suspense>
            </StreamErrorBoundary>
          </Box>
          {(error || isLoading) && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.5)'
              }}
            >
              {error ? (
                <Typography
                  sx={{
                    color: 'error.main',
                    px: 2,
                    py: 1,
                    bgcolor: 'rgba(255,0,0,0.2)',
                    borderRadius: 1
                  }}
                >
                  {error}
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      border: 4,
                      borderColor: 'primary.main',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      '@keyframes spin': {
                        '0%': {
                          transform: 'rotate(0deg)'
                        },
                        '100%': {
                          transform: 'rotate(360deg)'
                        }
                      }
                    }}
                  />
                  {loadingMessage && (
                    <Typography
                      sx={{
                        color: 'white',
                        fontSize: '0.875rem',
                        textAlign: 'center',
                        px: 2
                      }}
                    >
                      {loadingMessage}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}
    </Card>
  )
  })
)

StreamCard.displayName = 'StreamCard'

export { StreamCard }
export type { StreamCardProps }
