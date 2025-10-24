import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Slider,
  Divider,
  IconButton
} from '@mui/material'
import { Close, VolumeOff, VolumeUp, PlayArrow } from '@mui/icons-material'
import { useStreamStore } from '../store/useStreamStore'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose }) => {
  const { settings, updateSettings } = useStreamStore()

  const handleDefaultMuteChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    updateSettings({ defaultMuteNewStreams: event.target.checked })
  }

  const handleAutoStartChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    updateSettings({ autoStartOnLaunch: event.target.checked })
  }

  const handleDelayChange = (_event: Event, value: number | number[]): void => {
    updateSettings({ autoStartDelay: value as number })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          bgcolor: 'background.paper'
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Settings</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Audio Settings Section */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <VolumeUp color="primary" />
            <Typography variant="subtitle1" fontWeight="bold">
              Audio Settings
            </Typography>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={settings.defaultMuteNewStreams}
                onChange={handleDefaultMuteChange}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2">Start new streams muted</Typography>
                <Typography variant="caption" color="text.secondary">
                  All newly added streams will start with audio muted
                </Typography>
              </Box>
            }
            sx={{ mb: 1, alignItems: 'flex-start' }}
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Auto-Start Settings Section */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PlayArrow color="primary" />
            <Typography variant="subtitle1" fontWeight="bold">
              Auto-Start Settings
            </Typography>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={settings.autoStartOnLaunch}
                onChange={handleAutoStartChange}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2">Auto-start streams on launch</Typography>
                <Typography variant="caption" color="text.secondary">
                  Automatically play all streams when the application opens
                </Typography>
              </Box>
            }
            sx={{ mb: 2, alignItems: 'flex-start' }}
          />

          {settings.autoStartOnLaunch && (
            <Box
              sx={{
                mt: 2,
                p: 2,
                bgcolor: 'action.hover',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Typography variant="body2" fontWeight="medium" gutterBottom>
                Start Delay: {settings.autoStartDelay} second{settings.autoStartDelay !== 1 ? 's' : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                Wait before starting streams after app launch
              </Typography>
              <Slider
                value={settings.autoStartDelay}
                onChange={handleDelayChange}
                min={0}
                max={5}
                step={1}
                marks={[
                  { value: 0, label: '0s' },
                  { value: 1, label: '1s' },
                  { value: 2, label: '2s' },
                  { value: 3, label: '3s' },
                  { value: 4, label: '4s' },
                  { value: 5, label: '5s' }
                ]}
                valueLabelDisplay="auto"
                sx={{ mt: 1 }}
              />
            </Box>
          )}
        </Box>

        <Box
          sx={{
            mt: 3,
            p: 2,
            bgcolor: 'info.main',
            color: 'info.contrastText',
            borderRadius: 1,
            opacity: 0.9
          }}
        >
          <Typography variant="caption">
            💡 Tip: All settings are automatically saved and will persist across app restarts
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            px: 3,
            borderRadius: 1,
            textTransform: 'none'
          }}
        >
          Done
        </Button>
      </DialogActions>
    </Dialog>
  )
}
