import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'

export interface ApiAuthConfig {
  apiKey: string
  enabled: boolean
}

let authConfig: ApiAuthConfig = {
  apiKey: '',
  enabled: false
}

/**
 * Generate a secure random API key
 */
export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Update the authentication configuration
 */
export function updateAuthConfig(config: Partial<ApiAuthConfig>): void {
  authConfig = { ...authConfig, ...config }
}

/**
 * Get current auth configuration
 */
export function getAuthConfig(): ApiAuthConfig {
  return { ...authConfig }
}

/**
 * Express middleware for API key authentication
 */
export function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  // If API is disabled, reject all requests
  if (!authConfig.enabled) {
    res.status(503).json({
      error: 'API is disabled',
      message: 'The REST API is currently disabled. Enable it in settings.'
    })
    return
  }

  // Check for API key in header
  const providedKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '')

  if (!providedKey) {
    res.status(401).json({
      error: 'Missing API key',
      message: 'Provide API key in X-API-Key header or Authorization: Bearer <key>'
    })
    return
  }

  // Validate API key
  if (providedKey !== authConfig.apiKey) {
    res.status(403).json({
      error: 'Invalid API key',
      message: 'The provided API key is invalid'
    })
    return
  }

  // Authentication successful
  next()
}

/**
 * Health check endpoint (no auth required)
 */
export function healthCheck(_req: Request, res: Response): void {
  res.json({
    status: 'ok',
    apiEnabled: authConfig.enabled,
    timestamp: new Date().toISOString()
  })
}
