import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Keep these lists aligned with CLAUDE.md. Whole files count toward each group.
const root = process.argv[2] ? resolve(process.argv[2]) : resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ALWAYS = [
  'CLAUDE.md',
  'context/project-overview.md',
  'context/architecture.md',
  'context/standing-constraints.md',
  'context/code-standards.md',
  'context/progress-tracker.md',
  'context/DESIGN.md',
]
const ON_DEMAND = [
  'README.md',
  'context/build-plan.md',
  'context/build-journal.md',
  'context/decisions.md',
  'context/library-docs.md',
  'context/work-notes.md',
  'context/documentation-checks.md',
  'docs/deploy-render.md',
  'docs/reference/README.md',
  'docs/reference/architecture-notes.md',
  'docs/reference/engineering-notes.md',
  'docs/reference/library-examples.md',
  'docs/reference/design-reference.md',
  'docs/reference/build-record.md',
  'docs/reference/maintenance-notes.md',
  'docs/verification/context-rewrite.md',
]
const CEILING = 40000
const errors = []
const fail = message => errors.push(message)
const read = path => readFileSync(join(root, path), 'utf8')
const stripCode = text => text.replace(/^(?:```|~~~)[\s\S]*?^(?:```|~~~).*$/gm, block => '\n'.repeat(block.split('\n').length - 1))
const format = value => value.toLocaleString('en-US', { maximumFractionDigits: 1 })
const files = [...new Set([...ALWAYS, ...ON_DEMAND])]
const texts = new Map()

function walk(path) {
  if (!existsSync(join(root, path))) return []
  return readdirSync(join(root, path), { withFileTypes: true }).flatMap(entry => {
    const file = join(path, entry.name)
    return entry.isDirectory() ? walk(file) : file.endsWith('.md') ? [file] : []
  })
}

for (const file of files) {
  if (!existsSync(join(root, file))) fail(`Missing file: ${file}`)
  else texts.set(file, read(file))
}
for (const file of [...walk('context'), ...walk('docs')]) {
  if (!files.includes(file)) fail(`Unlisted documentation file: ${file}; add its reading condition and inventory entry`)
}

function cost(group) {
  let total = 0
  for (const file of group) {
    if (!texts.has(file)) continue
    const tokens = Buffer.byteLength(texts.get(file)) / 4
    console.log(`  ${file}: ${format(tokens)} estimated tokens`)
    total += tokens
  }
  return total
}

console.log('Essential files (bytes / 4):')
const essential = cost(ALWAYS)
console.log(`Essential reading: ${format(essential)} / ${format(CEILING)} estimated tokens`)
if (essential > CEILING) {
  fail(`Essential reading is over the ceiling by ${format(essential - CEILING)} tokens.\nMove detailed content into a reference and add or extend its reading condition. Prove the moved bytes are identical. Raising the ceiling requires a deliberate commit explaining why. Deleting content is not a remedy.`)
}
console.log('On-demand inventory (not a typical session cost):')
console.log(`On-demand inventory total: ${format(cost(ON_DEMAND))} estimated tokens`)

function slug(text) {
  return text.replace(/<[^>]*>/g, '').replace(/[`*_]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/ /g, '-')
}

function anchors(text) {
  const seen = new Map()
  const result = new Set()
  for (const match of stripCode(text).matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = slug(match[1])
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    result.add(count ? `${base}-${count}` : base)
  }
  return result
}

let preserved = {}
const manifest = 'docs/reference/preservation.json'
if (!existsSync(join(root, manifest))) fail(`Missing preservation manifest: ${manifest}`)
else {
  try {
    preserved = JSON.parse(read(manifest))
    for (const [file, item] of Object.entries(preserved)) {
      if (!texts.has(file)) continue
      const body = readFileSync(join(root, file)).subarray(item.prefixBytes)
      const hash = createHash('sha256').update(body).digest('hex')
      if (hash !== item.sha256) fail(`Preserved content changed: ${file} (source ${item.source})`)
    }
  } catch (error) {
    fail(`Invalid preservation manifest: ${error.message}`)
  }
}

function checkTarget(from, target, baseFile = from) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) return
  const clean = target.replace(/^<|>$/g, '').split(/\s+"/)[0]
  const [path, section] = clean.split('#')
  let decodedPath
  try { decodedPath = decodeURIComponent(path) } catch { fail(`Invalid link in ${from}: ${target}`); return }
  const dest = path ? resolve(root, dirname(baseFile), decodedPath) : resolve(root, baseFile)
  const local = relative(root, dest)
  if (!existsSync(dest)) { fail(`Missing reference in ${from}: ${local}${section ? '#' + section : ''}`); return }
  if (section && dest.endsWith('.md') && statSync(dest).isFile()) {
    const names = anchors(readFileSync(dest, 'utf8'))
    if (!names.has(decodeURIComponent(section))) fail(`Missing section in ${from}: ${local}#${section}`)
  }
}

for (const [file, text] of texts) {
  const body = stripCode(text)
  // Preserved snapshots retain paths relative to their former location.
  const base = preserved[file]?.source ?? file
  for (const match of body.matchAll(/!?\[[^\n]*?\]\(([^)\n]+)\)/g)) checkTarget(file, match[1], base)
  for (const match of body.matchAll(/<(?:img|source)\b[^>]*\bsrc="([^"]+)"/g)) checkTarget(file, match[1], base)
}

const agent = texts.get('CLAUDE.md') ?? ''
for (const match of agent.matchAll(/context\/[A-Za-z0-9._/-]+\.md/g)) checkTarget('CLAUDE.md', match[0])
if (agent.split('\n').length >= 250) fail('CLAUDE.md must have fewer than 250 lines')
if (!/^## Information locations$/m.test(agent)) fail('CLAUDE.md is missing Information locations')
const readingList = agent.split(/^## Always read, in this order$/m)[1]?.split(/^## /m)[0] ?? ''
const declared = [...readingList.matchAll(/^\d+\. `([^`]+)`/gm)].map(match => match[1])
if (JSON.stringify(declared) !== JSON.stringify(ALWAYS.slice(1))) fail('Essential-reading list in CLAUDE.md differs from the checker inventory or order')

// Every context file is a declared decision home across all of its actual
// sections, including governing rules, work notes and the historical journal.
// Original pre-rewrite snapshots are evidence, not new authoritative records.
const records = new Map()
const references = []
for (const [file, text] of texts) {
  const frozen = Boolean(preserved[file]) || file === 'context/build-journal.md'
  if (file.startsWith('context/')) {
    const roleCount = (text.match(/^> \*\*Role:\*\*/gm) ?? []).length
    if (roleCount !== 1) fail(`${file}: expected one Role blockquote, found ${roleCount}`)
    if ((text.match(/^## How this file is maintained$/gm) ?? []).length !== 1) fail(`${file}: expected one maintenance section`)
  }
  if (!frozen && /\{\{[^}]+\}\}|<!--\s*(?:AI:|TEMPLATE)/.test(text)) fail(`Unfinished scaffolding in ${file}`)
  const lines = stripCode(text).split('\n')
  const sections = []
  for (const [index, line] of lines.entries()) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) { sections.length = heading[1].length - 1; sections[heading[1].length - 1] = heading[2] }
    const location = `${file}:${index + 1} (${sections.filter(Boolean).join(' > ')})`
    if (preserved[file]) continue
    for (const match of line.matchAll(/\bD-\d{3,}\b/g)) references.push({ id: match[0], location })
    const match = line.match(/^- \*\*(D-\d{3,}) — (.+)\.\*\*\s*(.*)$/)
    if (!match) continue
    if (!file.startsWith('context/')) fail(`Decision record outside declared homes: ${location}`)
    if (!/\bReason:\s*\S/.test(match[3]) || !/\bSource:\s*\S/.test(match[3])) fail(`Missing reason or source for ${match[1]} at ${location}`)
    const entry = { id: match[1], location, text: match[3] }
    records.set(entry.id, [...(records.get(entry.id) ?? []), entry])
  }
}
for (const [id, entries] of records) {
  if (entries.length > 1) fail(`Duplicate decision ${id}:\n${entries.map(entry => entry.location).sort().join('\n')}`)
}
for (const { id, location } of references) {
  if (!records.has(id)) fail(`Dangling decision reference ${id} at ${location}`)
}
const replacements = new Map()
for (const [id, entries] of records) {
  const replacement = entries[0].text.match(/Superseded by (D-\d{3,})/i)?.[1]
  if (!replacement) continue
  if (replacement === id) fail(`Invalid self replacement for ${id}`)
  if (!records.has(replacement)) fail(`Missing replacement ${replacement} for ${id}`)
  replacements.set(id, replacement)
}
for (const id of replacements.keys()) {
  const seen = new Set()
  let current = id
  while (replacements.has(current)) {
    if (seen.has(current)) { fail(`Replacement cycle involving ${id}`); break }
    seen.add(current)
    current = replacements.get(current)
  }
}
const tracker = texts.get('context/progress-tracker.md') ?? ''
const recent = tracker.split(/^## Key Decisions\s*$/m)[1]?.split(/^## /m)[0] ?? ''
if ((recent.match(/^- /gm) ?? []).length > 10) fail('Key Decisions exceeds the ten-entry display limit')

if (errors.length) {
  console.error(`\nDocumentation checks failed (${errors.length}):\n${errors.map(error => '- ' + error).join('\n')}`)
  process.exitCode = 1
} else {
  console.log(`\nDocumentation checks passed; ${records.size} authoritative decisions. Semantic, secret and library-evidence review remain manual.`)
}
