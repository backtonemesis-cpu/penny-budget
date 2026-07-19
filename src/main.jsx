import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

const DATA_RESET_VERSION = '2026-07-20-clear-user-data-v1'

try {
  if (localStorage.getItem('penny_data_reset_version') !== DATA_RESET_VERSION) {
    localStorage.setItem('penny_state', JSON.stringify({
      version: 2,
      txnsByMonth: {},
      incomeByMonth: {},
      customCats: [],
      hiddenCats: [],
      budgets: {},
      dueDays: {},
      savingsGoal: 0,
      savingsBal: 0,
      savingsContrib: 0,
    }))
    localStorage.setItem('penny_data_reset_version', DATA_RESET_VERSION)
  }
} catch {
  // Penny still opens if browser storage is unavailable.
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
