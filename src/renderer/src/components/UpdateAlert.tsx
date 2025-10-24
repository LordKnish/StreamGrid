import React, { useEffect, useState } from 'react'
import { Alert, Link, Box, IconButton } from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'
import { compareVersions } from 'compare-versions'
export const UpdateAlert: React.FC = () => {
  const [showAlert, setShowAlert] = useState(false)
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const currentVersion = window.api?.version || '2.0.0'

  // Set to true to always show the update alert for testing
  const TESTING_MODE = false

  useEffect(() => {
    const checkVersion = async (): Promise<void> => {
      try {
        if (!window.api?.getGitHubVersion) {
          return
        }
        const githubVersion = await window.api.getGitHubVersion()
        if (TESTING_MODE || (githubVersion && compareVersions(githubVersion, currentVersion) > 0)) {
          setLatestVersion(githubVersion)
          setShowAlert(true)
        }
      } catch (error) {
        console.error('Error checking version:', error)
      }
    }

    checkVersion()
  }, [currentVersion])

  if (!showAlert || !latestVersion) {
    return null
  }

  return (
    <Box
      sx={{
        position: 'absolute',
        top: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1100,
        minWidth: '300px',
        maxWidth: '90%'
      }}
    >
      <Alert
        severity="info"
        action={
          <IconButton
            aria-label="close"
            color="inherit"
            size="small"
            onClick={() => setShowAlert(false)}
          >
            <CloseIcon fontSize="inherit" />
          </IconButton>
        }
        sx={{
          borderRadius: 2,
          boxShadow: 2,
          '& .MuiAlert-message': {
            display: 'flex',
            alignItems: 'center',
            gap: 1
          },
          '& .MuiAlert-action': {
            paddingTop: 0,
            alignItems: 'center'
          }
        }}
      >
        A new version ({latestVersion}) is available!
        <Link
          href="https://github.com/LordKnish/StreamGrid/releases/latest"
          target="_blank"
          rel="noopener noreferrer"
          sx={{ cursor: 'pointer' }}
        >
          Download here
        </Link>
      </Alert>
    </Box>
  )
}
