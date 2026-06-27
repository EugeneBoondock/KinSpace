import { spawnSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const roots = ['src', 'scripts']

function findTests(dir) {
  const found = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      found.push(...findTests(full))
    } else if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) {
      found.push(full)
    }
  }
  return found
}

const files = roots.flatMap((root) => findTests(root)).map((file) => relative(process.cwd(), file)).sort()

if (files.length === 0) {
  console.error('No node test files found.')
  process.exit(1)
}

const tsxCli = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs')
const batchSize = 25

for (let start = 0; start < files.length; start += batchSize) {
  const batch = files.slice(start, start + batchSize)
  const result = spawnSync(process.execPath, [tsxCli, '--test', '--test-reporter=dot', ...batch], {
    stdio: 'inherit',
  })

  if (result.error) {
    console.error(result.error.message)
    process.exit(1)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
