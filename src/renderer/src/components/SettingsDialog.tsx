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
  Slider,
  IconButton,
  TextField,
  Alert,
  Snackbar,
  InputAdornment
} from '@mui/material'
import {
  Close,
  VolumeUp,
  PlayArrow,
  Api,
  ContentCopy,
  Refresh,
  OpenInNew
} from '@mui/icons-material'
import { useStreamStore } from '../store/useStreamStore'
import { tokens } from '../theme'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

/** Quiet, intentional section header — muted icon + overline label, no AI-card formula. */
const SectionHeader: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
    <Box sx={{ display: 'flex', color: 'text.secondary', '& svg': { fontSize: 18 } }}>{icon}</Box>
    <Typography
      variant="overline"
      sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: '0.09em', lineHeight: 1 }}
    >
      {label}
    </Typography>
  </Box>
)

/** A single setting row: title + optional helper on the left, control on the right. */
const ToggleRow: React.FC<{
  title: string
  description?: string
  checked: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}> = ({ title, description, checked, onChange }) => (
  <Box
    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 0.5 }}
  >
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="caption" color="text.secondary">
          {description}
        </Typography>
      )}
    </Box>
    <Switch checked={checked} onChange={onChange} />
  </Box>
)

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

  const handleApiEnabledChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
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

  const apiBase = `http://localhost:${settings.apiPort}`

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}
      >
        Settings
        <IconButton
          onClick={onClose}
          size="small"
          aria-label="Close settings"
          sx={{ color: 'text.secondary' }}
        >
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          '& > section:not(:first-of-type)': {
            mt: 3,
            pt: 3,
            borderTop: `1px solid ${tokens.border}`
          }
        }}
      >
        {/* Audio */}
        <Box component="section">
          <SectionHeader icon={<VolumeUp />} label="Audio" />
          <ToggleRow
            title="Start new streams muted"
            description="Newly added streams begin without audio."
            checked={settings.defaultMuteNewStreams}
            onChange={handleDefaultMuteChange}
          />
        </Box>

        {/* Startup */}
        <Box component="section">
          <SectionHeader icon={<PlayArrow />} label="Startup" />
          <ToggleRow
            title="Auto-start streams on launch"
            description="Play every stream automatically when StreamGrid opens."
            checked={settings.autoStartOnLaunch}
            onChange={handleAutoStartChange}
          />

          {settings.autoStartOnLaunch && (
            <Box sx={{ mt: 2, pl: 0.5 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  mb: 0.5
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Start delay
                </Typography>
                <Typography
                  variant="body2"
                  color="primary.light"
                  sx={{ fontWeight: 600 }}
                >
                  {settings.autoStartDelay}s
                </Typography>
              </Box>
              <Slider
                value={settings.autoStartDelay}
                onChange={handleDelayChange}
                min={0}
                max={5}
                step={1}
                marks={[0, 1, 2, 3, 4, 5].map((v) => ({ value: v, label: `${v}s` }))}
                valueLabelDisplay="auto"
              />
            </Box>
          )}
        </Box>

        {/* REST API */}
        <Box component="section">
          <SectionHeader icon={<Api />} label="REST API" />
          <ToggleRow
            title="Enable REST API"
            description="Control StreamGrid from other apps over local HTTP."
            checked={settings.apiEnabled}
            onChange={handleApiEnabledChange}
          />

          {settings.apiEnabled && (
            <Box sx={{ mt: 2 }}>
              {/* Status pill */}
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.25,
                  py: 0.5,
                  mb: 2,
                  borderRadius: 999,
                  border: `1px solid ${tokens.border}`,
                  backgroundColor: 'rgba(255,255,255,0.03)'
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: apiServerRunning ? 'success.main' : 'text.disabled',
                    boxShadow: apiServerRunning ? '0 0 8px rgba(52,211,153,0.7)' : 'none'
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: apiServerRunning ? 'success.main' : 'text.secondary'
                  }}
                >
                  {apiServerRunning ? 'Server running' : 'Server stopped'}
                </Typography>
              </Box>

              <TextField
                label="Port"
                type="number"
                value={settings.apiPort}
                onChange={handlePortChange}
                size="small"
                fullWidth
                sx={{ mb: 2 }}
                helperText={apiBase}
                FormHelperTextProps={{ sx: { mx: 0.5 } }}
              />

              <TextField
                label="API key"
                value={settings.apiKey || 'Not generated'}
                size="small"
                fullWidth
                InputProps={{
                  readOnly: true,
                  sx: { fontSize: '0.8rem' },
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={handleCopyApiKey}
                        size="small"
                        disabled={!settings.apiKey}
                        title="Copy API key"
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>
                      <IconButton
                        onClick={handleGenerateApiKey}
                        size="small"
                        title="Generate new key"
                      >
                        <Refresh fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                helperText="Regenerating immediately invalidates the previous key."
                sx={{ mb: 1.5 }}
              />

              <Button
                variant="text"
                size="small"
                endIcon={<OpenInNew sx={{ fontSize: 15 }} />}
                onClick={() =>
                  window.api.openExternal(
                    'https://github.com/LordKnish/StreamGrid/blob/main/docs/API.md'
                  )
                }
                sx={{ px: 0.5, color: 'primary.light' }}
              >
                API documentation
              </Button>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
          Changes save automatically
        </Typography>
        <Button onClick={onClose} variant="contained" sx={{ px: 3 }}>
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
      <Snackbar open={!!apiError} autoHideDuration={4000} onClose={() => setApiError(null)}>
        <Alert severity="error" onClose={() => setApiError(null)}>
          {apiError}
        </Alert>
      </Snackbar>
    </Dialog>
  )
}
