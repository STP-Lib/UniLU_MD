// Deterministic image compressor for slide assets.
//
// High fidelity, small size, zero LLM tokens. Oversized rasters are downscaled
// to a sane cap and re-encoded with libvips (sharp): near-lossless palette PNG
// for line-art and plots, mozjpeg for photographs. The same input and flags
// always produce the same bytes, and it prints one compact before/after line.
//
// Usage:
//   node scripts/compress-image.mjs <input> [--out <path>]
//        [--max-width <px>] [--max-height <px>] [--format auto|png|jpg|webp]
//        [--quality <1-100>] [--lossless] [--force]
//
// Defaults: --max-width 1600, --format auto (keep the input format). PNG uses
// near-lossless palette quantization; JPG uses mozjpeg at quality 82 with 4:4:4
// chroma so text and thin lines stay crisp. Metadata is stripped.

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import sharp from 'sharp'

const args = process.argv.slice(2)

function flag(name, fallback) {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
const has = (name) => args.includes(`--${name}`)

const input = args.find((a) => !a.startsWith('--'))
if (!input) {
  console.error(
    'Usage: node scripts/compress-image.mjs <input> [--out <path>] [--max-width N] ' +
      '[--max-height N] [--format auto|png|jpg|webp] [--quality 1-100] [--lossless] [--force]',
  )
  process.exit(2)
}

const maxWidth = Number(flag('max-width', '1600'))
const maxHeight = Number(flag('max-height', '0')) // 0 = no height cap
const requestedFormat = flag('format', 'auto')
const qualityArg = flag('quality', '')
const lossless = has('lossless')
const force = has('force')

const formatByExt = { '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webp': 'webp' }
const extByFormat = { png: '.png', jpeg: '.jpg', webp: '.webp' }

function kib(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

async function main() {
  const source = await fs.readFile(input)
  const image = sharp(source, { failOn: 'none' })
  const meta = await image.metadata()

  let targetFormat
  if (requestedFormat === 'auto') {
    targetFormat =
      meta.format === 'jpeg' || meta.format === 'jpg'
        ? 'jpeg'
        : meta.format === 'webp'
          ? 'webp'
          : 'png'
  } else {
    targetFormat = requestedFormat === 'jpg' ? 'jpeg' : requestedFormat
  }

  const out =
    flag('out', '') ||
    path.join(
      path.dirname(input),
      `${path.basename(input, path.extname(input))}-min${extByFormat[targetFormat]}`,
    )

  const willResize =
    (maxWidth > 0 && meta.width > maxWidth) || (maxHeight > 0 && meta.height > maxHeight)
  let pipeline = image
  if (willResize) {
    pipeline = pipeline.resize({
      width: maxWidth > 0 ? maxWidth : undefined,
      height: maxHeight > 0 ? maxHeight : undefined,
      fit: 'inside',
      withoutEnlargement: true,
      kernel: 'lanczos3',
    })
  }

  const quality = qualityArg ? Number(qualityArg) : null
  if (targetFormat === 'png') {
    pipeline = pipeline.png({
      compressionLevel: 9,
      effort: 10,
      palette: !lossless,
      quality: lossless ? undefined : (quality ?? 100),
    })
  } else if (targetFormat === 'jpeg') {
    pipeline = pipeline.jpeg({
      quality: quality ?? 82,
      mozjpeg: true,
      chromaSubsampling: '4:4:4',
    })
  } else {
    pipeline = pipeline.webp({ quality: quality ?? 82, effort: 6, lossless })
  }

  const encoded = await pipeline.toBuffer()
  const sameFormat = formatByExt[path.extname(input).toLowerCase()] === targetFormat
  const keepOriginal = !force && !willResize && sameFormat && encoded.length >= source.length

  await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true })
  const finalBuffer = keepOriginal ? source : encoded
  await fs.writeFile(out, finalBuffer)

  const outMeta = await sharp(finalBuffer).metadata()
  const saved = ((1 - finalBuffer.length / source.length) * 100).toFixed(1)
  console.log(
    `${path.basename(input)} ${meta.width}x${meta.height} ${kib(source.length)}  ->  ` +
      `${path.basename(out)} ${outMeta.width}x${outMeta.height} ${kib(finalBuffer.length)} ` +
      `(${saved >= 0 ? '-' : '+'}${Math.abs(saved)}%, ${targetFormat}${keepOriginal ? ', kept original' : ''})`,
  )
}

main().catch((error) => {
  console.error(`compress-image failed: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
})
