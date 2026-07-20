import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './mobile-navigation.css';
import './overview-cleanup.css';

function resetHorizontalPosition() {
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
}

async function ensureCurrentRelease() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!response.ok) return true;

    const release = await response.json();
    const version = typeof release.version === 'string' ? release.version : '';
    if (!version) return true;

    const currentUrl = new URL(globalThis.location.href);
    if (currentUrl.searchParams.get('v') === version) return true;

    currentUrl.searchParams.set('v', version);
    globalThis.location.replace(currentUrl.toString());
    return false;
  } catch {
    return true;
  }
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
}

ensureCurrentRelease().then((ready) => {
  if (ready) renderApp();
});
