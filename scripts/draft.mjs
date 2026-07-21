// Fast authoring loop: live Slidev preview plus deterministic deck feedback.
//
// Token-efficient by design. The live server hot-reloads slides.md in the
// browser (zero tokens to see a change), and every save reruns the deterministic
// deck-rules check, printing a compact contract report instead of re-rendering
// or re-reading the deck. Prefer this loop over rebuilds while authoring.
//
// Usage:
//   node scripts/draft.mjs                 live preview + deck check on save
//   node scripts/draft.mjs --no-open       same, without opening a browser
//   node scripts/draft.mjs --no-dev        deck check on save only (no server)
//   node scripts/draft.mjs --port 3031     forward any dev.mjs flag

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)

const args = process.argv.slice(2)
const noDev = args.includes('--no-dev')
const devArgs = args.filter((arg) => arg !== '--no-dev')
const deckFile = 'slides.md'
const watchTargets = ['slides.md', 'content']

const log = (message) => console.log(`[draft] ${message}`)

// Deterministic contract report. Compact by design so an agent or human reads a
// few lines instead of the whole rendered deck.
async function reportDeck() {
  try {
    const source = await fsp.readFile(deckFile, 'utf8')
    const { analyzeDeck } = await import('./deck-rules.mjs')
    const result = await analyzeDeck(source, path.resolve(deckFile))
    for (const warning of result.warnings) console.warn(`[draft] warn: ${warning}`)
    for (const error of result.errors) console.error(`[draft] error: ${error}`)
    const status = result.errors.length ? 'FAIL' : 'OK'
    log(
      `${status} — ${result.slideCount} slides, ${result.errors.length} errors, ${result.warnings.length} warnings`,
    )
  } catch (error) {
    console.error(`[draft] deck check failed: ${error instanceof Error ? error.message : error}`)
  }
}

// Debounce so one save produces one report even if the editor writes twice.
let timer = null
function scheduleReport() {
  clearTimeout(timer)
  timer = setTimeout(reportDeck, 150)
}

function startWatch() {
  for (const target of watchTargets) {
    if (!fs.existsSync(target)) continue
    const recursive = fs.statSync(target).isDirectory()
    try {
      fs.watch(target, { recursive }, scheduleReport)
    } catch {
      // Recursive watching is unavailable on some platforms; fall back to a flat
      // watch, which still reports edits to files directly under the directory.
      fs.watch(target, scheduleReport)
    }
  }
}

let devChild = null
if (!noDev) {
  devChild = spawn(process.execPath, [path.join('scripts', 'dev.mjs'), ...devArgs], {
    stdio: 'inherit',
    shell: false,
    env: process.env,
  })
  devChild.on('exit', (code) => process.exit(code ?? 0))
}

const shutdown = (signal) => () => {
  if (devChild) devChild.kill(signal)
  process.exit(0)
}
process.on('SIGINT', shutdown('SIGINT'))
process.on('SIGTERM', shutdown('SIGTERM'))

log('Fast authoring loop. Edit slides.md; the browser hot-reloads on save.')
log('The deterministic deck check below reruns on every save (no rebuild).')
await reportDeck()
startWatch()
