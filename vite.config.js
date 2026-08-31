import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { recordDateLayoutPlugin } from './build/record-date-layout.js'
import { primaryNavV64Plugin } from './build/primary-nav-v64.js'
import { transferPlanTabPlugin } from './build/transfer-plan-tab.js'

// https://vitejs.dev
export default defineConfig({
  plugins: [recordDateLayoutPlugin(), primaryNavV64Plugin(), transferPlanTabPlugin(), react()],
  base: '/penny-budget/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  }
})
