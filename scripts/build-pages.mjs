import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

function repositoryName() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY.split('/')[1]
  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return remote.match(/github\.com[:/][^/]+\/([^/]+?)(?:\.git)?$/)?.[1] || 'UniLU_MD'
  } catch {
    return 'UniLU_MD'
  }
}

const repo = repositoryName()
const base = process.env.PAGES_BASE || `/${repo}/`
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const buildCommand =
  process.platform === 'win32'
    ? {
        file: process.env.ComSpec || 'cmd.exe',
        args: [
          '/d',
          '/s',
          '/c',
          `pnpm.cmd exec slidev build slides.md --base ${base} --out dist --without-notes`,
        ],
      }
    : {
        file: pnpm,
        args: [
          'exec',
          'slidev',
          'build',
          'slides.md',
          '--base',
          base,
          '--out',
          'dist',
          '--without-notes',
        ],
      }
const result = spawnSync(buildCommand.file, buildCommand.args, { stdio: 'inherit', shell: false })
if (result.status !== 0) process.exit(result.status || 1)

const marker = 'PRIVATE-NOTES-MUST-NOT-SHIP'
for (const file of walk(path.resolve('dist'))) {
  if (!/\.(?:html|js|json|txt|map)$/.test(file)) continue
  if (fs.readFileSync(file, 'utf8').includes(marker)) {
    console.error(`Speaker-note marker leaked into public output: ${file}`)
    process.exit(1)
  }
}
console.log(`Public build ready in dist with base ${base}; speaker notes excluded.`)

function* walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) yield* walk(file)
    else yield file
  }
}
