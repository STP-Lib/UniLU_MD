import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })),
  )
})

describe('scratchpad handoff', () => {
  it('preserves approved regions and accounts for deck overhead', async () => {
    const root = await createProject()
    await fs.writeFile(path.join(root, 'content', 'deck-scratchpad.md'), validScratchpad, 'utf8')

    await execFileAsync(
      process.execPath,
      [path.join(root, 'scripts', 'scratchpad.mjs'), 'handoff'],
      {
        cwd: os.tmpdir(),
      },
    )

    const handoff = await fs.readFile(
      path.join(root, 'content', 'deck-outline.proposed.yaml'),
      'utf8',
    )
    expect(handoff).toContain('planned_duration_seconds: 120')
    expect(handoff).toContain('overhead_seconds: 30')
    expect(handoff).toContain('duration_seconds: 10')
    expect(handoff).toContain('left: |-')
    expect(handoff).toContain('animation_beats: |-')
    expect(handoff).toContain('speaker_notes: |-')
  })

  it('rejects an approved card with an empty verified evidence key', async () => {
    const root = await createProject()
    await fs.writeFile(
      path.join(root, 'content', 'deck-scratchpad.md'),
      validScratchpad.replace('verified: model-note', 'verified:'),
      'utf8',
    )

    await expect(
      execFileAsync(process.execPath, [path.join(root, 'scripts', 'scratchpad.mjs'), 'handoff']),
    ).rejects.toMatchObject({ code: 1 })
  })

  it('places approved backup cards after closing without using the talk budget', async () => {
    const root = await createProject()
    await fs.writeFile(
      path.join(root, 'content', 'deck-scratchpad.md'),
      `${validScratchpad}\n${backupCard}`,
      'utf8',
    )

    await execFileAsync(process.execPath, [path.join(root, 'scripts', 'scratchpad.mjs'), 'handoff'])
    const handoff = await fs.readFile(
      path.join(root, 'content', 'deck-outline.proposed.yaml'),
      'utf8',
    )

    expect(handoff).toContain('planned_duration_seconds: 120')
    expect(handoff).toContain('backup_duration_seconds: 60')
    expect(handoff.indexOf("id: 'closing'")).toBeLessThan(handoff.indexOf("id: 'B010'"))
  })
})

async function createProject() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'unilu-scratchpad-test-'))
  temporaryRoots.push(root)
  await fs.mkdir(path.join(root, 'scripts'), { recursive: true })
  await fs.mkdir(path.join(root, 'content'), { recursive: true })
  await fs.copyFile(
    new URL('../../scripts/scratchpad.mjs', import.meta.url),
    path.join(root, 'scripts', 'scratchpad.mjs'),
  )
  return root
}

const validScratchpad = `---
schema_version: 1
title: 'QuMIMO Crosstalk Model'
audience: 'QuMIMO meeting'
duration_minutes: 2
objective: 'Agree on the model boundary'
central_claim: 'Shared coupling creates correlated channel errors'
---

# Deck scratchpad

## Slide cards

### [S010] Shared coupling correlates channel errors

- Status: approved
- Kind: content
- Section: Model
- Subsection: Crosstalk
- Purpose: Explain the coupling mechanism
- Takeaway: Receiver errors are not independent
- Layout: two-cols
- Placement: left-right
- Animation: sequence
- Exhibit: coupling-path diagram
- Evidence: verified: model-note
- Time: 90s

#### Left

Model equation.

#### Right

Coupling diagram.

#### Animation beats

1. Show independent channels.
2. Reveal shared coupling.

#### Speaker notes

State the model boundary.
`

const backupCard = `### [B010] Backup sensitivity check

- Status: approved
- Kind: backup
- Section: Backup
- Subsection: Sensitivity
- Purpose: Preserve a sensitivity result for questions
- Takeaway: The conclusion holds over the tested range
- Layout: default
- Placement: full-width
- Animation: none
- Exhibit: sensitivity table
- Evidence: verified: model-note
- Time: 60s
`
