import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// public/sherpa/ holds gitignored wasm artifacts (regenerate with
// scripts/download-models.ps1); public/workers/ holds the committed
// classic workers that boot those artifacts.
export default defineConfig({
  plugins: [react()],
})
