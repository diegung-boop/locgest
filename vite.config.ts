import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { interDevProxyPlugin } from './src/server/interDevProxy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), interDevProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

