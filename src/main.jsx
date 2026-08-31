import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { installMonthClearControl } from './month-clear.js';
import { installMonthPickerActivation } from './month-picker-activation.js';
import { installCategorySettingsCleanup } from './category-settings-cleanup.js';
import { installUniformEmptyStates } from './empty-state-uniform.js';
import { installOverviewFourCardFlow } from './overview-four-card-flow.js';
import './mobile-navigation.css';
import './settings-fix.css';
import './record-editor-v62.css';
import './income-compact.css';
import './overview-compact-v12.css';
import './transfer-plan-compact.css';
import './backup-actions-uniform.css';
import './category-settings-cleanup.css';
import './transaction-uniform.css';
import './expense-income-parity.css';
import './savings-detail-parity.css';
import './savings-account-master.css';
import './overview-four-card-flow.css';
import './transfer-plan-tab.css';
import './mobile-nav-compact-v65.css';
import './mobile-nav-lower-v66.css';
import './mobile-nav-content-v67.css';
import './mobile-nav-native-v68.css';
import './mobile-nav-pixel-v69.css';
import './mobile-nav-content-v70.css';
import './mobile-header-compact-v72.css';
import './mobile-month-selector-v73.css';
import './mobile-month-label-v74.css';
import './desktop-month-picker-v75.css';
import './assignment-row-compact-v89.css';

let releaseCheckPromise = null;
let lastReleaseCheckAt = 0;
const RELEASE_CHECK_THROTTLE_MS = 5000;

function resetHorizontalPosition() {
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
}

async function ensureCurrentRelease({ force = false } = {}) {
  const now = Date.now();
  if (!force && now - lastReleaseCheckAt < RELEASE_CHECK_THROTTLE_MS) return true;
  if (releaseCheckPromise) return releaseCheckPromise;
  lastReleaseCheckAt = now;

  releaseCheckPromise = (async () => {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return true;
      const release = await response.json();
      const version = typeof release.version === 'string' ? release.version : '';
      if (!version) return true;
      globalThis.__PENNY_RELEASE__ = version;
      const currentUrl = new URL(globalThis.location.href);
      if (currentUrl.searchParams.get('v') === version) return true;
      currentUrl.searchParams.set('v', version);
      globalThis.location.replace(currentUrl.toString());
      return false;
    } catch {
      const currentUrl = new URL(globalThis.location.href);
      globalThis.__PENNY_RELEASE__ ||= currentUrl.searchParams.get('v') || '';
      return true;
    }
  })();

  try {
    return await releaseCheckPromise;
  } finally {
    releaseCheckPromise = null;
  }
}

function installReleaseChecks() {
  const check = () => { void ensureCurrentRelease({ force: true }); };
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') check();
  };
  document.addEventListener('visibilitychange', handleVisibility);
  globalThis.addEventListener('pageshow', check);
  globalThis.addEventListener('focus', check);
}

function renderApp() {
  resetHorizontalPosition();
  globalThis.addEventListener('pageshow', resetHorizontalPosition);
  globalThis.addEventListener('orientationchange', resetHorizontalPosition);
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  installMonthClearControl();
  installMonthPickerActivation();
  installCategorySettingsCleanup();
  installUniformEmptyStates();
  installOverviewFourCardFlow();
}

renderApp();
installReleaseChecks();
void ensureCurrentRelease({ force: true });
