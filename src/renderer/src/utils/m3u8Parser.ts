/**
 * M3U/M3U8 Playlist Parser
 * Parses IPTV-style M3U playlists with EXTINF metadata
 * Supports both local files and remote URLs
 */

export interface ParsedM3UEntry {
  name: string
  streamUrl: string
  logoUrl?: string
  duration?: number
  attributes?: Record<string, string>
}

export interface M3UParseResult {
  entries: ParsedM3UEntry[]
  errors: string[]
  totalLines: number
  validEntries: number
}

/**
 * Parse M3U/M3U8 playlist content
 * @param content - Raw M3U file content
 * @returns Parsed result with entries and errors
 */
export function parseM3U(content: string): M3UParseResult {
  // Remove BOM (Byte Order Mark) if present
  const cleanContent = content.replace(/^\uFEFF/, '').replace(/^\ufeff/, '')
  const lines = cleanContent.split(/\r?\n/).map(line => line.trim())
  const entries: ParsedM3UEntry[] = []
  const errors: string[] = []
  let currentEntry: Partial<ParsedM3UEntry> | null = null
  let lineNumber = 0

  console.log('[M3U Parser] Starting parse, total lines:', lines.length)
  console.log('[M3U Parser] First 5 lines:', lines.slice(0, 5))

  for (const line of lines) {
    lineNumber++

    // Skip empty lines
    if (!line) continue

    // Log first few non-empty lines to see what we're dealing with
    if (lineNumber <= 10) {
      console.log(`[M3U Parser] Line ${lineNumber}:`, JSON.stringify(line), 'starts with #:', line.startsWith('#'), 'starts with #EXTINF:', line.startsWith('#EXTINF'))
    }

    // Skip comments that aren't EXTINF or EXTM3U
    if (line.startsWith('#') && !line.startsWith('#EXTINF') && !line.startsWith('#EXTM3U')) {
      continue
    }

    // Handle EXTM3U header
    if (line.startsWith('#EXTM3U')) {
      console.log('[M3U Parser] Found EXTM3U header')
      continue
    }

    // Handle EXTINF metadata line
    if (line.startsWith('#EXTINF')) {
      try {
        currentEntry = parseEXTINF(line)
        console.log('[M3U Parser] Parsed EXTINF:', currentEntry)
      } catch (error) {
        const errorMsg = `Line ${lineNumber}: Failed to parse EXTINF - ${error instanceof Error ? error.message : String(error)}`
        console.error('[M3U Parser]', errorMsg)
        errors.push(errorMsg)
        currentEntry = null
      }
      continue
    }

    // Handle stream URL line
    if (currentEntry && !line.startsWith('#')) {
      // Extract base URL (before pipe character if present)
      const baseUrl = line.split('|')[0].trim()

      console.log('[M3U Parser] Processing URL:', baseUrl)

      // Validate URL
      if (isValidStreamUrl(baseUrl)) {
        const entry = {
          name: currentEntry.name || 'Unnamed Stream',
          streamUrl: baseUrl, // Use only the base URL, ignore headers for now
          logoUrl: currentEntry.logoUrl,
          duration: currentEntry.duration,
          attributes: currentEntry.attributes
        }
        entries.push(entry)
        console.log('[M3U Parser] Added entry:', entry)
      } else {
        const errorMsg = `Line ${lineNumber}: Invalid stream URL - ${line}`
        console.error('[M3U Parser]', errorMsg)
        errors.push(errorMsg)
      }
      currentEntry = null
    }
  }

  // Check for incomplete entry at end of file
  if (currentEntry) {
    errors.push(`End of file: EXTINF without corresponding stream URL`)
  }

  console.log('[M3U Parser] Parse complete. Entries:', entries.length, 'Errors:', errors.length)

  return {
    entries,
    errors,
    totalLines: lines.length,
    validEntries: entries.length
  }
}

/**
 * Parse EXTINF line to extract metadata
 * Format: #EXTINF:duration [attributes],Channel Name
 * Example: #EXTINF:-1 tvg-logo="logo.png" group-title="News",Channel Name
 */
function parseEXTINF(line: string): Partial<ParsedM3UEntry> {
  // Remove #EXTINF: prefix
  const content = line.substring(8).trim()

  // Split by comma to separate attributes from name
  const commaIndex = content.lastIndexOf(',')
  if (commaIndex === -1) {
    throw new Error('Invalid EXTINF format: missing comma separator')
  }

  const attributesPart = content.substring(0, commaIndex).trim()
  const name = content.substring(commaIndex + 1).trim()

  // Parse duration (first token before space)
  const spaceIndex = attributesPart.indexOf(' ')
  const durationStr = spaceIndex > 0 ? attributesPart.substring(0, spaceIndex) : attributesPart
  const duration = parseFloat(durationStr)

  // Parse attributes
  const attributesStr = spaceIndex > 0 ? attributesPart.substring(spaceIndex + 1).trim() : ''
  const attributes = parseAttributes(attributesStr)

  // Extract logo from various attribute formats
  const logoUrl = extractLogo(attributes, attributesStr)

  return {
    name: name || 'Unnamed Stream',
    duration: isNaN(duration) ? -1 : duration,
    logoUrl,
    attributes
  }
}

/**
 * Parse attributes from EXTINF line
 * Supports formats: key="value" or key=value
 */
function parseAttributes(attributesStr: string): Record<string, string> {
  const attributes: Record<string, string> = {}

  if (!attributesStr) return attributes

  // Match key="value" or key=value patterns
  const regex = /(\w+(?:-\w+)*)=(?:"([^"]*)"|([^\s]*))/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(attributesStr)) !== null) {
    const key = match[1]
    const value = match[2] || match[3] || ''
    attributes[key] = value
  }

  return attributes
}

/**
 * Extract logo URL from attributes
 * Supports: logo="...", tvg-logo="...", and filters out invalid formats
 */
function extractLogo(attributes: Record<string, string>, rawAttributesStr: string): string | undefined {
  // Try standard attribute keys
  const tvgLogo = attributes['tvg-logo']
  if (tvgLogo && isValidLogoUrl(tvgLogo)) {
    return tvgLogo
  }

  const logo = attributes['logo']
  if (logo && isValidLogoUrl(logo)) {
    return logo
  }

  // Try to extract logo from raw string
  const logoMatch = rawAttributesStr.match(/logo=["']?([^"'\s]+)["']?/i)
  if (logoMatch) {
    const logoPath = logoMatch[1]

    // Only return if it's a valid URL
    if (isValidLogoUrl(logoPath)) {
      return logoPath
    }
  }

  return undefined
}

/**
 * Validate if a logo URL is valid (not pkg:// or other invalid protocols)
 */
function isValidLogoUrl(url: string): boolean {
  if (!url) return false

  // Skip pkg:// URLs (platform-specific)
  if (url.startsWith('pkg:')) return false

  // Accept http, https, and data URLs
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return true
  }

  // Reject other protocols
  return false
}

/**
 * Validate if a string is a valid stream URL
 * Accepts HTTP/HTTPS URLs and any other non-empty strings (for encoded streams, etc.)
 */
function isValidStreamUrl(url: string): boolean {
  if (!url || !url.trim()) return false

  // Accept any non-empty string as potentially valid
  // ReactPlayer and the video player will determine if it's actually playable
  return true
}

/**
 * Fetch M3U content from a remote URL
 */
export async function fetchM3UFromUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'StreamGrid/2.0'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const content = await response.text()
    return content
  } catch (error) {
    throw new Error(`Failed to fetch M3U from URL: ${error instanceof Error ? error.message : String(error)}`)
  }
}
