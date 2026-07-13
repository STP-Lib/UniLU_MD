// Adaptive Slidev launcher for local preview and phone control.

import { execFileSync, spawn } from 'node:child_process'
import net from 'node:net'
import os from 'node:os'
import process from 'node:process'
import { resolveSlidevBin, slidevChildEnvironment } from './slidev-runtime.mjs'

const args = process.argv.slice(2)
const isWin = process.platform === 'win32'

function flagValue(flag, fallback) {
  const index = args.indexOf(flag)
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback
}

const port = Number(flagValue('--port', process.env.PORT || '3030'))
const freeOnly = args.includes('--free-only')
const noOpen = args.includes('--no-open')
const remote = args.includes('--remote')
const tunnel = args.includes('--tunnel')
const remotePass = flagValue('--remote-pass', process.env.SLIDEV_REMOTE_PASS || '')

const log = (message) => console.log(`[dev] ${message}`)

function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((iface) => iface && iface.family === 'IPv4' && !iface.internal)
    .map((iface) => iface.address)
}

function printPhoneUrls() {
  const codespaceName = process.env.CODESPACE_NAME
  const codespaceDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
  const addresses = lanAddresses()
  if (process.env.CODESPACES === 'true' && codespaceName && codespaceDomain) {
    const baseUrl = `https://${codespaceName}-${port}.${codespaceDomain}`
    log('Codespaces remote control: open these links while signed in to GitHub:')
    log(`  laptop audience: ${baseUrl}/`)
    log(`  phone control  : ${baseUrl}/entry/`)
    log(`  phone presenter: ${baseUrl}/presenter/1`)
    log('Port 3030 remains private; the phone needs access to this repository.')
    if (remotePass) log('Enter the remote password when Slidev prompts for it.')
    return
  }

  log('Phone control (same Wi-Fi): keep the laptop on the audience view and')
  log('open the presenter view on your phone. The presenter controls the laptop view.')
  if (addresses.length === 0) {
    log('No LAN address detected; check that Wi-Fi is connected.')
    return
  }
  for (const address of addresses) {
    log(`  laptop audience: http://${address}:${port}/`)
    log(`  phone control  : http://${address}:${port}/entry/`)
    log(`  phone presenter: http://${address}:${port}/presenter/1`)
  }
  if (remotePass) log('Enter the remote password when Slidev prompts for it.')
  if (tunnel) log('Slidev will print a temporary public tunnel URL after startup.')
}

// Match only Slidev CLI Node processes so unrelated local servers are untouched.
function findOtherSlidevPids() {
  try {
    if (isWin) {
      const command =
        'Get-CimInstance Win32_Process -Filter "Name=\'node.exe\'" | ' +
        "Where-Object { $_.CommandLine -like '*@slidev*' } | " +
        'Select-Object -ExpandProperty ProcessId'
      return parsePids(
        execFileSync('powershell.exe', ['-NoProfile', '-Command', command], {
          encoding: 'utf8',
        }),
      )
    }
    return parsePids(execFileSync('pgrep', ['-f', '@slidev'], { encoding: 'utf8' }))
  } catch {
    return []
  }
}

function parsePids(text) {
  return text
    .split(/\s+/)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0 && value !== process.pid)
}

function killPid(pid) {
  try {
    if (isWin) execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
    else process.kill(pid, 'SIGTERM')
    return true
  } catch {
    return false
  }
}

function portIsFree(candidate) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(candidate, '127.0.0.1')
  })
}

async function waitForFreePort(candidate, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await portIsFree(candidate)) return true
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  return false
}

async function main() {
  if (tunnel && !remote) {
    log('--tunnel requires --remote. Use: pnpm dev -- --remote --tunnel')
    process.exit(1)
  }

  const pids = findOtherSlidevPids()
  if (pids.length > 0) {
    log(`Closing ${pids.length} other Slidev server(s): ${pids.join(', ')}`)
    pids.forEach(killPid)
  } else {
    log('No other Slidev servers are running.')
  }

  const free = await waitForFreePort(port)
  if (!free) {
    log(`Port ${port} is still busy and is not held by a Slidev server.`)
    log(`Pick another port: pnpm dev -- --port ${port + 1}`)
    process.exit(1)
  }
  log(`Port ${port} is free.`)

  if (freeOnly) return

  const slidevArgs = [resolveSlidevBin(), 'slides.md', '--port', String(port)]
  if (remote) slidevArgs.push(remotePass ? `--remote=${remotePass}` : '--remote')
  if (tunnel) slidevArgs.push('--tunnel')
  if (!noOpen) slidevArgs.push('--open')
  if (remote) printPhoneUrls()
  log(`Starting Slidev on http://localhost:${port} ...`)

  const child = spawn(process.execPath, slidevArgs, {
    stdio: 'inherit',
    shell: false,
    env: slidevChildEnvironment(),
  })
  const forward = (signal) => () => child.kill(signal)
  process.on('SIGINT', forward('SIGINT'))
  process.on('SIGTERM', forward('SIGTERM'))
  child.on('exit', (code) => process.exit(code ?? 0))
}

main()
