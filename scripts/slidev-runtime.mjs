import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'

const require = createRequire(import.meta.url)

export function resolveSlidevBin() {
  return require.resolve('@slidev/cli/bin/slidev.mjs')
}

export function slidevChildEnvironment() {
  mkdirSync('.artifacts', { recursive: true })
  const env = { ...process.env }
  const nodeMajor = Number(process.versions.node.split('.')[0])
  if (nodeMajor >= 22) {
    const storageFile = path.join('.artifacts', 'node-localstorage.json')
    env.NODE_OPTIONS = [env.NODE_OPTIONS, `--localstorage-file=${storageFile}`]
      .filter(Boolean)
      .join(' ')
  }
  return env
}
