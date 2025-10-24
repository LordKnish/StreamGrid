import React, { useState, useEffect } from 'react'
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
  IconButton,
  TextField,
  Alert,
  Snackbar,
  InputAdornment
} from '@mui/material'
import { Close, VolumeUp, PlayArrow, Api, ContentCopy, Refresh, CheckCircle } from '@mui/icons-material'
import { useStreamStore } from '../store/useStreamStore'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose }) => {
  const { settings, updateSettings } = useStreamStore()
  const [apiServerRunning, setApiServerRunning] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Check API server status on mount and when dialog opens
  useEffect(() => {
    if (open) {
      checkApiStatus()
    }
  }, [open])

  const checkApiStatus = async (): Promise<void> => {
    try {
      const status = await window.api.getApiServerStatus()
      setApiServerRunning(status.running)
    } catch (error) {
      console.error('Failed to check API status:', error)
    }
  }

  const handleDefaultMuteChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    updateSettings({ defaultMuteNewStreams: event.target.checked })
  }

  const handleAutoStartChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    updateSettings({ autoStartOnLaunch: event.target.checked })
  }

  const handleDelayChange = (_event: Event, value: number | number[]): void => {
    updateSettings({ autoStartDelay: value as number })
  }

  const handleApiEnabledChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const enabled = event.target.checked
    updateSettings({ apiEnabled: enabled })

    try {
      if (enabled) {
        // Generate API key if not exists
        let apiKey = settings.apiKey
        if (!apiKey) {
          apiKey = await window.api.generateApiKey()
          updateSettings({ apiKey })
        }

        const result = await window.api.startApiServer({
          port: settings.apiPort,
          apiKey: apiKey,
          enabled: true
        })

        if (result.success) {
          setApiServerRunning(true)
          setApiError(null)
        } else {
          setApiError(result.error || 'Failed to start API server')
          updateSettings({ apiEnabled: false })
        }
      } else {
        await window.api.stopApiServer()
        setApiServerRunning(false)
        setApiError(null)
      }
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Unknown error')
      updateSettings({ apiEnabled: false })
    }
  }

  const handlePortChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const port = parseInt(event.target.value, 10)
    if (!isNaN(port) && port > 0 && port < 65536) {
      updateSettings({ apiPort: port })
    }
  }

  const handleGenerateApiKey = async (): Promise<void> => {
    try {
      const newKey = await window.api.generateApiKey()
      updateSettings({ apiKey: newKey })

      // Restart server if running
      if (settings.apiEnabled && apiServerRunning) {
        await window.api.restartApiServer({
          port: settings.apiPort,
          apiKey: newKey,
          enabled: true
        })
      }
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Failed to generate API key')
    }
  }

  const handleCopyApiKey = (): void => {
    if (settings.apiKey) {
      navigator.clipboard.writeText(settings.apiKey)
      setCopySuccess(true)
    }
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

        <Divider sx={{ my: 3 }} />

        {/* API Settings Section */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Api color="primary" />
            <Typography variant="subtitle1" fontWeight="bold">
              REST API Settings
            </Typography>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={settings.apiEnabled}
                onChange={handleApiEnabledChange}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2">Enable REST API</Typography>
                <Typography variant="caption" color="text.secondary">
                  Allow external control via HTTP API
                </Typography>
              </Box>
            }
            sx={{ mb: 2, alignItems: 'flex-start' }}
          />

          {settings.apiEnabled && (
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
              {/* API Server Status */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CheckCircle
                  sx={{
                    color: apiServerRunning ? 'success.main' : 'text.disabled',
                    fontSize: 20
                  }}
                />
                <Typography variant="body2" color={apiServerRunning ? 'success.main' : 'text.secondary'}>
                  {apiServerRunning ? 'API Server Running' : 'API Server Stopped'}
                </Typography>
              </Box>

              {/* Port Configuration */}
              <TextField
                label="API Port"
                type="number"
                value={settings.apiPort}
                onChange={handlePortChange}
                size="small"
                fullWidth
                sx={{ mb: 2 }}
                helperText={`API URL: http://localhost:${settings.apiPort}`}
              />

              {/* API Key */}
              <TextField
                label="API Key"
                value={settings.apiKey || 'Not generated'}
                size="small"
                fullWidth
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={handleCopyApiKey}
                        size="small"
                        disabled={!settings.apiKey}
                        title="Copy API Key"
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>
                      <IconButton
                        onClick={handleGenerateApiKey}
                        size="small"
                        title="Generate New API Key"
                      >
                        <Refresh fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                sx={{ mb: 1 }}
              />

              <Typography variant="caption" color="warning.main" sx={{ display: 'block', mb: 1 }}>
                ⚠️ Keep your API key secure. Regenerating will invalidate the old key.
              </Typography>

              <Button
                variant="outlined"
                size="small"
                onClick={() => window.api.openExternal('https://github.com/LordKnish/StreamGrid/blob/main/docs/API.md')}
                sx={{ textTransform: 'none' }}
              >
                View API Documentation
              </Button>
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

      {/* Success Snackbar */}
      <Snackbar
        open={copySuccess}
        autoHideDuration={2000}
        onClose={() => setCopySuccess(false)}
        message="API key copied to clipboard"
      />

      {/* Error Snackbar */}
      <Snackbar
        open={!!apiError}
        autoHideDuration={4000}
        onClose={() => setApiError(null)}
      >
        <Alert severity="error" onClose={() => setApiError(null)}>
          {apiError}
        </Alert>
      </Snackbar>
    </Dialog>
  )
}
