import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { recordDateLayoutPlugin } from './build/record-date-layout.js'
import { transferPlanTabPlugin } from './build/transfer-plan-tab.js'

// https://vitejs.dev
export default defineConfig({
  plugins: [recordDateLayoutPlugin(), transferPlanTabPlugin(), react()],
  base: '/penny-budget/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  }
})
