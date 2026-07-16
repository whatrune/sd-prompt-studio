#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

const validator = path.resolve('scripts/validate-research-explorer-boundaries.mjs')

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'research-boundary-'))
  fs.mkdirSync(path.join(root, 'src'), { recursive: true })
  fs.mkdirSync(path.join(root, 'public'), { recursive: true })
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true })
  fs.writeFileSync(path.join(root, 'src', 'app.ts'), "export const fixture = true\n")
  fs.writeFileSync(path.join(root, 'dist', 'index.html'), '<!doctype html>fixture')
  return root
}

function validate(root) {
  return spawnSync(process.execPath, [validator, '--dist', 'dist'], {
    cwd: root,
    encoding: 'utf8',
  })
}

const clean = fixture()
try {
  assert.equal(validate(clean).status, 0, 'clean fixture should pass')
} finally {
  fs.rmSync(clean, { recursive: true, force: true })
}

const sourceLeak = fixture()
try {
  fs.writeFileSync(
    path.join(sourceLeak, 'src', 'app.ts'),
    "import data from '../research/sd-prompt-research/experiments/run.json'\n",
  )
  const result = validate(sourceLeak)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /frontend source references Research Repository/)
} finally {
  fs.rmSync(sourceLeak, { recursive: true, force: true })
}

const publicArtifact = fixture()
try {
  fs.writeFileSync(path.join(publicArtifact, 'public', 'observation.json'), '{}')
  const result = validate(publicArtifact)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /public directory contains Research Artifact/)
} finally {
  fs.rmSync(publicArtifact, { recursive: true, force: true })
}

const bundleLeak = fixture()
try {
  fs.writeFileSync(path.join(bundleLeak, 'dist', 'app.js'), "fetch('/api/research/index')")
  const result = validate(bundleLeak)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /public bundle contains live Research path/)
} finally {
  fs.rmSync(bundleLeak, { recursive: true, force: true })
}

console.log('Research Explorer boundary regression tests passed.')
