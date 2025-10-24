import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['electron-updater']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    server: {
      // Remove CSP headers to allow local file access
      headers: {}
    },
    build: {
      // Enable code splitting
      rollupOptions: {
        output: {
          // Simplified manual chunks - only vendor packages
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'mui-vendor': ['@mui/material', '@mui/icons-material'],
            'player-vendor': ['react-player'],
            'utils': ['lodash', 'uuid', 'jdenticon', 'web-vitals', 'react-window']
          },
          // Use dynamic imports for better splitting
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk'
            return `js/${facadeModuleId}-[hash].js`
          }
        }
      },
      // Optimize chunk size
      chunkSizeWarningLimit: 1000,
      // Enable minification but keep console/debugger for debugging
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false,
          drop_debugger: false
        }
      },
      // Enable source maps for production debugging
      sourcemap: true,
      // Optimize CSS
      cssCodeSplit: true,
      // Asset optimization
      assetsInlineLimit: 4096,
      // Enable module preload polyfill
      modulePreload: {
        polyfill: true
      }
    },
    optimizeDeps: {
      // Pre-bundle heavy dependencies
      include: [
        'react',
        'react-dom',
        '@mui/material',
        'react-player',
        'lodash',
        'react-window'
      ],
      // Exclude dependencies that should be external
      exclude: ['electron']
    }
  }
})
