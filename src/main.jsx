import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

const DATA_RESET_VERSION = '2026-07-20-force-clear-all-penny-data-v2'
const BLANK_STATE = {
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
}

function removePennyKeys(storage) {
  if (!storage) return
  const keys = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key && /(^|[_:.-])penny([_:.-]|$)/i.test(key)) keys.push(key)
  }
  keys.forEach((key) => storage.removeItem(key))
}

async function forceClearPennyData() {
  try {
    if (localStorage.getItem('penny_data_reset_version') === DATA_RESET_VERSION) return

    removePennyKeys(localStorage)
    removePennyKeys(sessionStorage)

    localStorage.setItem('penny_state', JSON.stringify(BLANK_STATE))
    localStorage.setItem('penny_data_reset_version', DATA_RESET_VERSION)

    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames
          .filter((name) => /penny/i.test(name))
          .map((name) => caches.delete(name))
      )
    }

    if (indexedDB?.databases) {
      const databases = await indexedDB.databases()
      databases
        .filter((database) => database.name && /penny/i.test(database.name))
        .forEach((database) => indexedDB.deleteDatabase(database.name))
    }
  } catch {
    try {
      localStorage.setItem('penny_state', JSON.stringify(BLANK_STATE))
      localStorage.setItem('penny_data_reset_version', DATA_RESET_VERSION)
    } catch {
      // Penny still opens if browser storage is unavailable.
    }
  }
}

function renderApp() {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

forceClearPennyData().finally(renderApp)
