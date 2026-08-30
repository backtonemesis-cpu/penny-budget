import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

const renderIndex = source.lastIndexOf('\nrenderApp();');
const releaseIndex = source.lastIndexOf('\nvoid ensureCurrentRelease({ force: true });');

if (renderIndex === -1) throw new Error('main.jsx must render the app immediately');
if (releaseIndex === -1) throw new Error('main.jsx must keep the release check active');
if (renderIndex > releaseIndex) throw new Error('release check must not run before the initial render');
if (/ensureCurrentRelease\(\{ force: true \}\\?\)\.then\(/.test(source)) {
  throw new Error('initial render must not be gated by the release check promise');
}

console.log('Initial render release-check test passed.');
