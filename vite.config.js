import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { recordDateLayoutPlugin } from './build/record-date-layout.js'
import { primaryNavV64Plugin } from './build/primary-nav-v64.js'
import { transferPlanTabPlugin } from './build/transfer-plan-tab.js'
import { accountResolutionUiV76Plugin } from './build/account-resolution-ui-v76.js'
import { monthSelectorV74Plugin } from './build/month-selector-v74.js'
import { desktopMonthPickerV75Plugin } from './build/desktop-month-picker-v75.js'

// https://vitejs.dev
export default defineConfig({
  plugins: [recordDateLayoutPlugin(), primaryNavV64Plugin(), transferPlanTabPlugin(), accountResolutionUiV76Plugin(), monthSelectorV74Plugin(), desktopMonthPickerV75Plugin(), react()],
  base: '/penny-budget/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  }
})
