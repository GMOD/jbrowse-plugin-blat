import type { PslRow } from './blatQuery.ts'

/**
 * Which of a hit's target gaps are introns. PSL cannot say: a gap in the
 * reference between two aligned blocks is the same record whether the query is a
 * spliced transcript or genomic DNA carrying a deletion. The reference can. BLAT
 * slides each gap of a transcript query onto its intron's splice sites, so the
 * two reference bases inside each end of the gap read GT…AG (CT…AC when the
 * transcript runs the other way), while a deletion's ends carry whatever bases
 * were there.
 *
 * BLAT also slides a deletion onto those bases when it has room to, so one gap
 * is weak evidence. A transcript's introns all run one way, so the hit is the
 * unit: it is spliced when at least half of its candidate gaps carry a splice
 * motif of one strand, and then every candidate gap is an intron. The half
 * covers an intron BLAT placed a base off its splice sites, which the
 * all-or-nothing rule cost one transcript in twenty.
 *
 * Measured with standalone blat on hg19 chr1: 149 of 150 RefSeq mRNAs read as
 * spliced, and 9 of 300 genomic queries carrying a 30–1500 bp deletion read their
 * deletion as an intron.
 */

// The shortest target gap read as an intron. A shorter one is a deletion
// whatever bases flank it.
export const MIN_INTRON = 30

// GT-AG, and the minor GC-AG and AT-AC classes, read off the plus strand
const SENSE_MOTIFS = new Set(['GT-AG', 'GC-AG', 'AT-AC'])
const ANTISENSE_MOTIFS = new Set(['CT-AC', 'CT-GC', 'GT-AT'])

/**
 * A target gap that could be an intron: long enough, and with no query bases
 * skipped beside it, since a transcript's introns remove reference only.
 */
export function isIntronCandidate(queryGap: number, targetGap: number) {
  return queryGap === 0 && targetGap >= MIN_INTRON
}

export interface TargetGap {
  // interbase, plus-strand target coordinates
  start: number
  end: number
}

export function intronCandidates({ blockSizes, qStarts, tStarts }: PslRow) {
  const gaps: TargetGap[] = []
  for (let i = 1; i < blockSizes.length; i++) {
    const start = tStarts[i - 1]! + blockSizes[i - 1]!
    const queryGap = qStarts[i]! - (qStarts[i - 1]! + blockSizes[i - 1]!)
    if (isIntronCandidate(queryGap, tStarts[i]! - start)) {
      gaps.push({ start, end: tStarts[i]! })
    }
  }
  return gaps
}

/**
 * Whether a hit's candidate gaps read as introns, given the reference bases
 * inside each end of each gap: the first two and the last two.
 */
export function readsAsSpliced(ends: { first: string; last: string }[]) {
  const motifs = ends.map(
    ({ first, last }) => `${first.toUpperCase()}-${last.toUpperCase()}`,
  )
  const sense = motifs.filter(m => SENSE_MOTIFS.has(m)).length
  const antisense = motifs.filter(m => ANTISENSE_MOTIFS.has(m)).length
  return motifs.length > 0 && Math.max(sense, antisense) * 2 >= motifs.length
}

export interface BlatHit {
  row: PslRow
  // whether the hit's candidate gaps are introns, drawn as skips (N) rather
  // than deletions (D)
  spliced: boolean
}

export type ReferenceReader = (
  refName: string,
  start: number,
  end: number,
) => Promise<string>

/**
 * Each row with its splice reading. Only a row with a candidate gap costs
 * reference reads, two bases at each end of each candidate.
 */
export async function spliceHits(rows: PslRow[], read: ReferenceReader) {
  return Promise.all(
    rows.map(async row => {
      const gaps = intronCandidates(row)
      const ends = await Promise.all(
        gaps.map(async ({ start, end }) => ({
          first: await read(row.tName, start, start + 2),
          last: await read(row.tName, end - 2, end),
        })),
      )
      return { row, spliced: readsAsSpliced(ends) } satisfies BlatHit
    }),
  )
}
