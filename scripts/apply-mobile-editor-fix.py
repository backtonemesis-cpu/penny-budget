from pathlib import Path

css_path = Path('src/styles.css')
css = css_path.read_text()
old = ".modal { position: fixed; z-index: 100; inset: 0; display: grid; place-items: end center; overflow-y: auto; padding: max(14px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(14px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left)); background: rgba(3, 6, 12, 0.78); }\n.modal-inner { width: min(100%, 620px); max-height: calc(100dvh - 28px); overflow-y: auto; border: 1px solid var(--border); border-radius: 19px; padding: 16px; background: var(--surface); box-shadow: var(--shadow); }"
new = ".modal { position: fixed; z-index: 100; inset: 0; display: grid; place-items: end center; overflow: hidden; overscroll-behavior: contain; padding: max(14px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(14px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left)); background: rgba(3, 6, 12, 0.78); }\n.modal-inner { width: min(100%, 620px); min-height: 0; max-height: calc(100vh - 28px); max-height: calc(100dvh - max(14px, env(safe-area-inset-top)) - max(14px, env(safe-area-inset-bottom))); overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; border: 1px solid var(--border); border-radius: 19px; padding: 16px; background: var(--surface); box-shadow: var(--shadow); }"
if old not in css:
    raise SystemExit('Expected modal shell CSS was not found')
css = css.replace(old, new, 1)
mobile_anchor = "@media (max-width: 640px) {\n"
mobile_rules = "@media (max-width: 760px) {\n  .modal-inner > .actions { position: sticky; z-index: 3; bottom: -16px; margin: 16px -16px -16px; border-top: 1px solid var(--border); padding: 12px 16px 16px; background: rgba(22, 27, 39, 0.98); backdrop-filter: blur(18px); }\n  .modal-inner > .actions > button { flex: 1 1 0; }\n  .modal-inner input, .modal-inner select { min-width: 0; max-width: 100%; }\n}\n\n"
if mobile_rules not in css:
    if mobile_anchor not in css:
        raise SystemExit('Expected mobile CSS anchor was not found')
    css = css.replace(mobile_anchor, mobile_rules + mobile_anchor, 1)
css_path.write_text(css)

package_path = Path('package.json')
package = package_path.read_text()
old_test = 'node scripts/owner-income-v10-test.mjs && node scripts/source-audit.mjs'
new_test = 'node scripts/owner-income-v10-test.mjs && node scripts/modal-layout-test.mjs && node scripts/source-audit.mjs'
if old_test not in package:
    raise SystemExit('Expected test command was not found')
package_path.write_text(package.replace(old_test, new_test, 1))

modal_test = """import assert from 'node:assert/strict';\nimport { readFile } from 'node:fs/promises';\n\nconst css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');\n\nassert.match(css, /\\.modal \\{[^}]*overflow: hidden;[^}]*overscroll-behavior: contain;/s, 'Modal backdrop must not become a second scroll container.');\nassert.match(css, /\\.modal-inner \\{[^}]*max-height: calc\\(100dvh - max\\(14px, env\\(safe-area-inset-top\\)\\) - max\\(14px, env\\(safe-area-inset-bottom\\)\\)\\);[^}]*overflow-y: auto;[^}]*-webkit-overflow-scrolling: touch;/s, 'Modal content must use one safe-area-aware iOS scroll container.');\nassert.match(css, /@media \\(max-width: 760px\\)[\\s\\S]*?\\.modal-inner > \\.actions \\{[^}]*position: sticky;[^}]*bottom: -16px;/, 'Mobile editor actions must remain reachable while the form scrolls.');\nassert.doesNotMatch(css, /\\.modal \\{[^}]*overflow-y: auto;/s, 'Modal backdrop must never regain independent vertical scrolling.');\n\nconsole.log('Penny mobile modal layout regression tests passed');\n"""
Path('scripts/modal-layout-test.mjs').write_text(modal_test)

version = '2026-08-30-mobile-editor-v1'
Path('public/version.json').write_text('{\n  "version": "' + version + '"\n}\n')
manifest_path = Path('public/manifest.webmanifest')
manifest = manifest_path.read_text()
marker = '"start_url": "/penny-budget/?v='
if marker not in manifest:
    raise SystemExit('Manifest versioned start_url was not found')
prefix, rest = manifest.split(marker, 1)
_, suffix = rest.split('"', 1)
manifest_path.write_text(prefix + marker + version + '"' + suffix)

changelog_path = Path('CHANGELOG.md')
changelog = changelog_path.read_text()
entry = """## 2026-08-30 — Mobile transaction editor repair\n\n- Removed the nested/double-scroll modal layout that could break the transaction editor on iPhone Safari/PWA.\n- Made the editor height safe-area aware and kept the form inside one controlled touch-scroll container.\n- Kept Save/Cancel reachable with a sticky mobile action bar and constrained form controls to the sheet width.\n- No finance calculations, transaction data, categories, account rules or historical records were changed.\n\n"""
if not changelog.startswith(entry):
    changelog_path.write_text(entry + changelog)

print('Applied mobile transaction editor repair')
