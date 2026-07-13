import { spawn } from 'node:child_process'
import process from 'node:process'
import { resolveSlidevBin, slidevChildEnvironment } from './slidev-runtime.mjs'

const child = spawn(process.execPath, [resolveSlidevBin(), ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: false,
  env: slidevChildEnvironment(),
})

const forward = (signal) => () => child.kill(signal)
process.on('SIGINT', forward('SIGINT'))
process.on('SIGTERM', forward('SIGTERM'))
child.on('exit', (code) => process.exit(code ?? 0))
