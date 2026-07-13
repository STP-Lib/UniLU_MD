import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)
const args = process.argv.slice(2)
const usage =
  'Usage: node scripts/scratchpad.mjs <init|check|handoff> [--file path] [--output path] [--force]'
const command = args[0] && !args[0].startsWith('-') ? args[0] : 'check'
const sourcePath = path.resolve(option('--file', 'content/deck-scratchpad.md'))
const outputPath = path.resolve(option('--output', 'content/deck-outline.proposed.yaml'))
const force = args.includes('--force')
const validCommands = new Set(['init', 'check', 'handoff'])

if (!validCommands.has(command)) {
  console.error(usage)
  process.exit(2)
}

const run = {
  schemaVersion: 1,
  runId: randomUUID(),
  mode: `scratchpad-${command}`,
  startedAt: new Date(performance.timeOrigin).toISOString(),
  measurementScope: 'Node process excluding timing-record persistence',
  status: 'running',
  exitCode: 0,
  steps: [],
}
const workflowStarted = 0

try {
  if (command === 'init') await initializeScratchpad()
  else if (command === 'check') await checkScratchpad(false)
  else await checkScratchpad(true)
  run.status = 'passed'
} catch (error) {
  run.status = 'failed'
  run.exitCode = 1
  run.error = error instanceof Error ? error.message : String(error)
  console.error(`error: ${run.error}`)
  process.exitCode = 1
} finally {
  run.finishedAt = new Date().toISOString()
  run.totalMs = roundMs(performance.now() - workflowStarted)
  await writeTiming(run)
  printTiming(run)
}

async function initializeScratchpad() {
  if ((await exists(sourcePath)) && !force) {
    throw new Error(`${relative(sourcePath)} already exists; pass --force to replace it.`)
  }
  const title = option('--title', 'Untitled presentation')
  const audience = option('--audience', 'To be decided')
  await timedStep('write-template', async () => {
    await fs.mkdir(path.dirname(sourcePath), { recursive: true })
    await fs.writeFile(sourcePath, scratchpadTemplate(title, audience), 'utf8')
  })
  console.log(`Created ${relative(sourcePath)}`)
}

async function checkScratchpad(createHandoff) {
  let source
  await timedStep('read-scratchpad', async () => {
    source = await fs.readFile(sourcePath, 'utf8')
  })

  let parsed
  let validation
  await timedStep('validate-cards', async () => {
    parsed = parseScratchpad(source)
    validation = validateScratchpad(parsed)
    if (createHandoff) validateHandoffReady(parsed, validation)
  })

  for (const warning of validation.warnings) console.warn(`warning: ${warning}`)
  if (validation.errors.length) {
    throw new Error(validation.errors.join('\nerror: '))
  }

  console.log(
    `Scratchpad check: ${parsed.cards.length} cards, ${validation.approved.length} approved, ${validation.approvedSeconds}s approved content, ${validation.activeSeconds}s active content, ${validation.backupSeconds}s backup.`,
  )

  if (!createHandoff) return
  if ((await exists(outputPath)) && !force) {
    throw new Error(`${relative(outputPath)} already exists; pass --force to replace it.`)
  }

  await timedStep('write-handoff', async () => {
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, renderHandoff(parsed, validation.approved), 'utf8')
  })
  console.log(
    `Handoff timing: ${validation.approvedSeconds}s approved + 30s deck overhead = ${validation.approvedSeconds + 30}s planned.`,
  )
  console.log(`Wrote proposed handoff: ${relative(outputPath)}`)
}

function parseScratchpad(source) {
  const frontmatter = parseFrontmatter(source)
  const cardPattern = /^### \[([A-Z][A-Z0-9_-]*)\]\s+(.+)$/gm
  const matches = [...source.matchAll(cardPattern)]
  const cards = matches.map((match, index) => {
    const blockStart = match.index + match[0].length
    const blockEnd = matches[index + 1]?.index ?? source.length
    const block = source.slice(blockStart, blockEnd)
    const fields = {}
    for (const field of block.matchAll(
      /^- (Status|Kind|Section|Subsection|Purpose|Takeaway|Layout|Placement|Animation|Exhibit|Evidence|Time):\s*(.*)$/gim,
    )) {
      fields[field[1].toLowerCase()] = field[2].trim()
    }
    return {
      id: match[1],
      title: match[2].trim(),
      fields,
      regions: parseRegions(block),
    }
  })
  return { frontmatter, cards }
}

function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const result = {}
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([a-z_]+):\s*(.*)$/)
    if (!pair) continue
    result[pair[1]] = unquoteYaml(pair[2].trim())
  }
  return result
}

function parseRegions(block) {
  const regions = {}
  const regionPattern = /^####\s+(.+)$/gm
  const matches = [...block.matchAll(regionPattern)]
  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index + matches[index][0].length
    const end = matches[index + 1]?.index ?? block.length
    regions[normalize(matches[index][1])] = block.slice(start, end).trim()
  }
  return regions
}

function validateScratchpad(parsed) {
  const errors = []
  const warnings = []
  const seen = new Set()
  const approved = []
  let activeSeconds = 0
  let approvedSeconds = 0
  let backupSeconds = 0
  const allowed = {
    status: new Set(['raw', 'candidate', 'approved', 'parked', 'dropped']),
    kind: new Set(['content', 'backup']),
    layout: new Set(['auto', 'default', 'two-cols', 'figure', 'equation', 'blank']),
    placement: new Set(['full-width', 'left-right', 'figure', 'equation', 'overlay']),
    animation: new Set(['none', 'reveal', 'sequence', 'compare', 'accumulate', 'traverse']),
  }

  for (const card of parsed.cards) {
    if (seen.has(card.id)) errors.push(`${card.id}: duplicate card ID.`)
    seen.add(card.id)
    for (const key of Object.keys(allowed)) {
      const value = card.fields[key]?.toLowerCase()
      if (!value) errors.push(`${card.id}: missing ${key}.`)
      else if (!allowed[key].has(value)) errors.push(`${card.id}: invalid ${key} '${value}'.`)
    }

    const seconds = parseDuration(card.fields.time)
    if (seconds === null) errors.push(`${card.id}: Time must be a positive value such as 60s.`)
    else if (!['dropped', 'parked'].includes(card.fields.status?.toLowerCase())) {
      if (card.fields.kind?.toLowerCase() === 'backup') backupSeconds += seconds
      else {
        activeSeconds += seconds
        if (card.fields.status?.toLowerCase() === 'approved') approvedSeconds += seconds
      }
    }

    if (card.fields.layout?.toLowerCase() === 'two-cols') {
      if (!card.regions.left || !card.regions.right) {
        errors.push(`${card.id}: two-cols requires both '#### Left' and '#### Right'.`)
      }
      if (card.fields.placement?.toLowerCase() !== 'left-right') {
        errors.push(`${card.id}: two-cols requires Placement: left-right.`)
      }
    }
    if (card.fields.animation?.toLowerCase() !== 'none' && !card.regions.animation_beats) {
      errors.push(`${card.id}: animated cards require '#### Animation beats'.`)
    }

    if (card.fields.status?.toLowerCase() === 'approved') {
      approved.push(card)
      for (const required of [
        'section',
        'subsection',
        'purpose',
        'takeaway',
        'exhibit',
        'evidence',
      ]) {
        if (!card.fields[required]) errors.push(`${card.id}: approved card is missing ${required}.`)
      }
      const evidence = card.fields.evidence?.toLowerCase() || ''
      if (evidence !== 'none' && !/^verified:\s*\S/.test(evidence)) {
        errors.push(`${card.id}: approved evidence must be 'none' or 'verified: <source-key>'.`)
      }
    } else if (
      !['parked', 'dropped'].includes(card.fields.status?.toLowerCase()) &&
      (card.fields.evidence || '').toLowerCase().startsWith('to-check:')
    ) {
      warnings.push(`${card.id}: evidence still needs verification.`)
    }
  }

  if (!parsed.cards.length) warnings.push('No structured slide cards found.')
  return { errors, warnings, approved, activeSeconds, approvedSeconds, backupSeconds }
}

function validateHandoffReady(parsed, validation) {
  if (!validation.approved.length) {
    validation.errors.push('No approved cards are available for handoff.')
  }
  for (const field of ['title', 'audience', 'objective', 'central_claim']) {
    if (!String(parsed.frontmatter[field] || '').trim()) {
      validation.errors.push(`Handoff metadata is missing ${field}.`)
    }
  }
  const targetMinutes = Number(parsed.frontmatter.duration_minutes)
  if (!Number.isFinite(targetMinutes) || targetMinutes <= 0) {
    validation.errors.push('Handoff metadata duration_minutes must be a positive number.')
    return
  }
  const plannedSeconds = validation.approvedSeconds + 30
  const targetSeconds = targetMinutes * 60
  if (plannedSeconds > targetSeconds) {
    validation.errors.push(
      `Approved cards plus 30s deck overhead exceed the ${targetMinutes}-minute target by ${plannedSeconds - targetSeconds}s.`,
    )
  } else if (plannedSeconds < targetSeconds) {
    validation.warnings.push(
      `${targetSeconds - plannedSeconds}s remain in the ${targetMinutes}-minute target after deck overhead.`,
    )
  }
}

function renderHandoff(parsed, approvedCards) {
  const title = parsed.frontmatter.title || 'Untitled presentation'
  const audience = parsed.frontmatter.audience || 'To be decided'
  const objective = parsed.frontmatter.objective || ''
  const centralClaim = parsed.frontmatter.central_claim || ''
  const targetMinutes = Number(parsed.frontmatter.duration_minutes)
  const liveCards = approvedCards.filter((card) => card.fields.kind.toLowerCase() !== 'backup')
  const backupCards = approvedCards.filter((card) => card.fields.kind.toLowerCase() === 'backup')
  const contentSeconds = liveCards.reduce((sum, card) => sum + parseDuration(card.fields.time), 0)
  const backupSeconds = backupCards.reduce((sum, card) => sum + parseDuration(card.fields.time), 0)
  const overheadSeconds = 30
  const cardSlide = (card, number) => ({
    number,
    id: card.id,
    kind: card.fields.kind,
    action_title: card.title,
    purpose: card.fields.purpose,
    section: card.fields.section,
    subsection: card.fields.subsection,
    layout: card.fields.layout,
    placement: card.fields.placement,
    animation: card.fields.animation,
    exhibit: card.fields.exhibit,
    evidence: card.fields.evidence,
    takeaway: card.fields.takeaway,
    duration_seconds: parseDuration(card.fields.time),
    source_card: card.id,
    content: Object.fromEntries(
      Object.entries(card.regions).filter(([, value]) => String(value).trim()),
    ),
  })
  const slides = [
    {
      number: 1,
      id: 'cover',
      kind: 'cover',
      action_title: title,
      purpose: 'Establish the talk and speaker.',
      duration_seconds: 10,
    },
    {
      number: 2,
      id: 'outline',
      kind: 'outline',
      action_title: 'Outline',
      purpose: 'Provide the generated section outline.',
      duration_seconds: 10,
    },
    ...liveCards.map((card, index) => cardSlide(card, index + 3)),
    {
      number: liveCards.length + 3,
      id: 'closing',
      kind: 'closing',
      action_title: 'Closing',
      purpose: 'Close the talk and provide contact details.',
      duration_seconds: 10,
    },
    ...backupCards.map((card, index) => cardSlide(card, liveCards.length + index + 4)),
  ]

  const lines = [
    'schema_version: 1',
    `source: ${yaml(relative(sourcePath))}`,
    'status: proposed',
    'approval: pending',
    `title: ${yaml(title)}`,
    `audience: ${yaml(audience)}`,
    `objective: ${yaml(objective)}`,
    `central_claim: ${yaml(centralClaim)}`,
    `duration_minutes: ${targetMinutes}`,
    `planned_duration_seconds: ${contentSeconds + overheadSeconds}`,
    `content_duration_seconds: ${contentSeconds}`,
    `overhead_seconds: ${overheadSeconds}`,
    `backup_duration_seconds: ${backupSeconds}`,
    'slides:',
  ]
  for (const slide of slides) {
    lines.push(`  - number: ${slide.number}`)
    for (const [key, value] of Object.entries(slide)) {
      if (key === 'number' || value === undefined || value === null) continue
      if (typeof value === 'object') {
        const entries = Object.entries(value)
        if (!entries.length) continue
        lines.push(`    ${key}:`)
        for (const [nestedKey, nestedValue] of entries) {
          appendYamlBlock(lines, `      ${nestedKey}`, String(nestedValue))
        }
      } else {
        lines.push(`    ${key}: ${typeof value === 'number' ? value : yaml(String(value))}`)
      }
    }
  }
  return `${lines.join('\n')}\n`
}

function appendYamlBlock(lines, key, value) {
  const normalized = value.replaceAll('\r\n', '\n').trim()
  if (!normalized) {
    lines.push(`${key}: ''`)
    return
  }
  lines.push(`${key}: |-`)
  for (const line of normalized.split('\n')) lines.push(`        ${line}`)
}

function scratchpadTemplate(title, audience) {
  return `---
schema_version: 1
title: ${yaml(title)}
audience: ${yaml(audience)}
duration_minutes: null
objective: ''
central_claim: ''
---

# Deck scratchpad

Write freely in the inbox. Move an idea into a slide card only when it is worth shaping.

## North star

- Desired audience response:
- One-sentence argument:
- Questions the deck must answer:

## Inbox

- Add raw thoughts, fragments, references, or questions here.

## Parking lot

- Keep useful ideas here when they do not fit the current talk.

## Slide cards

### [S010] Working action title

- Status: raw
- Kind: content
- Section: Working section
- Subsection: Working subsection
- Purpose: State what this slide must accomplish
- Takeaway: State what the audience should remember
- Layout: two-cols
- Placement: left-right
- Animation: none
- Exhibit: working content
- Evidence: to-check: source-key
- Time: 60s

#### Left

Add the explanation, equation idea, or short bullets.

#### Right

Add the figure, comparison, or diagram idea.

#### Animation beats

Leave empty when Animation is none. Otherwise describe semantic reveal steps, not raw Slidev syntax.

#### Speaker notes

Add narration, caveats, open questions, or transitions.
`
}

async function timedStep(name, action) {
  const started = performance.now()
  try {
    await action()
    run.steps.push({ name, status: 'passed', durationMs: roundMs(performance.now() - started) })
  } catch (error) {
    run.steps.push({ name, status: 'failed', durationMs: roundMs(performance.now() - started) })
    throw error
  }
}

async function writeTiming(record) {
  const directory = path.resolve('.artifacts/timings')
  await fs.mkdir(directory, { recursive: true })
  const stamp = record.startedAt.replaceAll(':', '').replaceAll('.', '-')
  const json = `${JSON.stringify(record, null, 2)}\n`
  await fs.writeFile(path.join(directory, `${stamp}-${record.mode}.json`), json, 'utf8')
  await fs.writeFile(path.join(directory, `latest-${record.mode}.json`), json, 'utf8')
}

function printTiming(record) {
  console.log(`Timing: ${record.mode} ${record.status} in ${(record.totalMs / 1000).toFixed(3)}s`)
  console.table(
    record.steps.map((step) => ({
      step: step.name,
      status: step.status,
      seconds: Number((step.durationMs / 1000).toFixed(3)),
    })),
  )
}

function option(name, fallback) {
  const index = args.indexOf(name)
  if (index < 0) return fallback
  const value = args[index + 1]
  if (!value || value.startsWith('-')) {
    console.error(`error: ${name} requires a value.`)
    console.error(usage)
    process.exit(2)
  }
  return value
}

function parseDuration(value) {
  const match = String(value || '').match(/^([1-9]\d*)s$/i)
  return match ? Number(match[1]) : null
}

function yaml(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function unquoteYaml(value) {
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'")
  }
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1)
  return value
}

function normalize(value) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '_')
    .replaceAll(/^_|_$/g, '')
}

function relative(file) {
  return path.relative(process.cwd(), file).replaceAll('\\', '/')
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
