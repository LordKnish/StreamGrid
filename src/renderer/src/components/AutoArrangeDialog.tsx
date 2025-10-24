import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  Typography
} from '@mui/material'
import { GridOn, Warning } from '@mui/icons-material'

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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <GridOn color="primary" />
        Auto-Arrange Streams
      </DialogTitle>
      <DialogContent>
        <DialogContentText component="div">
          <Typography variant="body1" paragraph>
            This will automatically rearrange all <strong>{streamCount}</strong> stream{streamCount !== 1 ? 's' : ''} and chat{streamCount !== 1 ? 's' : ''} in your grid using an intelligent layout algorithm.
          </Typography>

          <Box sx={{ my: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              ✨ Smart Features:
            </Typography>
            <Typography variant="body2" component="ul" sx={{ pl: 2, mb: 0 }}>
              <li>Optimizes tile sizes to maximize screen space</li>
              <li>Maintains 16:9 aspect ratio for video streams</li>
              <li>Intelligently handles odd numbers of streams</li>
              <li>Centers the last row for aesthetic balance</li>
              <li>Minimizes wasted space in the grid</li>
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
            <Warning color="warning" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              Your current layout will be replaced.
            </Typography>
          </Box>
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
          color="primary"
          startIcon={<GridOn />}
        >
          Auto-Arrange
        </Button>
      </DialogActions>
    </Dialog>
  )
}
