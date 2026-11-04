import {
  intronCandidates,
  readsAsSpliced,
  spliceHits,
} from './spliceJunctions.ts'

import type { PslRow } from './blatQuery.ts'

function hit({
  blockSizes,
  qStarts,
  tStarts,
}: Pick<PslRow, 'blockSizes' | 'qStarts' | 'tStarts'>): PslRow {
  return {
    matches: 0,
    misMatches: 0,
    repMatches: 0,
    qNumInsert: 0,
    qBaseInsert: 0,
    tNumInsert: 0,
    tBaseInsert: 0,
    strand: 1,
    qName: 'YourSeq',
    qSize: qStarts.at(-1)! + blockSizes.at(-1)!,
    qStart: qStarts[0]!,
    qEnd: qStarts.at(-1)! + blockSizes.at(-1)!,
    tName: 'chr1',
    tSize: 1_000_000,
    tStart: tStarts[0]!,
    tEnd: tStarts.at(-1)! + blockSizes.at(-1)!,
    blockSizes,
    qStarts,
    tStarts,
    score: 0,
    identity: 100,
    coverage: 100,
  }
}

// three blocks of 100: a 500 bp intron, then a 2 bp target gap beside a 1 bp
// query insert
const threeBlocks = hit({
  blockSizes: [100, 100, 100],
  qStarts: [0, 100, 201],
  tStarts: [1000, 1600, 1702],
})

test('a long target gap with no query gap beside it is an intron candidate', () => {
  expect(intronCandidates(threeBlocks)).toEqual([{ start: 1100, end: 1600 }])
})

test('a gap shorter than an intron is no candidate', () => {
  const short = hit({
    blockSizes: [100, 100],
    qStarts: [0, 100],
    tStarts: [1000, 1129],
  })
  expect(intronCandidates(short)).toEqual([])
})

test('a long target gap beside a query insert is no candidate', () => {
  const indel = hit({
    blockSizes: [100, 100],
    qStarts: [0, 103],
    tStarts: [1000, 1500],
  })
  expect(intronCandidates(indel)).toEqual([])
})

test('a single block has no candidates', () => {
  expect(
    intronCandidates(hit({ blockSizes: [100], qStarts: [0], tStarts: [1000] })),
  ).toEqual([])
})

const ends = (...motifs: string[]) =>
  motifs.map(m => {
    const [first, last] = m.split('-') as [string, string]
    return { first, last }
  })

test.each([
  ['canonical introns on the plus strand', ['GT-AG', 'GT-AG'], true],
  ['canonical introns on the minus strand', ['CT-AC', 'CT-AC', 'CT-AC'], true],
  ['minor-class introns', ['GC-AG', 'AT-AC'], true],
  ['one intron a base off its splice sites', ['CT-AC', 'CT-AC', 'CA-AC'], true],
  ['a deletion between arbitrary bases', ['AC-TG'], false],
  ['mostly arbitrary bases', ['GT-AG', 'AA-TT', 'CC-GG'], false],
  ['no candidates', [], false],
])('%s: spliced is %s', (_name, motifs, spliced) => {
  expect(readsAsSpliced(ends(...motifs))).toBe(spliced)
})

// a soft-masked 2bit hands repeat bases back in lower case
test('reads lower-case reference bases', () => {
  expect(readsAsSpliced(ends('gt-ag'))).toBe(true)
})

test('reads two bases inside each end of each candidate, and only those', async () => {
  const asked: string[] = []
  const reference = new Map([
    ['chr1:1100-1102', 'GT'],
    ['chr1:1598-1600', 'AG'],
  ])
  const unsplicedSingle = hit({
    blockSizes: [100],
    qStarts: [0],
    tStarts: [5000],
  })
  const hits = await spliceHits(
    [threeBlocks, unsplicedSingle],
    async (refName, start, end) => {
      const key = `${refName}:${start}-${end}`
      asked.push(key)
      return reference.get(key) ?? 'NN'
    },
  )
  expect(asked.sort()).toEqual(['chr1:1100-1102', 'chr1:1598-1600'])
  expect(hits.map(h => h.spliced)).toEqual([true, false])
})
