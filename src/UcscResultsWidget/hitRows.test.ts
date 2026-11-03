import { parseBlatResponse, pslToFeatures } from '../blatQuery.ts'
import { parseIsPcrResponse } from '../ispcrQuery.ts'
import { hitRow, searchFields } from './hitRows.ts'

// a one-hit hgBlat output=json body, the same shape the dialog parses
const BLAT_JSON = JSON.stringify({
  fields: [
    'matches',
    'misMatches',
    'repMatches',
    'nCount',
    'qNumInsert',
    'qBaseInsert',
    'tNumInsert',
    'tBaseInsert',
    'strand',
    'qName',
    'qSize',
    'qStart',
    'qEnd',
    'tName',
    'tSize',
    'tStart',
    'tEnd',
    'blockCount',
    'blockSizes',
    'qStarts',
    'tStarts',
  ],
  blat: [
    // prettier-ignore
    [145, 2, 0, 0, 0, 0, 0, 0, '+', 'YourSeq', 147, 0, 147, 'chr17', 81195210, 7579838, 7579985, 1, '147', '0', '7579838'],
  ],
})

const SPLICED_BLAT_JSON = JSON.stringify({
  fields: JSON.parse(BLAT_JSON).fields,
  blat: [
    // prettier-ignore
    [200, 0, 0, 0, 0, 0, 1, 900, '-', 'mrna', 250, 50, 250, 'chr1', 1000000, 5000, 6100, 2, '100,100', '50,150', '5000,6000'],
  ],
})

const ISPCR_HTML =
  '<PRE>\n&gt;chr9:132576352+132576623 272bp GTGACGTCG CCTAGGTTG\nACGT\n</PRE>'

const blatHit = (json: string) => pslToFeatures(parseBlatResponse(json))[0]!

test('a BLAT hit row carries identity and how much of the query aligned', () => {
  const { feature, ...row } = hitRow(blatHit(BLAT_JSON))
  expect(row).toEqual({
    id: feature.uniqueId,
    position: 'chr17:7,579,839-7,579,985 (+)',
    size: 147,
    identity: 98.7,
    coverage: 100,
    alignment: 'query bases 1-147 of 147 bp',
  })
})

test('a hit split into blocks says so, with the genome span they cover', () => {
  const row = hitRow(blatHit(SPLICED_BLAT_JSON))
  expect(row.position).toBe('chr1:5,001-6,100 (-)')
  expect(row.alignment).toBe(
    'query bases 51-250 of 250 bp, in 2 blocks spanning 1,100 bp',
  )
})

// hgPcr products carry no identity or coverage, so a row written for BLAT
// would show blanks here
test('an in-silico PCR product row is its position and size', () => {
  const row = hitRow(parseIsPcrResponse(ISPCR_HTML)[0]!)
  expect(row.position).toBe('chr9:132,576,352-132,576,623 (+)')
  expect(row.size).toBe(272)
  expect(row.identity).toBeUndefined()
  expect(row.coverage).toBeUndefined()
})

test('the search rows name the primers of a PCR and the length of a BLAT query', () => {
  expect(searchFields(parseIsPcrResponse(ISPCR_HTML)[0])).toEqual({
    'Forward primer': 'GTGACGTCG',
    'Reverse primer': 'CCTAGGTTG',
    'Query length': undefined,
  })
  expect(searchFields(blatHit(BLAT_JSON))['Query length']).toBe('147 bp')
})
