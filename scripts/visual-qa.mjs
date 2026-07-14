import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import process from 'node:process'
import { parse } from '@slidev/parser'
import pixelmatch from 'pixelmatch'
import { chromium } from 'playwright-chromium'
import { PNG } from 'pngjs'
import { resolveSlidevBin, slidevChildEnvironment } from './slidev-runtime.mjs'

const port = Number(process.env.SLIDEV_QA_PORT || 4174)
const host = 'localhost'
const baseUrl = `http://${host}:${port}`
const useBuiltOutput = process.argv.includes('--dist')
const artifactDir = path.resolve('.artifacts/visual')
const baselineDir = path.resolve('tests/visual/baseline')
const source = await fs.readFile('slides.md', 'utf8')
const parsedDeck = await parse(source, path.resolve('slides.md'))
const slideCount = parsedDeck.slides.length
const outlineSlideNo =
  parsedDeck.slides.findIndex((slide) => slide.frontmatter.layout === 'outline') + 1
const registeredReferences = parsedDeck.slides[0]?.frontmatter.references || []
const baselineDifferenceLimit =
  process.platform === 'linux' && process.env.CI === 'true' ? 0.013 : 0.012
await fs.mkdir(artifactDir, { recursive: true })
for (const entry of await fs.readdir(artifactDir, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.png'))
    await fs.unlink(path.join(artifactDir, entry.name))
}

let serverLog = ''
let slidevServer
let builtServer
if (useBuiltOutput) {
  builtServer = await startBuiltServer(path.resolve('dist'), port, host)
  serverLog = `Serving the existing production build from ${path.resolve('dist')}`
} else {
  slidevServer = spawn(
    process.execPath,
    [resolveSlidevBin(), 'slides.md', '--port', String(port)],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      detached: process.platform !== 'win32',
      env: slidevChildEnvironment(),
    },
  )
  slidevServer.stdout.on('data', (chunk) => (serverLog += chunk.toString()))
  slidevServer.stderr.on('data', (chunk) => (serverLog += chunk.toString()))
}

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
  page.on('requestfailed', (request) => {
    if (shouldTrackRequest(request)) {
      findings.push(
        `request failed: ${request.url()} (${request.failure()?.errorText || 'unknown'})`,
      )
    }
  })
  page.on('response', (response) => {
    const request = response.request()
    if (response.status() >= 400 && shouldTrackRequest(request)) {
      findings.push(`response ${response.status()}: ${request.url()}`)
    }
  })

  for (let index = 1; index <= slideCount; index += 1) {
    await page.goto(`${baseUrl}/${index}`, { waitUntil: 'networkidle' })
    const slide = page.locator(`.slidev-page-${index} > .slidev-layout`).first()
    await slide.waitFor({ state: 'visible' })
    await page.evaluate(() => document.fonts.ready)
    const brokenImages = await slide
      .locator('img')
      .evaluateAll((images) =>
        images
          .filter((image) => !image.complete || image.naturalWidth === 0)
          .map((image) => image.currentSrc || image.getAttribute('src') || '<missing src>'),
      )
    for (const image of brokenImages) findings.push(`slide ${index} has a broken image: ${image}`)
    const filename = `slide-${String(index).padStart(3, '0')}.png`
    await inspectAndCapture(slide, `slide ${index}`, filename, true)

    const citedKeys = [
      ...new Set(
        [...parsedDeck.slides[index - 1].content.matchAll(/\\cite\{([^{}]+)\}/g)].flatMap((match) =>
          match[1].split(',').map((key) => key.trim()),
        ),
      ),
    ].filter(Boolean)
    if (citedKeys.length) await inspectCitations(page, slide, index, citedKeys)

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

  if (outlineSlideNo > 0) await inspectOutlineInteractions(page, outlineSlideNo)

  await page.goto(`${baseUrl}/1`, { waitUntil: 'networkidle' })
  const titleZone = page.locator('.unilu-cover-title').first()
  const coverTitle = titleZone.locator('h1').first()
  await coverTitle.evaluate((element) => {
    element.textContent =
      'A Robust Browser-Native Framework for Reproducible Quantum Communication and Machine Learning Presentations'
  })
  const titleFits = await titleZone.evaluate((zone) => {
    const zoneRect = zone.getBoundingClientRect()
    const titleRect = zone.querySelector('h1')?.getBoundingClientRect()
    return Boolean(
      titleRect &&
      titleRect.left >= zoneRect.left - 1 &&
      titleRect.right <= zoneRect.right + 1 &&
      titleRect.top >= zoneRect.top - 1 &&
      titleRect.bottom <= zoneRect.bottom + 1,
    )
  })
  if (!titleFits) findings.push('long cover title does not fit within the stable title zone')

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
  if (builtServer) await closeServer(builtServer)
  else stopProcessTree(slidevServer?.pid)
}

if (findings.length) {
  console.error(findings.map((finding) => `error: ${finding}`).join('\n'))
  console.error(serverLog.slice(-3000))
  process.exit(1)
}
console.log(`Visual QA passed for ${slideCount} slides. Screenshots: ${artifactDir}`)

async function inspectCitations(page, slide, slideNo, citedKeys) {
  const markerText = (await slide.locator('.unilu-cite').allTextContents()).join(',')
  const referenceLines = slide.locator('.unilu-slide-reference')
  if ((await referenceLines.count()) !== citedKeys.length) {
    findings.push(`slide ${slideNo} citation footer count does not match cited keys`)
  }

  for (const key of citedKeys) {
    const expected = registeredReferences.findIndex((reference) => reference.key === key) + 1
    if (expected < 1 || !markerText.split(/\D+/).includes(String(expected))) {
      findings.push(`slide ${slideNo} citation '${key}' does not use stable number ${expected}`)
    }
  }

  const referencesBox = await slide.locator('.unilu-slide-references').boundingBox()
  const logoBox = await page.locator('.unilu-footer__unilu:visible').first().boundingBox()
  if (referencesBox && logoBox && referencesBox.x < logoBox.x + logoBox.width + 8) {
    findings.push(`slide ${slideNo} references do not begin to the right of the UniLU logo`)
  }

  const decoratedLinks = await slide.locator('.unilu-slide-reference a').evaluateAll(
    (links) =>
      links.filter((link) => {
        const style = getComputedStyle(link)
        return style.borderBottomStyle !== 'none' || style.textDecorationLine !== 'none'
      }).length,
  )
  if (decoratedLinks) findings.push(`slide ${slideNo} reference links show decorative lines`)
}

async function inspectOutlineInteractions(page, slideNo) {
  await page.goto(`${baseUrl}/${slideNo}`, { waitUntil: 'networkidle' })
  const outline = page.locator('.unilu-outline').first()
  const sections = outline.locator('.unilu-outline-section')
  const sectionCount = await sections.count()
  if (sectionCount < 1) {
    findings.push('outline has no automatically generated sections for interaction QA')
    return
  }

  const initiallyVisible = await outline.locator('.unilu-outline-subsection:visible').count()
  if (initiallyVisible !== 0) findings.push('outline subsections should begin collapsed')

  const first = sections.nth(0)
  const chevron = first.locator('.unilu-outline-chevron')
  const chevronBox = await chevron.boundingBox()
  if (!chevronBox || (await chevron.locator('path,polyline,line').count()) < 1) {
    findings.push('outline disclosure icon is not rendered')
  }
  await first.locator('.unilu-outline-trigger').click()
  await page.waitForTimeout(220)
  if ((await first.locator('.unilu-outline-subsection:visible').count()) < 1) {
    findings.push('first outline section did not reveal its subsections')
    return
  }

  let expandedSection = first
  if (sectionCount > 1) {
    const second = sections.nth(1)
    await second.locator('.unilu-outline-trigger').click()
    await page.waitForTimeout(220)
    if ((await first.locator('.unilu-outline-subsection:visible').count()) !== 0) {
      findings.push('opening a second outline section did not collapse the first')
    }
    if ((await second.locator('.unilu-outline-subsection:visible').count()) < 1) {
      findings.push('second outline section did not reveal its subsections')
      return
    }
    expandedSection = second
  }

  await inspectAndCapture(
    outline,
    'outline expanded',
    `slide-${String(slideNo).padStart(3, '0')}-expanded.png`,
    false,
  )
  const visibleSubsection = expandedSection.locator('.unilu-outline-subsection:visible').first()
  const target = Number(await visibleSubsection.getAttribute('data-target'))
  if (!Number.isInteger(target) || target < 1) {
    findings.push('outline subsection does not expose a valid slide target')
    return
  }
  await visibleSubsection.click()
  await page.waitForURL((url) => url.pathname === `/${target}`)

  const returnButton = page.locator(`.slidev-page-${target} .unilu-outline-return:visible`).first()
  if (!(await returnButton.count())) {
    findings.push('content slide does not expose the outline-return control')
    return
  }
  const returnIcon = returnButton.locator('svg')
  const returnIconBox = await returnIcon.boundingBox()
  if (!returnIconBox || (await returnIcon.locator('path,polyline,line').count()) < 1) {
    findings.push('outline-return control does not render its Lucide icon')
  }
  await returnButton.click()
  await page.waitForURL((url) => url.pathname === `/${slideNo}` || url.pathname === '/outline')
}

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
  if (ratio > baselineDifferenceLimit) {
    findings.push(`${label} visual difference is ${(ratio * 100).toFixed(2)}%`)
  }
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

async function startBuiltServer(root, serverPort, serverHost) {
  if (!(await exists(path.join(root, 'index.html')))) {
    throw new Error('dist/index.html is missing; run the production build before visual QA --dist.')
  }

  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || '/', `http://${serverHost}:${serverPort}`)
      const decodedPath = decodeURIComponent(requestUrl.pathname)
      let target = path.resolve(root, `.${decodedPath}`)
      if (!target.startsWith(`${root}${path.sep}`) && target !== root) {
        response.writeHead(403)
        response.end('Forbidden')
        return
      }

      try {
        const stat = await fs.stat(target)
        if (stat.isDirectory()) target = path.join(target, 'index.html')
        else if (!stat.isFile()) throw new Error('Not a file')
        await fs.access(target)
      } catch {
        if (shouldServeIndex(request, decodedPath)) target = path.join(root, 'index.html')
        else {
          response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
          response.end('Not found')
          return
        }
      }

      const body = await fs.readFile(target)
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': contentType(target),
      })
      response.end(body)
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      response.end(error instanceof Error ? error.message : String(error))
    }
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(serverPort, serverHost, resolve)
  })
  return server
}

function shouldServeIndex(request, pathname) {
  const acceptsHtml = String(request.headers.accept || '').includes('text/html')
  return acceptsHtml && (!path.extname(pathname) || pathname.endsWith('/'))
}

function shouldTrackRequest(request) {
  if (!['document', 'font', 'image', 'script', 'stylesheet'].includes(request.resourceType())) {
    return false
  }
  return !/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//i.test(request.url())
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

function contentType(file) {
  const extension = path.extname(file).toLowerCase()
  return (
    {
      '.css': 'text/css; charset=utf-8',
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.gif': 'image/gif',
      '.jpeg': 'image/jpeg',
      '.jpg': 'image/jpeg',
      '.otf': 'font/otf',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.ttf': 'font/ttf',
      '.webp': 'image/webp',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
    }[extension] || 'application/octet-stream'
  )
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
