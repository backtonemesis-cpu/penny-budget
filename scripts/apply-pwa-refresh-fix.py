from pathlib import Path

main = Path('src/main.jsx')
main.write_text("""import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './mobile-navigation.css';

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
}

ensureCurrentRelease({ force: true }).then((ready) => {
  if (ready) {
    renderApp();
    installReleaseChecks();
  }
});
""")

app = Path('src/App.jsx')
text = app.read_text()
old = "function SettingsModal({ state, allCategories, accountOwnerOptions, recoveryRequired, rollbackAvailable, mutate, fileRef, onImport, onExport, onRestorePreviousImport, onErase, onClose }) {\n  return (\n    <SimpleModal title=\"Settings\" onClose={onClose} wide>"
new = "function SettingsModal({ state, allCategories, accountOwnerOptions, recoveryRequired, rollbackAvailable, mutate, fileRef, onImport, onExport, onRestorePreviousImport, onErase, onClose }) {\n  const runningVersion = globalThis.__PENNY_RELEASE__ || new URL(globalThis.location.href).searchParams.get('v') || 'Unverified';\n  return (\n    <SimpleModal title=\"Settings\" onClose={onClose} wide>\n      <section className=\"settings-section\">\n        <h3>App Version</h3>\n        <p className=\"section-note\"><strong>{runningVersion}</strong></p>\n        <p className=\"section-note\">Penny checks for a newer release when it opens and whenever it returns to the foreground. This does not erase browser-stored finance data.</p>\n      </section>"
if old not in text:
    raise SystemExit('SettingsModal patch target not found')
app.write_text(text.replace(old, new, 1))

Path('public/version.json').write_text('{\n  "version": "2026-08-30-pwa-refresh-v1"\n}\n')
manifest = Path('public/manifest.webmanifest')
mt = manifest.read_text().replace('/penny-budget/?v=2026-08-30-owner-income-v10', '/penny-budget/?v=2026-08-30-pwa-refresh-v1')
if mt == manifest.read_text():
    raise SystemExit('Manifest version target not found')
manifest.write_text(mt)

changelog = Path('CHANGELOG.md')
ct = changelog.read_text()
entry = """## 2026-08-30 — iPhone foreground update verification\n\n- Penny now checks the live release whenever the installed app returns to the foreground, not only on initial JavaScript startup.\n- Added a visible App Version section in Settings so the running release can be verified on-device.\n- Update checks keep using no-store version requests and do not clear local finance data.\n\n"""
if not ct.startswith(entry):
    changelog.write_text(entry + ct)

Path('scripts/update-refresh-test.mjs').write_text("""import assert from 'node:assert/strict';\nimport { readFile } from 'node:fs/promises';\n\nconst main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');\nconst app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');\n\nassert.match(main, /visibilitychange/, 'Penny must recheck releases when the installed app becomes visible again.');\nassert.match(main, /pageshow/, 'Penny must recheck releases when a suspended page resumes.');\nassert.match(main, /addEventListener\\('focus'/, 'Penny must recheck releases when the app regains focus.');\nassert.match(main, /cache: 'no-store'/, 'Release checks must bypass HTTP cache.');\nassert.match(main, /__PENNY_RELEASE__/, 'The verified running release must be available to the UI.');\nassert.match(app, /App Version/, 'Settings must expose the running release to the user.');\nassert.match(app, /does not erase browser-stored finance data/, 'Settings must make the non-destructive update behavior explicit.');\nconsole.log('Penny foreground update verification tests passed');\n""")

package = Path('package.json')
pt = package.read_text()
old_test = "node scripts/owner-income-v10-test.mjs && node scripts/source-audit.mjs"
new_test = "node scripts/owner-income-v10-test.mjs && node scripts/update-refresh-test.mjs && node scripts/source-audit.mjs"
if old_test not in pt:
    raise SystemExit('package test target not found')
package.write_text(pt.replace(old_test, new_test, 1))
print('Applied iPhone/PWA foreground update verification fix')
