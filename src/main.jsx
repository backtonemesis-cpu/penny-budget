import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { createBlankState } from './finance.js'
import './mobile-overflow-fix.css'

const DATA_RESET_VERSION = '2026-07-20-factory-reset-all-months-v3'
const BLANK_STATE = createBlankState(2020, 2035)

function removeMatchingStorage(storage) {
  if (!storage) return
  const keys = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key && /(penny|budget)/i.test(key)) keys.push(key)
  }
  keys.forEach((key) => storage.removeItem(key))
}

async function clearPennyCaches() {
  if (!('caches' in window)) return
  const cacheNames = await caches.keys()
  await Promise.all(cacheNames.map(async (name) => {
    if (/(penny|budget)/i.test(name)) {
      await caches.delete(name)
      return
    }
    const cache = await caches.open(name)
    const requests = await cache.keys()
    await Promise.all(
      requests
        .filter((request) => request.url.includes('/penny-budget/'))
        .map((request) => cache.delete(request))
    )
  }))
}

async function clearPennyDatabases() {
  if (!globalThis.indexedDB?.databases) return
  const databases = await indexedDB.databases()
  await Promise.all(
    databases
      .filter((database) => database.name && /(penny|budget)/i.test(database.name))
      .map((database) => new Promise((resolve) => {
        const request = indexedDB.deleteDatabase(database.name)
        request.onsuccess = resolve
        request.onerror = resolve
        request.onblocked = resolve
      }))
  )
}

async function unregisterPennyWorkers() {
  if (!navigator.serviceWorker?.getRegistrations) return
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(
    registrations
      .filter((registration) => registration.scope.includes('/penny-budget/'))
      .map((registration) => registration.unregister())
  )
}

function clearPennyCookies() {
  document.cookie.split(';').forEach((cookie) => {
    const name = cookie.split('=')[0].trim()
    if (!name || !/(penny|budget)/i.test(name)) return
    document.cookie = `${name}=; Max-Age=0; path=/penny-budget/`
    document.cookie = `${name}=; Max-Age=0; path=/`
  })
}

async function factoryResetEveryMonth() {
  try {
    if (localStorage.getItem('penny_data_reset_version') === DATA_RESET_VERSION) return

    removeMatchingStorage(localStorage)
    removeMatchingStorage(sessionStorage)
    clearPennyCookies()

    await Promise.all([
      clearPennyCaches(),
      clearPennyDatabases(),
      unregisterPennyWorkers(),
    ])

    localStorage.setItem('penny_state', JSON.stringify(BLANK_STATE))
    localStorage.setItem('penny_data_reset_version', DATA_RESET_VERSION)
  } catch {
    try {
      localStorage.setItem('penny_state', JSON.stringify(BLANK_STATE))
      localStorage.setItem('penny_data_reset_version', DATA_RESET_VERSION)
    } catch {
      // The in-memory app still starts blank if browser storage is unavailable.
    }
  }
}

function resetHorizontalPosition() {
  const top = window.scrollY || document.documentElement.scrollTop || 0
  document.documentElement.scrollLeft = 0
  document.body.scrollLeft = 0
  window.scrollTo(0, top)
}

function installHorizontalPositionGuard() {
  resetHorizontalPosition()
  requestAnimationFrame(() => {
    resetHorizontalPosition()
    requestAnimationFrame(resetHorizontalPosition)
  })

  const guard = () => {
    if (window.scrollX !== 0 || document.documentElement.scrollLeft !== 0 || document.body.scrollLeft !== 0) {
      resetHorizontalPosition()
    }
  }

  window.addEventListener('pageshow', guard)
  window.addEventListener('resize', guard)
  window.addEventListener('orientationchange', guard)
  window.addEventListener('scroll', guard, { passive: true })
  window.visualViewport?.addEventListener('resize', guard)
}

function renderApp() {
  installHorizontalPositionGuard()
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

factoryResetEveryMonth().finally(renderApp)
