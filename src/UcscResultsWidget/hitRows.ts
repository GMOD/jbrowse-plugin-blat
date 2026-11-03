import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

// feature fields are `unknown` off the serialized feature's index signature
function num(value: unknown) {
  return typeof value === 'number' ? value : undefined
}

function text(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

export function bp(n: number) {
  return `${n.toLocaleString('en-US')} bp`
}

export function hitPosition({
  refName,
  start,
  end,
  strand,
}: SimpleFeatureSerialized) {
  const range = `${(start + 1).toLocaleString('en-US')}-${end.toLocaleString('en-US')}`
  return `${refName}:${range} (${strand === -1 ? '-' : '+'})`
}

function alignment(feature: SimpleFeatureSerialized) {
  const start = num(feature.queryStart)
  const end = num(feature.queryEnd)
  const size = num(feature.querySize)
  const blocks = num(feature.blockCount)
  const range =
    start === undefined || end === undefined || size === undefined
      ? undefined
      : `query bases ${start + 1}-${end} of ${bp(size)}`
  const split =
    blocks !== undefined && blocks > 1
      ? `in ${blocks} blocks spanning ${bp(feature.end - feature.start)}`
      : undefined
  return range && split ? `${range}, ${split}` : (range ?? split)
}

/**
 * One row of the hit table. A BLAT hit is judged on identity and on how much of
 * the query it accounts for (a 99% hit over a tenth of the query is not the
 * locus you searched for), an hgPcr product on its size. Built from the fields
 * the feature actually carries, so it can't claim a number the hit doesn't have.
 */
export function hitRow(feature: SimpleFeatureSerialized) {
  return {
    id: feature.uniqueId,
    feature,
    position: hitPosition(feature),
    size: feature.end - feature.start,
    identity: num(feature.identity),
    coverage: num(feature.coverage),
    alignment: alignment(feature),
  }
}

export type HitRow = ReturnType<typeof hitRow>

/** The rows describing the search itself, read off its first result. */
export function searchFields(first: SimpleFeatureSerialized | undefined) {
  const querySize = num(first?.querySize)
  return {
    'Forward primer': text(first?.forwardPrimer),
    'Reverse primer': text(first?.reversePrimer),
    'Query length': querySize === undefined ? undefined : bp(querySize),
  }
}
