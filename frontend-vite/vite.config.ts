import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  // Get backend URL from environment variable, fallback to localhost for development
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:5016'
  
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      sourcemap: false, // Disable source maps in production to reduce file count
      rollupOptions: {
        output: {
          manualChunks: {
            // Split vendor chunks to reduce individual file sizes
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-popover', '@radix-ui/react-select'],
          },
        },
      },
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              // Forward cookies from browser to backend
              if (req.headers.cookie) {
                proxyReq.setHeader('cookie', req.headers.cookie);
              }
            });
          },
        },
      },
    },
  }
})
