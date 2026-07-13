import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)
const args = process.argv.slice(2)
const mode = args.find((arg) => !arg.startsWith('-')) || 'content'
const forceFresh = args.includes('--fresh')
const includeVisual = args.includes('--visual') || mode === 'visual'
const validModes = new Set(['content', 'visual', 'build', 'full', 'report'])
const ignoredBuildDirectories = new Set(['node_modules', 'dist', '.artifacts', '.git'])

if (!validModes.has(mode)) {
  console.error('Usage: node scripts/workflow.mjs <content|visual|build|full|report> [--fresh]')
  process.exit(2)
}

if (mode === 'report') {
  await reportTimings()
  process.exit(0)
}

const run = {
  schemaVersion: 1,
  runId: randomUUID(),
  mode,
  startedAt: new Date(performance.timeOrigin).toISOString(),
  measurementScope: 'Node process excluding timing-record persistence',
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  status: 'running',
  exitCode: 0,
  steps: [],
}
const workflowStarted = 0

try {
  if (mode === 'content' || mode === 'visual') await runContentWorkflow()
  else if (mode === 'build') await runBuildWorkflow(false)
  else await runFullWorkflow()
  run.status = 'passed'
} catch (error) {
  run.status = 'failed'
  run.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1
  run.error = error instanceof Error ? error.message : String(error)
  process.exitCode = run.exitCode
} finally {
  run.finishedAt = new Date().toISOString()
  run.totalMs = roundMs(performance.now() - workflowStarted)
  await writeTiming(run)
  printSummary(run)
}

async function runContentWorkflow() {
  await ensureDependencies(false)
  await timedStep('format-content', () =>
    runNode(resolvePrettier(), ['--write', '--ignore-unknown', 'slides.md', 'content']),
  )
  await timedStep('deck-rules', () => checkDeck('slides.md'))
  if (includeVisual) {
    await timedStep('visual-qa', () => runNode('scripts/visual-qa.mjs'))
  }
}

async function runBuildWorkflow(fullGate) {
  await ensureDependencies(fullGate)
  await runParallelSteps([
    () =>
      timedStep('format-check', () =>
        runNode(resolvePrettier(), ['--check', '--ignore-unknown', 'slides.md', 'content']),
      ),
    () => timedStep('deck-rules', () => checkDeck('slides.md')),
  ])
  await buildProduction(fullGate)
}

async function runFullWorkflow() {
  await ensureDependencies(true)
  await runParallelSteps([
    () => timedStep('format-check', () => runNode(resolvePrettier(), ['--check', '.'])),
    () => timedStep('markdown-lint', () => runNode(require.resolve('markdownlint-cli2'))),
    () => timedStep('deck-rules', () => checkDeck('slides.md')),
    () => timedStep('unit-tests', () => runNode(resolveVitest(), ['run'])),
  ])
  await buildProduction(true)
  await timedStep('visual-qa-built', () => runNode('scripts/visual-qa.mjs', ['--dist']))
}

async function ensureDependencies(fullGate) {
  const fingerprint = await hashFiles([
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    '.npmrc',
  ])
  const statePath = path.join('.artifacts', 'install-state.json')
  const state = await readJson(statePath)
  const modulesReady = await exists(path.join('node_modules', '.modules.yaml'))
  const cacheHit = !forceFresh && modulesReady && state?.fingerprint === fingerprint

  if (cacheHit) {
    recordCachedStep('dependencies', 'package and lock fingerprints match')
    return
  }

  await timedStep('dependencies', () =>
    runPnpm(['install', '--frozen-lockfile', '--prefer-offline']),
  )
  await writeJson(statePath, {
    schemaVersion: 1,
    fingerprint,
    verifiedAt: new Date().toISOString(),
    fullGate,
  })
}

async function buildProduction(fullGate) {
  const fingerprint = await buildFingerprint()
  const statePath = path.join('.artifacts', 'build-state.json')
  const state = await readJson(statePath)
  const outputReady = await exists(path.join('dist', 'index.html'))
  const cacheHit = !fullGate && !forceFresh && outputReady && state?.fingerprint === fingerprint

  if (cacheHit) {
    recordCachedStep('production-build', 'source fingerprint matches dist')
    return
  }

  await timedStep('production-build', () =>
    runNode('scripts/run-slidev.mjs', ['build', 'slides.md']),
  )
  await writeJson(statePath, {
    schemaVersion: 1,
    fingerprint,
    builtAt: new Date().toISOString(),
    node: process.version,
  })
}

async function buildFingerprint() {
  const roots = [
    'slides.md',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    '.npmrc',
    'tsconfig.json',
    'unilu-md.yaml',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.ts',
    'uno.config.js',
    'uno.config.mjs',
    'uno.config.ts',
    'style.css',
    'global-top.vue',
    'global-bottom.vue',
    'components',
    'layouts',
    'styles',
    'snippets',
    'pages',
    'data',
    '.slidev',
    'setup',
    'public',
    '.theme',
    'theme',
    'scripts/run-slidev.mjs',
    'scripts/slidev-runtime.mjs',
  ]
  const files = []
  for (const entry of roots) files.push(...(await collectFiles(entry)))
  return hashFiles(files, `node=${process.version}`)
}

async function collectFiles(entry) {
  if (!(await exists(entry))) return []
  const stat = await fs.stat(entry)
  if (stat.isFile()) return [entry]
  const files = []
  for (const child of await fs.readdir(entry, { withFileTypes: true })) {
    const candidate = path.join(entry, child.name)
    if (child.isDirectory() && !ignoredBuildDirectories.has(child.name)) {
      files.push(...(await collectFiles(candidate)))
    } else if (child.isFile()) files.push(candidate)
  }
  return files.sort()
}

async function hashFiles(files, prefix = '') {
  const hash = createHash('sha256')
  hash.update(prefix)
  for (const file of [...files].sort()) {
    hash.update(file.replaceAll('\\', '/'))
    if (await exists(file)) hash.update(await fs.readFile(file))
    else hash.update('<missing>')
  }
  return hash.digest('hex')
}

async function timedStep(name, action) {
  const startedAt = new Date().toISOString()
  const started = performance.now()
  console.log(`[timer] ${name} START`)
  try {
    await action()
    const durationMs = roundMs(performance.now() - started)
    run.steps.push({ name, status: 'passed', startedAt, durationMs })
    console.log(`[timer] ${name} PASS ${seconds(durationMs)}`)
  } catch (error) {
    const durationMs = roundMs(performance.now() - started)
    run.steps.push({ name, status: 'failed', startedAt, durationMs })
    console.error(`[timer] ${name} FAIL ${seconds(durationMs)}`)
    throw error
  }
}

async function runParallelSteps(actions) {
  const results = await Promise.allSettled(actions.map((action) => action()))
  const failed = results.find((result) => result.status === 'rejected')
  if (failed) throw failed.reason
}

async function checkDeck(file) {
  const source = await fs.readFile(file, 'utf8')
  const { analyzeDeck } = await import('./deck-rules.mjs')
  const result = await analyzeDeck(source, path.resolve(file))
  for (const warning of result.warnings) console.warn(`warning: ${warning}`)
  for (const error of result.errors) console.error(`error: ${error}`)
  console.log(
    `Deck check: ${result.slideCount} slides, ${result.errors.length} errors, ${result.warnings.length} warnings.`,
  )
  if (result.errors.length) {
    const error = new Error(`Deck rules found ${result.errors.length} error(s).`)
    error.exitCode = 1
    throw error
  }
}

function recordCachedStep(name, reason) {
  run.steps.push({ name, status: 'cached', durationMs: 0, reason })
  console.log(`[timer] ${name} CACHED (${reason})`)
}

function runNode(script, scriptArgs = []) {
  const resolved = path.isAbsolute(script) ? script : path.resolve(root, script)
  return runCommand(process.execPath, [resolved, ...scriptArgs])
}

function runPnpm(pnpmArgs) {
  const npmExecPath = process.env.npm_execpath
  if (npmExecPath && path.extname(npmExecPath).toLowerCase() !== '.cmd') {
    return runCommand(process.execPath, [npmExecPath, ...pnpmArgs])
  }
  if (process.platform === 'win32') {
    return runCommand(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'pnpm', ...pnpmArgs])
  }
  return runCommand('pnpm', pnpmArgs)
}

function runCommand(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: root,
      stdio: 'inherit',
      shell: false,
      env: process.env,
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else {
        const error = new Error(
          `${path.basename(command)} exited with ${code ?? `signal ${signal || 'unknown'}`}`,
        )
        error.exitCode = code ?? 1
        reject(error)
      }
    })
  })
}

function resolvePrettier() {
  return require.resolve('prettier/bin/prettier.cjs')
}

function resolveVitest() {
  const packagePath = require.resolve('vitest/package.json')
  return path.join(path.dirname(packagePath), 'vitest.mjs')
}

async function writeTiming(record) {
  const directory = path.join('.artifacts', 'timings')
  await fs.mkdir(directory, { recursive: true })
  const stamp = record.startedAt.replaceAll(':', '').replaceAll('.', '-')
  await writeJson(path.join(directory, `${stamp}-${record.mode}.json`), record)
  await writeJson(path.join(directory, `latest-${record.mode}.json`), record)
}

async function reportTimings() {
  const directory = path.join('.artifacts', 'timings')
  if (!(await exists(directory))) {
    console.log('No timing records found.')
    return
  }
  const records = []
  for (const file of await fs.readdir(directory)) {
    if (!/^\d{4}.*\.json$/.test(file)) continue
    const record = normalizeTimingRecord(await readJson(path.join(directory, file)))
    if (record) records.push(record)
  }
  records.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
  console.table(
    records.slice(0, 12).map((record) => ({
      started: record.startedAt,
      mode: record.mode,
      status: record.status,
      seconds: Number((record.totalMs / 1000).toFixed(3)),
    })),
  )
  if (records.length) {
    const latestByMode = new Map()
    for (const record of records) {
      if (!latestByMode.has(record.mode)) latestByMode.set(record.mode, record)
    }
    console.log('Latest steps by mode')
    console.table(
      [...latestByMode.values()].flatMap((record) =>
        record.steps.map((step) => ({
          mode: record.mode,
          step: step.name,
          status: step.status,
          seconds: Number((step.durationMs / 1000).toFixed(3)),
        })),
      ),
    )
  }
}

function printSummary(record) {
  console.log('')
  console.log(`Timing summary: ${record.mode} ${record.status} in ${seconds(record.totalMs)}`)
  console.table(
    record.steps.map((step) => ({
      step: step.name,
      status: step.status,
      seconds: Number((step.durationMs / 1000).toFixed(3)),
    })),
  )
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return null
  }
}

function normalizeTimingRecord(record) {
  if (!record) return null
  const totalMs = Number(record.totalMs ?? record.total_ms)
  if (!Number.isFinite(totalMs)) return null
  return {
    ...record,
    mode: record.mode || record.workflow || 'unknown',
    startedAt: record.startedAt || record.started_at || '',
    totalMs,
    steps: Array.isArray(record.steps)
      ? record.steps.map((step) => ({
          ...step,
          startedAt: step.startedAt || step.started_at,
          durationMs: Number(step.durationMs ?? step.duration_ms ?? 0),
        }))
      : [],
  }
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function exists(file) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

function roundMs(value) {
  return Math.round(value * 1000) / 1000
}

function seconds(milliseconds) {
  return `${(milliseconds / 1000).toFixed(3)}s`
}
