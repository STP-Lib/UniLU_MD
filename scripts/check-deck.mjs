import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { analyzeDeck } from './deck-rules.mjs'

const file = path.resolve(process.argv[2] || 'slides.md')
const source = await fs.readFile(file, 'utf8')
const result = await analyzeDeck(source, file)

for (const warning of result.warnings) console.warn(`warning: ${warning}`)
for (const error of result.errors) console.error(`error: ${error}`)

console.log(
  `Deck check: ${result.slideCount} slides, ${result.errors.length} errors, ${result.warnings.length} warnings.`,
)
if (result.errors.length) process.exit(1)
