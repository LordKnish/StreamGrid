/* eslint-disable prettier/prettier */
// eslint-disable-next-line prettier/prettier
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
// eslint-disable-next-line prettier/prettier
import GridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { Box } from '@mui/material'
import { Stream, GridItem } from '../types/stream'
import { StreamCard } from './StreamCard'
import { ChatCard } from './ChatCard'
import { useStreamStore } from '../store/useStreamStore'

// Move calculateMargins outside component to prevent recreation
const calculateMargins = (): {
  horizontal: number;
  vertical: number;
  edgeHorizontal: number;
  edgeVertical: number;
} => {
  const viewportWidth = window.innerWidth
  const horizontalMargin = Math.max(Math.floor(viewportWidth * 0.004), 2)
  const verticalMargin = Math.max(Math.floor(viewportWidth * 0.003), 2)
  const edgeHorizontal = horizontalMargin * 7.5
  const edgeVertical = verticalMargin * 5

  return {
    horizontal: horizontalMargin,
    vertical: verticalMargin,
    edgeHorizontal,
    edgeVertical
  }
}

const ASPECT_RATIO = 16 / 9 // Standard video aspect ratio

interface StreamGridProps {
  streams: Stream[]
  layout: GridItem[]
  chats: { id: string; streamId: string; streamType: string; streamName: string; streamIdentifier: string }[]
  onRemoveStream: (id: string) => void
  onLayoutChange: (layout: GridItem[]) => void
  onEditStream: (stream: Stream) => void
  onAddChat: (streamIdentifier: string, streamId: string, streamName: string) => void
  onRemoveChat: (id: string) => void
}

export const StreamGrid = React.memo(({
  streams,
  layout,
  chats,
  onRemoveStream,
  onLayoutChange,
  onEditStream,
  onAddChat,
  onRemoveChat
}: StreamGridProps): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 1200, rowHeight: 100 })
  const resizeTimeoutRef = useRef<number>()

  const updateDimensions = useCallback((): void => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth
      const newWidth = Math.max(Math.floor(containerWidth), 480)

      // Match the algorithm's calculation exactly
      const APPBAR_HEIGHT = 64
      const containerHeight = window.innerHeight - APPBAR_HEIGHT
      const margins = calculateMargins()
      const horizontalMargins = margins.edgeHorizontal
      const verticalMargins = margins.edgeVertical
      const availableWidth = newWidth - horizontalMargins
      const availableHeight = containerHeight - verticalMargins

      const columnWidth = availableWidth / 24
      const maxRowsByWidth = Math.floor(columnWidth / ASPECT_RATIO)
      const maxRowsByHeight = Math.floor(availableHeight / 24)
      const newRowHeight = Math.min(maxRowsByWidth, maxRowsByHeight)
      setDimensions({ width: newWidth, rowHeight: newRowHeight })
    }
  }, [])

  const debouncedUpdateDimensions = useCallback((): void => {
    if (resizeTimeoutRef.current) {
      window.clearTimeout(resizeTimeoutRef.current)
    }
    resizeTimeoutRef.current = window.setTimeout(updateDimensions, 100)
  }, [updateDimensions])

  useEffect((): (() => void) => {
    updateDimensions()
    window.addEventListener('resize', debouncedUpdateDimensions)
    return () => {
      window.removeEventListener('resize', debouncedUpdateDimensions)
      if (resizeTimeoutRef.current) {
        window.clearTimeout(resizeTimeoutRef.current)
      }
    }
  }, [updateDimensions, debouncedUpdateDimensions])

  const setLastDraggedId = useStreamStore(state => state.setLastDraggedId)

  const handleLayoutChange = useCallback((newLayout: GridItem[]): void => {
    // Find which item was moved by comparing positions
    const movedItem = newLayout.find((item, index) => {
      const oldItem = layout[index]
      return oldItem && item.i === oldItem.i && (item.x !== oldItem.x || item.y !== oldItem.y)
    })
    if (movedItem) {
      setLastDraggedId(movedItem.i)
    }
    onLayoutChange(newLayout)
  }, [onLayoutChange, layout, setLastDraggedId])

  const lastDraggedId = useStreamStore(state => state.lastDraggedId)

  const memoizedContent = useMemo(() => ([
    ...streams.map(stream => (
      <div key={stream.id} style={{ zIndex: lastDraggedId === stream.id ? 1000 : 1 }}>
        <StreamCard
          stream={stream}
          onRemove={onRemoveStream}
          onEdit={onEditStream}
          onAddChat={onAddChat}
        />
      </div>
    )),
    ...chats.map(chat => (
      <div key={chat.id} style={{ zIndex: lastDraggedId === chat.id ? 1000 : 1 }}>
        <ChatCard
          id={chat.id}
          streamType={chat.streamType}
          streamName={chat.streamName}
          streamIdentifier={chat.streamIdentifier}
          onRemove={onRemoveChat}
        />
      </div>
    ))
  ]), [streams, chats, onRemoveStream, onEditStream, onAddChat, onRemoveChat, lastDraggedId])

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: '100vh',
        backgroundColor: 'background.default',
        overflow: 'auto',
        userSelect: 'none',
        position: 'relative',
        '& .react-grid-layout': {
          height: '100% !important',
          '& > .react-grid-item': {
            transition: 'transform 200ms ease !important',
            '&.react-draggable-dragging': {
              zIndex: 1000,
              '& > div': {
                pointerEvents: 'none'
              }
            },
            '& > div': {
              height: '100%',
              transition: 'none'
            }
          }
        },
        '& .react-resizable-handle': {
          width: '20px',
          height: '20px',
          bottom: '-10px',
          right: '-10px',
          cursor: 'se-resize',
          '&::after': {
            width: '12px',
            height: '12px',
            right: '5px',
            bottom: '5px'
          }
        }
      }}
    >
      <GridLayout
        className="layout"
        layout={layout}
        cols={24}
        width={dimensions.width}
        rowHeight={dimensions.rowHeight}
        margin={[calculateMargins().horizontal, calculateMargins().vertical]}
        useCSSTransforms={true}
        onLayoutChange={(layout): void => handleLayoutChange(layout as GridItem[])}
        isDraggable
        draggableHandle=".drag-handle"
        isResizable
        compactType={null}
        preventCollision={true}
        allowOverlap={true}
        maxRows={200}
      >
        {memoizedContent}
      </GridLayout>
    </Box>
  )
})

StreamGrid.displayName = 'StreamGrid'
