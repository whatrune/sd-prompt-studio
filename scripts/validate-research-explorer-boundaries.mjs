#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const repoRoot = process.cwd()
const textExtensions = new Set(['.css', '.html', '.js', '.jsx', '.json', '.mjs', '.ts', '.tsx'])
const sourceRoots = ['src', 'public']
const forbiddenSourcePatterns = [
  /research[\\/]sd-prompt-research/i,
  /\.\.\/[A-Za-z0-9_./-]*research[\\/]/i,
]
const forbiddenBundlePatterns = [
  /research[\\/]sd-prompt-research/i,
  /inbox[\\/]claim-drafts/i,
  /knowledge[\\/]assertions/i,
  /experiments[\\/]bridge[\\/]BRG-/i,
  /\/api\/research\//i,
  /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])/i,
]
const forbiddenArtifactNames = new Set([
  'claim-candidate.yaml',
  'face-observation.json',
  'human-resolution.yaml',
  'manifest.yaml',
  'observation.json',
  'pre-schema-draft.yaml',
])

function walk(root) {
  if (!fs.existsSync(root)) return []
  const entries = fs.readdirSync(root, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) return walk(fullPath)
    if (entry.isFile()) return [fullPath]
    return []
  })
}

function relative(file) {
  return path.relative(repoRoot, file).split(path.sep).join('/')
}

function inspectText(file, patterns, label, failures) {
  if (!textExtensions.has(path.extname(file).toLowerCase())) return
  const contents = fs.readFileSync(file, 'utf8')
  for (const pattern of patterns) {
    if (pattern.test(contents)) {
      failures.push(`${label}: ${relative(file)} matches ${pattern}`)
    }
  }
}

const failures = []

for (const root of sourceRoots) {
  for (const file of walk(path.join(repoRoot, root))) {
    inspectText(file, forbiddenSourcePatterns, 'frontend source references Research Repository', failures)
    if (root === 'public' && forbiddenArtifactNames.has(path.basename(file))) {
      failures.push(`public directory contains Research Artifact: ${relative(file)}`)
    }
  }
}

const distFlag = process.argv.indexOf('--dist')
if (distFlag !== -1) {
  const supplied = process.argv[distFlag + 1]
  if (!supplied) {
    failures.push('--dist requires a directory')
  } else {
    const distRoot = path.resolve(repoRoot, supplied)
    for (const file of walk(distRoot)) {
      inspectText(file, forbiddenBundlePatterns, 'public bundle contains live Research path', failures)
      if (forbiddenArtifactNames.has(path.basename(file))) {
        failures.push(`public bundle contains Research Artifact: ${relative(file)}`)
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Research Explorer public-boundary validation failed:')
  for (const failure of failures.sort()) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Research Explorer public-boundary validation passed.')
