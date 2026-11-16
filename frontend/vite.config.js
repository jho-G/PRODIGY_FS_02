import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  oxc: mode === 'production' ? {
    drop: ['console', 'debugger'],
  } : {},
  build: {
    sourcemap: mode !== 'production',
  },
}))
