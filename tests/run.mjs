import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { unlinkSync } from 'node:fs'

const outfile = 'tests/.regressions.test.mjs'
try {
  await build({ entryPoints: ['tests/regressions.jsx'], outfile, bundle: true,
    platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic' })
  const result = spawnSync(process.execPath, ['--test', outfile], { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} finally {
  try { unlinkSync(outfile) } catch {}
}
