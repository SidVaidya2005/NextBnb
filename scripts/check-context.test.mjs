import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const checker = join(root, 'scripts/check-context.mjs')

function run(change, expected, pattern) {
  assert.ok(existsSync(checker), 'The documentation checker has not been implemented')
  const temp = mkdtempSync(join(tmpdir(), 'nextbnb-context-'))
  try {
    for (const path of ['CLAUDE.md', 'README.md', 'LICENSE', 'package.json', '.env.example', '.nvmrc', 'context', 'docs', 'src', 'supabase', 'e2e', 'scripts']) {
      cpSync(join(root, path), join(temp, path), { recursive: true })
    }
    change(temp)
    const result = spawnSync(process.execPath, [checker, temp], { encoding: 'utf8' })
    assert.equal(result.status, expected, result.stdout + result.stderr)
    if (pattern) assert.match(result.stdout + result.stderr, pattern)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

function append(root, path, text) {
  const file = join(root, path)
  writeFileSync(file, readFileSync(file, 'utf8') + text)
}

const record = (id, extra = '') => `\n- **${id} — Temporary decision.** Reason: exercise the checker. Source: checker test. ${extra}\n`

test('the actual documentation passes, including historical decision homes', () => run(() => {}, 0, /Essential reading:.*40,000/))
test('the reading limit names the excess and the preservation remedy', () => run(root => {
  append(root, 'context/project-overview.md', '\n' + 'x'.repeat(160004))
}, 1, /over.*tokens[\s\S]*Move detailed content into a reference/))
test('duplicate records in two files are rejected', () => run(root => {
  append(root, 'context/decisions.md', record('D-990'))
  append(root, 'context/standing-constraints.md', record('D-990'))
}, 1, /Duplicate.*D-990[\s\S]*context\/decisions.md[\s\S]*context\/standing-constraints.md/))
test('duplicate records in two sections of one file are rejected', () => run(root => {
  append(root, 'context/decisions.md', '\n## Temporary first\n' + record('D-990') + '\n## Temporary second\n' + record('D-990'))
}, 1, /Duplicate.*D-990[\s\S]*Temporary first[\s\S]*Temporary second/))
test('a reference with no decision record is rejected', () => run(root => {
  append(root, 'context/progress-tracker.md', '\nSee D-990.\n')
}, 1, /Dangling.*D-990/))
test('a missing replacement decision is rejected', () => run(root => {
  append(root, 'context/decisions.md', record('D-990', 'Superseded by D-991.'))
}, 1, /replacement.*D-991/))
test('a decision cannot replace itself', () => run(root => {
  append(root, 'context/decisions.md', record('D-990', 'Superseded by D-990.'))
}, 1, /self.*D-990/))
test('replacement cycles are rejected', () => run(root => {
  append(root, 'context/decisions.md', record('D-990', 'Superseded by D-991.') + record('D-991', 'Superseded by D-990.'))
}, 1, /cycle.*D-990/))
test('a plain reference with fuller reasoning is not a duplicate record', () => run(root => {
  append(root, 'context/decisions.md', record('D-990'))
  append(root, 'context/progress-tracker.md', '\nD-990 has fuller reasoning here: this paragraph is a reference.\n')
}, 0))
test('a record can move from recent decisions into work notes', () => run(root => {
  append(root, 'context/progress-tracker.md', record('D-990'))
  const tracker = join(root, 'context/progress-tracker.md')
  writeFileSync(tracker, readFileSync(tracker, 'utf8').replace(record('D-990'), '\nSee D-990.\n'))
  append(root, 'context/work-notes.md', record('D-990'))
}, 0))
test('a governing rule may own a record referenced by recent decisions', () => run(root => {
  append(root, 'context/code-standards.md', record('D-990'))
  append(root, 'context/progress-tracker.md', '\nSee D-990.\n')
}, 0))
test('a missing essential file is rejected', () => run(root => {
  rmSync(join(root, 'context/project-overview.md'))
}, 1, /Missing.*context\/project-overview.md/))
test('a missing on-demand file is rejected', () => run(root => {
  rmSync(join(root, 'context/library-docs.md'))
}, 1, /Missing.*context\/library-docs.md/))
test('a missing named section is rejected', () => run(root => {
  const file = join(root, 'context/architecture.md')
  writeFileSync(file, readFileSync(file, 'utf8').replace('## Invariants', '## Renamed invariants'))
}, 1, /Missing.*architecture.md#invariants/))
test('an unindexed context file cannot silently escape the inventory', () => run(root => {
  writeFileSync(join(root, 'context/unlisted.md'), '# Unlisted\n')
}, 1, /Unlisted.*context\/unlisted.md/))
test('preserved historical content cannot change silently', () => run(root => {
  append(root, 'docs/reference/build-record.md', '\nChanged history.\n')
}, 1, /Preserved content changed.*build-record.md/))
test('essential reading cannot drift from the cost inventory', () => run(root => {
  const file = join(root, 'CLAUDE.md')
  writeFileSync(file, readFileSync(file, 'utf8').replace('6. `context/DESIGN.md`', '6. `context/library-docs.md`'))
}, 1, /Essential-reading list.*differs/))
