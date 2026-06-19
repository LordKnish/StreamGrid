import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button
} from '@mui/material'

interface AutoArrangeDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  streamCount: number
}

export const AutoArrangeDialog: React.FC<AutoArrangeDialogProps> = ({
  open,
  onClose,
  onConfirm,
  streamCount
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Auto-arrange grid?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          This re-tiles all {streamCount} item{streamCount === 1 ? '' : 's'} to fit the window and
          replaces your current layout. This can&apos;t be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={() => {
            onConfirm()
            onClose()
          }}
          variant="contained"
          autoFocus
        >
          Auto-arrange
        </Button>
      </DialogActions>
    </Dialog>
  )
}
