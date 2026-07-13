import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parse } from '@slidev/parser'
import pixelmatch from 'pixelmatch'
import { chromium } from 'playwright-chromium'
import { PNG } from 'pngjs'

const port = Number(process.env.SLIDEV_QA_PORT || 4174)
const host = 'localhost'
const baseUrl = `http://${host}:${port}`
const artifactDir = path.resolve('.artifacts/visual')
const baselineDir = path.resolve('tests/visual/baseline')
const source = await fs.readFile('slides.md', 'utf8')
const slideCount = (await parse(source, path.resolve('slides.md'))).slides.length
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
await fs.mkdir(artifactDir, { recursive: true })
for (const entry of await fs.readdir(artifactDir, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.png'))
    await fs.unlink(path.join(artifactDir, entry.name))
}

const serverCommand =
  process.platform === 'win32'
    ? {
        file: process.env.ComSpec || 'cmd.exe',
        args: ['/d', '/s', '/c', `pnpm.cmd exec slidev slides.md --port ${port}`],
      }
    : { file: pnpm, args: ['exec', 'slidev', 'slides.md', '--port', String(port)] }
const server = spawn(serverCommand.file, serverCommand.args, {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: false,
  detached: process.platform !== 'win32',
})
let serverLog = ''
server.stdout.on('data', (chunk) => (serverLog += chunk.toString()))
server.stderr.on('data', (chunk) => (serverLog += chunk.toString()))

let browser
const findings = []
try {
  await waitForServer(baseUrl, 45_000)
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
  })
  page.on('console', (message) => {
    if (
      message.type() === 'error' ||
      (message.type() === 'warning' &&
        /Failed to resolve (?:component|directive)/i.test(message.text()))
    )
      findings.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => {
    if (!/Wake Lock permission request denied/i.test(error.message))
      findings.push(`page: ${error.message}`)
  })

  for (let index = 1; index <= slideCount; index += 1) {
    await page.goto(`${baseUrl}/${index}`, { waitUntil: 'networkidle' })
    const slide = page.locator(`.slidev-page-${index} > .slidev-layout`).first()
    await slide.waitFor({ state: 'visible' })
    await page.evaluate(() => document.fonts.ready)
    const filename = `slide-${String(index).padStart(3, '0')}.png`
    await inspectAndCapture(slide, `slide ${index}`, filename, true)

    let hiddenTargets = await slide.locator('.slidev-vclick-target.slidev-vclick-hidden').count()
    let clickState = 0
    while (hiddenTargets > 0 && clickState < 20) {
      const routeBefore = new URL(page.url()).pathname
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(350)
      const routeAfter = new URL(page.url()).pathname
      if (routeAfter !== routeBefore) {
        findings.push(`slide ${index} advanced before all click targets became visible`)
        break
      }

      const remainingTargets = await slide
        .locator('.slidev-vclick-target.slidev-vclick-hidden')
        .count()
      clickState += 1
      const clickFilename = `slide-${String(index).padStart(3, '0')}-click-${String(clickState).padStart(2, '0')}.png`
      await inspectAndCapture(slide, `slide ${index} click ${clickState}`, clickFilename, false)
      if (remainingTargets >= hiddenTargets) {
        findings.push(`slide ${index} click ${clickState} did not reveal a hidden target`)
        break
      }
      hiddenTargets = remainingTargets
    }
    if (hiddenTargets > 0 && clickState >= 20)
      findings.push(`slide ${index} exceeds the 20-state animation QA limit`)
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${baseUrl}/1`, { waitUntil: 'networkidle' })
  const mobileFrame = page.locator('.slidev-slide-content').first()
  await mobileFrame.waitFor({ state: 'visible' })
  const mobileBox = await mobileFrame.boundingBox()
  if (
    !mobileBox ||
    mobileBox.x < -1 ||
    mobileBox.y < -1 ||
    mobileBox.x + mobileBox.width > 391 ||
    mobileBox.y + mobileBox.height > 845
  ) {
    findings.push(`mobile viewport framing is outside 390x844: ${JSON.stringify(mobileBox)}`)
  }
  const mobilePath = path.join(artifactDir, 'mobile-cover.png')
  await page.screenshot({ path: mobilePath })
  const mobileImage = PNG.sync.read(await fs.readFile(mobilePath))
  if (nonBlankRatio(mobileImage) < 0.01) findings.push('mobile cover appears blank')
} catch (error) {
  findings.push(`qa harness: ${error instanceof Error ? error.message : String(error)}`)
} finally {
  if (browser) await browser.close()
  stopProcessTree(server.pid)
}

if (findings.length) {
  console.error(findings.map((finding) => `error: ${finding}`).join('\n'))
  console.error(serverLog.slice(-3000))
  process.exit(1)
}
console.log(`Visual QA passed for ${slideCount} slides. Screenshots: ${artifactDir}`)

async function inspectAndCapture(slide, label, filename, compareBaseline) {
  const overflow = await slide.evaluate((root) => {
    const rootRect = root.getBoundingClientRect()
    const selectors = 'h1,h2,h3,p,li,img,.katex-display,[role="img"]'
    return [...root.querySelectorAll(selectors)]
      .filter((element) => {
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        if (
          style.visibility === 'hidden' ||
          style.display === 'none' ||
          rect.width === 0 ||
          rect.height === 0
        )
          return false
        return (
          rect.left < rootRect.left - 2 ||
          rect.right > rootRect.right + 2 ||
          rect.top < rootRect.top - 2 ||
          rect.bottom > rootRect.bottom + 2
        )
      })
      .map(
        (element) => `${element.tagName.toLowerCase()}:${element.textContent?.trim().slice(0, 55)}`,
      )
  })
  if (overflow.length) findings.push(`${label} overflow: ${overflow.join(', ')}`)

  const screenshotPath = path.join(artifactDir, filename)
  await slide.screenshot({ path: screenshotPath })
  const image = PNG.sync.read(await fs.readFile(screenshotPath))
  if (nonBlankRatio(image) < 0.01) findings.push(`${label} appears blank`)

  if (!compareBaseline) return
  const baselinePath = path.join(baselineDir, filename)
  if (!(await exists(baselinePath))) return
  const baseline = PNG.sync.read(await fs.readFile(baselinePath))
  if (baseline.width !== image.width || baseline.height !== image.height) {
    findings.push(`${label} baseline dimensions differ`)
    return
  }
  const diff = new PNG({ width: image.width, height: image.height })
  const changed = pixelmatch(baseline.data, image.data, diff.data, image.width, image.height, {
    threshold: 0.12,
  })
  const ratio = changed / (image.width * image.height)
  if (ratio > 0.012) findings.push(`${label} visual difference is ${(ratio * 100).toFixed(2)}%`)
}

async function waitForServer(url, timeoutMs) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  throw new Error(`Slidev did not start within ${timeoutMs / 1000}s.`)
}

function nonBlankRatio(image) {
  const first = image.data.slice(0, 3)
  let different = 0
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const delta =
      Math.abs(image.data[offset] - first[0]) +
      Math.abs(image.data[offset + 1] - first[1]) +
      Math.abs(image.data[offset + 2] - first[2])
    if (delta > 18) different += 1
  }
  return different / (image.width * image.height)
}

async function exists(file) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

function stopProcessTree(pid) {
  if (!pid) return
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'])
    return
  }

  try {
    process.kill(-pid, 'SIGTERM')
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error
  }
}
