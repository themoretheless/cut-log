import { createServer } from 'node:http'
import { once } from 'node:events'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import { cpus, platform, release } from 'node:os'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const benchmarkRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = resolve(benchmarkRoot, 'dist')

function parseArguments(argv) {
  const options = {
    rounds: 6,
    samples: 15,
    warmups: 3,
    output: 'results/latest.json',
    executable: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const [rawKey, inlineValue] = argv[index].split('=', 2)
    const key = rawKey.replace(/^--/, '')
    const value = inlineValue ?? argv[++index]
    if (!value) throw new Error(`Missing value for --${key}`)
    if (key === 'rounds' || key === 'samples' || key === 'warmups') {
      const parsed = Number(value)
      if (!Number.isInteger(parsed) || parsed < (key === 'warmups' ? 0 : 1)) {
        throw new Error(`--${key} must be a ${key === 'warmups' ? 'non-negative' : 'positive'} integer`)
      }
      options[key] = parsed
    } else if (key === 'output') {
      options.output = value
    } else if (key === 'browser') {
      options.executable = value
    } else {
      throw new Error(`Unknown argument: --${key}`)
    }
  }
  return options
}

function browserExecutable(explicitPath) {
  if (explicitPath) {
    if (!existsSync(explicitPath)) throw new Error(`Browser executable does not exist: ${explicitPath}`)
    return explicitPath
  }
  const candidates = [
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/microsoft-edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ]
  return candidates.find(existsSync)
}

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
}

async function startServer() {
  const server = createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname)
      if (pathname === '/favicon.ico') {
        response.writeHead(204).end()
        return
      }
      const relativePath = pathname === '/' ? 'vue-layout.html' : pathname.replace(/^\/+/, '')
      const filePath = resolve(distRoot, relativePath)
      if (filePath !== distRoot && !filePath.startsWith(`${distRoot}${sep}`)) {
        response.writeHead(403).end('Forbidden')
        return
      }
      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        response.writeHead(404).end('Not found')
        return
      }
      response.writeHead(200, {
        'cache-control': 'no-store',
        'content-type': MIME_TYPES[extname(filePath)] || 'application/octet-stream',
      })
      response.end(readFileSync(filePath))
    } catch (error) {
      response.writeHead(500).end(error instanceof Error ? error.message : String(error))
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Unable to resolve benchmark server address')
  return { server, origin: `http://127.0.0.1:${address.port}` }
}

function closeServer(server) {
  return new Promise((resolveClose, rejectClose) => {
    server.close(error => error ? rejectClose(error) : resolveClose())
  })
}

function quantile(values, probability) {
  if (values.length === 0) return Number.NaN
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * probability) - 1))
  return sorted[index]
}

function median(values) {
  if (values.length === 0) return Number.NaN
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function summarize(values) {
  const center = median(values)
  return {
    samples: values.length,
    medianMs: center,
    p95Ms: quantile(values, 0.95),
    madMs: median(values.map(value => Math.abs(value - center))),
    minMs: Math.min(...values),
    maxMs: Math.max(...values),
  }
}

function assetSizes(entryName) {
  const manifest = JSON.parse(readFileSync(resolve(distRoot, '.vite/manifest.json'), 'utf8'))
  const includedFiles = new Set()
  const visitedEntries = new Set()

  function visit(key) {
    if (visitedEntries.has(key)) return
    visitedEntries.add(key)
    const entry = manifest[key]
    if (!entry) throw new Error(`Manifest entry not found: ${key}`)
    if (entry.file) includedFiles.add(entry.file)
    for (const css of entry.css || []) includedFiles.add(css)
    for (const imported of entry.imports || []) visit(imported)
  }

  visit(`${entryName}.html`)
  const files = [...includedFiles].sort()
  const totals = files.reduce((result, relativePath) => {
    const bytes = readFileSync(resolve(distRoot, relativePath))
    result.rawBytes += bytes.length
    result.gzipBytes += gzipSync(bytes).length
    result.brotliBytes += brotliCompressSync(bytes).length
    return result
  }, { rawBytes: 0, gzipBytes: 0, brotliBytes: 0 })
  return { ...totals, files }
}

const IMPLEMENTATIONS = ['vue', 'svelte', 'retained']

const CASES = [
  {
    name: 'layout-normal',
    workload: 'layout',
    operations: ['select-from-none', 'switch-selection', 'clear-selection', 'geometry'],
    query: '?sheets=6&pieces=40',
    entries: { vue: 'vue-layout', svelte: 'svelte-layout', retained: 'retained-layout' },
  },
  {
    name: 'layout-stress-2000',
    workload: 'layout',
    operations: ['select-from-none', 'switch-selection', 'clear-selection', 'geometry'],
    query: '?sheets=20&pieces=100',
    entries: { vue: 'vue-layout', svelte: 'svelte-layout', retained: 'retained-layout' },
  },
  {
    name: 'skadis-large-svg',
    workload: 'skadis',
    operations: ['pitch', 'board-size'],
    query: '',
    entries: { vue: 'vue-skadis', svelte: 'svelte-skadis', retained: 'retained-skadis' },
  },
]

const BALANCED_ORDERS = [
  ['vue', 'svelte', 'retained'],
  ['svelte', 'retained', 'vue'],
  ['retained', 'vue', 'svelte'],
  ['retained', 'svelte', 'vue'],
  ['svelte', 'vue', 'retained'],
  ['vue', 'retained', 'svelte'],
]

function emptyFrameworkResult() {
  return { signature: null, samples: { mount: [] } }
}

async function correctnessSignatures(browser, origin, benchmarkCase, implementation) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    locale: 'en-US',
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  try {
    const entry = benchmarkCase.entries[implementation]
    await page.goto(`${origin}/${entry}.html${benchmarkCase.query}`, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => Boolean(window.__frameworkBenchmark))
    const contract = await page.evaluate(() => ({
      framework: window.__frameworkBenchmark.framework,
      workload: window.__frameworkBenchmark.workload,
      operations: [...window.__frameworkBenchmark.operations],
    }))
    if (contract.framework !== implementation
      || contract.workload !== benchmarkCase.workload
      || JSON.stringify(contract.operations) !== JSON.stringify(benchmarkCase.operations)) {
      throw new Error(`Unexpected harness contract: ${JSON.stringify(contract)}`)
    }
    const signatures = await page.evaluate(async operations => {
      const harness = window.__frameworkBenchmark
      await harness.mount()
      const states = [{ label: 'initial', signature: harness.signature() }]
      for (const operation of operations) {
        await harness.prepare(operation)
        states.push({ label: `${operation}-prepared`, signature: harness.signature() })
        await harness.run(operation)
        states.push({ label: `${operation}-complete`, signature: harness.signature() })
      }
      await harness.destroy()
      return states
    }, benchmarkCase.operations)
    if (errors.length > 0) throw new Error(`Browser errors: ${errors.join(' | ')}`)
    return signatures
  } finally {
    await context.close()
  }
}

async function validateCorrectness(browser, origin, report) {
  for (const benchmarkCase of CASES) {
    let expected = null
    for (const implementation of IMPLEMENTATIONS) {
      process.stdout.write(`correctness · ${benchmarkCase.name} · ${implementation}\n`)
      const signatures = await correctnessSignatures(browser, origin, benchmarkCase, implementation)
      report.cases[benchmarkCase.name][implementation].signature = signatures[0].signature
      if (!expected) {
        expected = signatures
        report.cases[benchmarkCase.name].correctness = signatures
        continue
      }
      for (let index = 0; index < expected.length; index += 1) {
        if (!signaturesEqual(expected[index].signature, signatures[index].signature)) {
          throw new Error(
            `DOM parity failed for ${benchmarkCase.name} at ${expected[index].label}:\nVue ${JSON.stringify(expected[index].signature)}\n${implementation} ${JSON.stringify(signatures[index].signature)}`,
          )
        }
      }
    }
  }
}

async function runFramework(browser, origin, benchmarkCase, framework, options, destination) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    locale: 'en-US',
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })

  try {
    const entry = benchmarkCase.entries[framework]
    await page.goto(`${origin}/${entry}.html${benchmarkCase.query}`, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => Boolean(window.__frameworkBenchmark))

    const contract = await page.evaluate(() => ({
      framework: window.__frameworkBenchmark.framework,
      workload: window.__frameworkBenchmark.workload,
      operations: [...window.__frameworkBenchmark.operations],
    }))
    if (contract.framework !== framework
      || contract.workload !== benchmarkCase.workload
      || JSON.stringify(contract.operations) !== JSON.stringify(benchmarkCase.operations)) {
      throw new Error(`Unexpected harness contract: ${JSON.stringify(contract)}`)
    }
    for (const operation of contract.operations) destination.samples[operation] ||= []

    for (let index = 0; index < options.warmups; index += 1) {
      await page.evaluate(async () => {
        const harness = window.__frameworkBenchmark
        await harness.mount()
        for (const operation of harness.operations) {
          await harness.prepare(operation)
          await harness.run(operation)
        }
        await harness.destroy()
      })
    }

    for (let index = 0; index < options.samples; index += 1) {
      const duration = await page.evaluate(async () => {
        const harness = window.__frameworkBenchmark
        const duration = await harness.mount()
        await harness.destroy()
        return duration
      })
      destination.samples.mount.push(duration)
    }

    await page.evaluate(() => window.__frameworkBenchmark.mount())
    for (const operation of contract.operations) {
      for (let index = 0; index < options.warmups; index += 1) {
        await page.evaluate(async name => {
          const harness = window.__frameworkBenchmark
          await harness.prepare(name)
          await harness.run(name)
        }, operation)
      }
      for (let index = 0; index < options.samples; index += 1) {
        const duration = await page.evaluate(async name => {
          const harness = window.__frameworkBenchmark
          await harness.prepare(name)
          return harness.run(name)
        }, operation)
        destination.samples[operation].push(duration)
      }
    }
    await page.evaluate(() => window.__frameworkBenchmark.destroy())

    if (errors.length > 0) throw new Error(`Browser errors: ${errors.join(' | ')}`)
  } finally {
    await context.close()
  }
}

function signaturesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function createReport(options, executable) {
  return {
    generatedAt: new Date().toISOString(),
    gitCommit: process.env.GIT_COMMIT || null,
    environment: {
      node: process.version,
      platform: platform(),
      release: release(),
      architecture: process.arch,
      cpu: cpus()[0]?.model || 'unknown',
      browserExecutable: executable || 'Playwright bundled Chromium',
      browserVersion: null,
    },
    config: {
      rounds: options.rounds,
      samplesPerRound: options.samples,
      warmups: options.warmups,
      viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
      order: 'six balanced permutations',
    },
    bundles: Object.fromEntries(
      CASES.flatMap(benchmarkCase => Object.values(benchmarkCase.entries))
        .filter((entry, index, entries) => entries.indexOf(entry) === index)
        .map(entry => [entry, assetSizes(entry)]),
    ),
    cases: Object.fromEntries(CASES.map(benchmarkCase => [benchmarkCase.name, {
      workload: benchmarkCase.workload,
      query: benchmarkCase.query,
      ...Object.fromEntries(IMPLEMENTATIONS.map(implementation => [implementation, emptyFrameworkResult()])),
      summary: null,
    }])),
  }
}

function finalizeReport(report) {
  for (const benchmarkCase of CASES) {
    const result = report.cases[benchmarkCase.name]
    for (const implementation of IMPLEMENTATIONS.slice(1)) {
      if (!signaturesEqual(result.vue.signature, result[implementation].signature)) {
        throw new Error(
          `DOM parity failed for ${benchmarkCase.name}:\nVue ${JSON.stringify(result.vue.signature)}\n${implementation} ${JSON.stringify(result[implementation].signature)}`,
        )
      }
    }
    const metrics = Object.keys(result.vue.samples)
    for (const implementation of IMPLEMENTATIONS.slice(1)) {
      if (JSON.stringify(Object.keys(result[implementation].samples)) !== JSON.stringify(metrics)) {
        throw new Error(`Metric contract mismatch for ${benchmarkCase.name}: ${implementation}`)
      }
      for (const metric of metrics) {
        if (result[implementation].samples[metric].length !== result.vue.samples[metric].length) {
          throw new Error(`Sample count mismatch for ${benchmarkCase.name}/${metric}: ${implementation}`)
        }
      }
    }
    result.summary = Object.fromEntries(metrics.map(metric => {
      const vue = summarize(result.vue.samples[metric])
      const svelte = summarize(result.svelte.samples[metric])
      const retained = summarize(result.retained.samples[metric])
      return [metric, {
        vue,
        svelte,
        retained,
        svelteDeltaPercent: (svelte.medianMs / vue.medianMs - 1) * 100,
        retainedDeltaPercent: (retained.medianMs / vue.medianMs - 1) * 100,
      }]
    }))
  }
}

function printReport(report) {
  const performanceRows = []
  for (const benchmarkCase of CASES) {
    for (const [metric, summary] of Object.entries(report.cases[benchmarkCase.name].summary)) {
      performanceRows.push({
        case: benchmarkCase.name,
        metric,
        'Vue median ms': summary.vue.medianMs.toFixed(3),
        'Vue p95 ms': summary.vue.p95Ms.toFixed(3),
        'Svelte median ms': summary.svelte.medianMs.toFixed(3),
        'Svelte p95 ms': summary.svelte.p95Ms.toFixed(3),
        'Svelte delta': `${summary.svelteDeltaPercent >= 0 ? '+' : ''}${summary.svelteDeltaPercent.toFixed(1)}%`,
        'Retained median ms': summary.retained.medianMs.toFixed(3),
        'Retained p95 ms': summary.retained.p95Ms.toFixed(3),
        'Retained delta': `${summary.retainedDeltaPercent >= 0 ? '+' : ''}${summary.retainedDeltaPercent.toFixed(1)}%`,
      })
    }
  }
  console.log('\nUI runtime (negative delta means faster than Vue)')
  console.table(performanceRows)

  const bundleRows = Object.entries(report.bundles).map(([entry, sizes]) => ({
    entry,
    'raw KiB': (sizes.rawBytes / 1024).toFixed(2),
    'gzip KiB': (sizes.gzipBytes / 1024).toFixed(2),
    'brotli KiB': (sizes.brotliBytes / 1024).toFixed(2),
  }))
  console.log('\nProduction JS + CSS loaded by each entry')
  console.table(bundleRows)
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  if (!existsSync(resolve(distRoot, '.vite/manifest.json'))) {
    throw new Error('Production build is missing. Run npm run build first.')
  }
  const executable = browserExecutable(options.executable)
  const report = createReport(options, executable)
  const { server, origin } = await startServer()
  let browser
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: executable,
      args: [
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--force-device-scale-factor=1',
      ],
    })
    report.environment.browserVersion = browser.version()
    await validateCorrectness(browser, origin, report)
    for (let round = 0; round < options.rounds; round += 1) {
      const order = BALANCED_ORDERS[round % BALANCED_ORDERS.length]
      for (const benchmarkCase of CASES) {
        for (const framework of order) {
          process.stdout.write(`round ${round + 1}/${options.rounds} · ${benchmarkCase.name} · ${framework}\n`)
          await runFramework(
            browser,
            origin,
            benchmarkCase,
            framework,
            options,
            report.cases[benchmarkCase.name][framework],
          )
        }
      }
    }
    finalizeReport(report)
    printReport(report)

    const outputPath = resolve(benchmarkRoot, options.output)
    mkdirSync(dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
    console.log(`\nRaw report: ${outputPath}`)
  } finally {
    await browser?.close()
    await closeServer(server)
  }
}

await main()
