import { createTheme, alpha } from '@mui/material'

/**
 * StreamGrid design system — "Aurora" (v1.0)
 *
 * A warm, atmospheric, command-center language for a wall of live video.
 * Translucent glass surfaces float over a soft aurora wash on an indigo-black
 * canvas; a violet→fuchsia gradient marks brand + primary actions, and a single
 * electric cyan means "live". Expressive display type (Bricolage Grotesque)
 * over a calm grotesque (Hanken Grotesk). There is no monospace.
 *
 * Fonts are loaded via the Google Fonts <link> in src/renderer/index.html
 * (Bricolage Grotesque 600/700 + Hanken Grotesk 400/500/600/700).
 *
 * NOTE on the accent: the brand accent is a GRADIENT, which MUI's palette
 * cannot store as a single color. `palette.primary.main` holds the violet
 * endpoint (for focus rings, text accents, checked states); use the exported
 * `GRADIENT` constant for any filled brand surface (primary buttons, the mark,
 * active highlights).
 */

// ── Accent ───────────────────────────────────────────────────────────────
const VIOLET = '#8B5CF6'
const FUCHSIA = '#E15CFF'
export const GRADIENT = `linear-gradient(135deg, ${VIOLET}, ${FUCHSIA})`
const ACCENT_SOFT = alpha(VIOLET, 0.16)
const LIVE = '#34E5C4' // electric cyan — the ONLY "live/online" color
const WARN = '#FFC15C'
const ERROR = '#FF6B81'
const ERROR_TEXT = '#FF9AAA'

// ── Surfaces (indigo-black) ────────────────────────────────────────────────
const BG = '#0B0A12' // app canvas
const SURFACE = '#15131F' // solid raised surface (dialogs, menus)
const FEED = '#0F0C18' // feed tile fill
const GLASS = 'rgba(255,255,255,0.05)' // glass panel fill (over backdrop)
const GLASS_HI = 'rgba(255,255,255,0.08)' // hovered / raised glass
const BORDER = 'rgba(255,255,255,0.10)'
const BORDER_STRONG = 'rgba(255,255,255,0.18)'

const TEXT = '#F4F2FB'
const TEXT_2 = '#ADA9C4'
const TEXT_3 = '#6E6A85'

// Soft aurora backdrop — apply to a fixed full-bleed layer behind content.
const BACKDROP =
  'radial-gradient(900px 540px at 4% -12%, rgba(139,92,246,.09), transparent 62%),' +
  'radial-gradient(820px 640px at 100% 112%, rgba(52,229,196,.05), transparent 64%)'

const FONT_BODY = [
  '"Hanken Grotesk"',
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Helvetica',
  'Arial',
  'sans-serif'
].join(',')

const FONT_DISPLAY = ['"Bricolage Grotesque"', FONT_BODY].join(',')

const MOTION = '160ms cubic-bezier(0.4, 0, 0.2, 1)'

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: VIOLET, light: '#A78BFA', dark: '#7C46E8', contrastText: '#FFFFFF' },
    secondary: { main: FUCHSIA, contrastText: '#FFFFFF' },
    error: { main: ERROR },
    warning: { main: WARN },
    success: { main: LIVE, contrastText: '#04140F' },
    info: { main: '#7F8DA3' },
    background: { default: BG, paper: SURFACE },
    divider: BORDER,
    text: { primary: TEXT, secondary: TEXT_2, disabled: alpha(TEXT, 0.4) },
    action: {
      hover: 'rgba(255,255,255,0.06)',
      selected: ACCENT_SOFT,
      disabled: alpha(TEXT, 0.3),
      disabledBackground: 'rgba(255,255,255,0.06)'
    }
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: FONT_BODY,
    // Headlines + titles use the expressive display face.
    h1: { fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: '-0.04em' },
    h2: { fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: '-0.03em' },
    h3: { fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: '-0.025em' },
    h4: { fontFamily: FONT_DISPLAY, fontWeight: 600, letterSpacing: '-0.02em' },
    h5: { fontFamily: FONT_DISPLAY, fontWeight: 600, letterSpacing: '-0.015em' },
    h6: { fontFamily: FONT_DISPLAY, fontWeight: 600, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { fontWeight: 600, letterSpacing: 0 },
    caption: { color: TEXT_2, lineHeight: 1.5 }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': { colorScheme: 'dark' },
        body: {
          backgroundColor: BG,
          color: TEXT,
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale'
        },
        // Live indicator pulse — apply to the dot inside any LIVE badge.
        '@keyframes sg-pulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 }
        },
        '*::-webkit-scrollbar': { width: 10, height: 10 },
        '*::-webkit-scrollbar-thumb': {
          backgroundColor: 'rgba(255,255,255,0.14)',
          borderRadius: 8,
          border: '2px solid transparent',
          backgroundClip: 'content-box'
        },
        '*::-webkit-scrollbar-thumb:hover': { backgroundColor: 'rgba(255,255,255,0.24)' },
        '*::-webkit-scrollbar-corner': { backgroundColor: 'transparent' },
        '::selection': { backgroundColor: FUCHSIA, color: BG },
        // react-grid-layout polish — on-brand drag placeholder + smooth motion
        '.react-grid-item.react-grid-placeholder': {
          backgroundColor: `${ACCENT_SOFT} !important`,
          border: `2px dashed ${alpha(VIOLET, 0.7)}`,
          borderRadius: 14,
          opacity: '1 !important',
          transitionDuration: '120ms'
        },
        '.react-grid-item.react-draggable-dragging': { transition: 'none', zIndex: 100 },
        '.react-grid-item > .react-resizable-handle::after': {
          borderColor: 'rgba(255,255,255,0.45)'
        }
      }
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'transparent' },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(11,10,18,0.6)',
          backdropFilter: 'blur(30px)',
          borderBottom: `1px solid ${BORDER}`
        }
      }
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiDialog: {
      defaultProps: { transitionDuration: 200 },
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: SURFACE,
          borderRadius: 22,
          border: `1px solid ${BORDER}`,
          boxShadow: '0 40px 100px -24px rgba(0,0,0,0.7)'
        }
      }
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: { fontFamily: FONT_DISPLAY, fontWeight: 600, letterSpacing: '-0.01em' }
      }
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: SURFACE,
          borderRadius: 16,
          border: `1px solid ${BORDER}`,
          boxShadow: '0 20px 50px -16px rgba(0,0,0,0.7)',
          marginTop: 6
        },
        list: { padding: 6 }
      }
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          minHeight: 40,
          transition: `background-color ${MOTION}`,
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
          '&.Mui-selected': { backgroundColor: ACCENT_SOFT }
        }
      }
    },
    MuiListItemIcon: {
      styleOverrides: { root: { minWidth: 34, color: TEXT_2 } }
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 12,
          fontWeight: 600,
          paddingInline: 18,
          transition: `background-color ${MOTION}, border-color ${MOTION}, box-shadow ${MOTION}`
        },
        // Primary = the brand gradient (see GRADIENT export).
        containedPrimary: {
          backgroundImage: GRADIENT,
          color: '#FFFFFF',
          boxShadow: `0 8px 24px -8px ${alpha(FUCHSIA, 0.55)}`,
          '&:hover': { boxShadow: `0 10px 28px -8px ${alpha(FUCHSIA, 0.7)}` }
        },
        outlined: {
          borderColor: BORDER_STRONG,
          backgroundColor: GLASS_HI,
          '&:hover': { borderColor: alpha(VIOLET, 0.6), backgroundColor: alpha(VIOLET, 0.12) }
        },
        text: { color: TEXT_2, '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' } }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: 10, transition: `background-color ${MOTION}, color ${MOTION}` }
      }
    },
    MuiTooltip: {
      defaultProps: { arrow: true, enterDelay: 400 },
      styleOverrides: {
        tooltip: {
          backgroundColor: SURFACE,
          border: `1px solid ${BORDER}`,
          fontSize: '0.75rem',
          fontWeight: 500,
          padding: '6px 10px',
          borderRadius: 9
        },
        arrow: { color: SURFACE }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 600 },
        sizeSmall: { height: 22, fontSize: '0.72rem' },
        outlined: { borderColor: BORDER_STRONG, backgroundColor: GLASS_HI }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 13,
          backgroundColor: 'rgba(0,0,0,0.25)',
          transition: `border-color ${MOTION}, box-shadow ${MOTION}`,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER_STRONG },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(VIOLET, 0.5) },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: VIOLET,
            boxShadow: `0 0 0 3px ${alpha(VIOLET, 0.22)}`
          }
        }
      }
    },
    MuiInputLabel: {
      styleOverrides: { root: { '&.Mui-focused': { color: VIOLET } } }
    },
    MuiSwitch: {
      styleOverrides: {
        root: { width: 46, height: 26, padding: 0, marginRight: 4 },
        switchBase: {
          padding: 3,
          '&.Mui-checked': {
            transform: 'translateX(20px)',
            color: '#fff',
            '& + .MuiSwitch-track': { backgroundImage: GRADIENT, opacity: 1 }
          }
        },
        thumb: { width: 20, height: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.4)' },
        track: { borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.18)', opacity: 1 }
      }
    },
    MuiCheckbox: {
      styleOverrides: { root: { '&.Mui-checked': { color: VIOLET } } }
    },
    MuiDivider: { styleOverrides: { root: { borderColor: BORDER } } },
    MuiSlider: {
      styleOverrides: {
        root: { height: 4, color: VIOLET },
        thumb: {
          width: 16,
          height: 16,
          '&:hover, &.Mui-focusVisible': { boxShadow: `0 0 0 8px ${alpha(VIOLET, 0.18)}` }
        },
        rail: { opacity: 0.2 }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: GLASS,
          backdropFilter: 'blur(24px)',
          border: `1px solid ${BORDER}`,
          borderRadius: 18,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)'
        }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12, border: `1px solid ${BORDER}` },
        standardSuccess: { backgroundColor: alpha(LIVE, 0.1), color: LIVE },
        standardWarning: { backgroundColor: alpha(WARN, 0.1), color: WARN },
        standardError: { backgroundColor: alpha(ERROR, 0.1), color: ERROR_TEXT }
      }
    }
  }
})

// Shared constants for bespoke (non-MUI) chrome and inline styles.
export const tokens = {
  gradient: GRADIENT,
  violet: VIOLET,
  fuchsia: FUCHSIA,
  accentSoft: ACCENT_SOFT,
  live: LIVE,
  warn: WARN,
  error: ERROR,
  errorText: ERROR_TEXT,
  bg: BG,
  surface: SURFACE,
  feed: FEED,
  glass: GLASS,
  glassHi: GLASS_HI,
  border: BORDER,
  borderStrong: BORDER_STRONG,
  text: TEXT,
  text2: TEXT_2,
  text3: TEXT_3,
  backdrop: BACKDROP,
  fontDisplay: FONT_DISPLAY,
  fontBody: FONT_BODY,
  motion: MOTION
}
