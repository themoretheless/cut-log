import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const srcRoot = fileURLToPath(new URL('../src/', import.meta.url))
const sourceExtensions = new Set(['.ts', '.svelte'])

const forbiddenTargets = {
  lib: new Set(['box', 'components', 'composables', 'pages', 'services', 'stores']),
  helpers: new Set(['box', 'components', 'composables', 'pages', 'services', 'stores']),
  services: new Set(['box', 'components', 'composables', 'pages', 'stores']),
  composables: new Set(['box', 'components', 'pages', 'stores']),
  box: new Set(['components', 'composables', 'pages', 'services', 'stores']),
  components: new Set(['pages']),
  stores: new Set(['box', 'components', 'composables', 'pages', 'services']),
}

// Pure layers must stay framework-free: no Svelte reactivity, no Three.js.
const forbiddenBareModules = {
  lib: new Set(['svelte', 'three']),
  helpers: new Set(['svelte', 'three']),
}

function bareModuleBase(specifier) {
  const segments = specifier.split('/')
  return specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]
}

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(target)
    return sourceExtensions.has(path.extname(entry.name)) ? [target] : []
  })
}

function layerOf(file) {
  const relative = path.relative(srcRoot, file)
  return relative.startsWith('..') ? null : relative.split(path.sep)[0]
}

function resolveImport(source, specifier) {
  if (specifier.startsWith('@/')) return path.join(srcRoot, specifier.slice(2))
  if (specifier.startsWith('.')) return path.resolve(path.dirname(source), specifier)
  return null
}

function isAllowedException(sourceLayer, target) {
  if (sourceLayer !== 'lib') return false
  return path.relative(srcRoot, target).split(path.sep).join('/') === 'services/types'
}

const violations = []
for (const file of sourceFiles(srcRoot)) {
  const sourceLayer = layerOf(file)
  const denied = forbiddenTargets[sourceLayer]
  if (!denied) continue

  const contents = fs.readFileSync(file, 'utf8')
  const imports = ts.preProcessFile(contents, true, true).importedFiles
  const lineMap = ts.computeLineStarts(contents)
  for (const imported of imports) {
    const target = resolveImport(file, imported.fileName)
    if (!target) {
      const deniedBare = forbiddenBareModules[sourceLayer]
      const base = bareModuleBase(imported.fileName)
      const scope = imported.fileName.split('/')[0]
      if (deniedBare && (deniedBare.has(base) || deniedBare.has(scope))) {
        const line = ts.computeLineAndCharacterOfPosition(lineMap, imported.pos).line + 1
        violations.push(
          `${path.relative(srcRoot, file)}:${line} ${sourceLayer} must stay pure (${imported.fileName})`,
        )
      }
      continue
    }
    if (isAllowedException(sourceLayer, target)) continue
    const targetLayer = layerOf(target)
    if (!targetLayer || !denied.has(targetLayer)) continue
    const line = ts.computeLineAndCharacterOfPosition(lineMap, imported.pos).line + 1
    violations.push(
      `${path.relative(srcRoot, file)}:${line} ${sourceLayer} must not import ${targetLayer} (${imported.fileName})`,
    )
  }
}

const lineBudgets = new Map([
  ['pages/Home.svelte', 800],
])
for (const [relative, limit] of lineBudgets) {
  const contents = fs.readFileSync(path.join(srcRoot, relative), 'utf8')
  const lines = contents.split(/\r?\n/).length
  if (lines > limit) violations.push(`${relative} has ${lines} lines; architectural budget is ${limit}`)
}

if (violations.length) {
  console.error(`Dependency boundary violations:\n${violations.join('\n')}`)
  process.exitCode = 1
} else {
  console.log('Dependency boundaries passed')
}
