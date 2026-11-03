/**
 * Builds the UMD bundle against what the newest JBrowse release serves, the
 * oldest v5 host a hub config may load the store's `latest/` bundle on. A
 * failure names each import that release lacks: the change needs a newer
 * JBrowse than the hosts already loading this plugin, so it waits for a release
 * rather than shipping to configs that would break.
 *
 * Run: `pnpm floor`
 */
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchHostNames, hostShim } from '@jbrowse/core/ReExports/hostShim'
import * as esbuild from 'esbuild'

import { iconsDrawThroughHostUtils, umdBuildOptions } from './umdBuild.ts'

const RELEASE = /^v(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/

function compareReleases(a: string, b: string) {
  const [, ...x] = RELEASE.exec(a)!
  const [, ...y] = RELEASE.exec(b)!
  for (let i = 0; i < 3; i++) {
    const d = Number(x[i]) - Number(y[i])
    if (d !== 0) {
      return d
    }
  }
  return x[3] === y[3]
    ? 0
    : x[3] === undefined
      ? 1
      : y[3] === undefined
        ? -1
        : x[3].localeCompare(y[3], 'en', { numeric: true })
}

const tags = execFileSync(
  'git',
  [
    'ls-remote',
    '--tags',
    'https://github.com/GMOD/jbrowse-components.git',
    'v*',
  ],
  { encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .map(line =>
    line.split('\t')[1]!.replace('refs/tags/', '').replace('^{}', ''),
  )
const floor = [...new Set(tags)]
  .filter(tag => RELEASE.test(tag))
  .sort(compareReleases)
  .at(-1)
if (!floor) {
  throw new Error('no release tag found on origin')
}

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const names = await fetchHostNames(floor)
try {
  await esbuild.build({
    ...umdBuildOptions(pluginRoot),
    plugins: [
      iconsDrawThroughHostUtils,
      hostShim({ pluginName: 'Blat', names, host: floor }),
    ],
    write: false,
    logLevel: 'silent',
  })
} catch (error) {
  if (!(error instanceof Error && 'errors' in error)) {
    throw error
  }
  for (const { text, location } of (error as esbuild.BuildFailure).errors) {
    console.error(
      location ? `${location.file}:${location.line}: ${text}` : text,
    )
  }
  console.error(
    `The BLAT bundle imports what ${floor} does not serve, and hub configs load it there. Hold the release until a JBrowse release serves it.`,
  )
  process.exit(1)
}
console.log(`builds against ${floor}, the newest JBrowse release`)
