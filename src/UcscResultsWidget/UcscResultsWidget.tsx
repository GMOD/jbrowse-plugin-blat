import { BaseCard } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import Attributes from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Attributes'
import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import { getSession, measureGridWidth } from '@jbrowse/core/util'
import { Link, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import { navToFeature } from '../ucscShared.ts'
import { groupHitsByQuery } from './groupHits.ts'
import { bp, hitRow, searchFields } from './hitRows.ts'

import type { UcscHost } from '../ucscShared.ts'
import type { HitRow } from './hitRows.ts'
import type { UcscResultsWidgetModel } from './stateModel.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { GridColDef } from '@mui/x-data-grid'

function plural(count: number, noun: string) {
  return `${count} ${count === 1 ? noun : `${noun}s`}`
}

function percent(value: number | undefined) {
  return value === undefined ? '' : `${value}%`
}

// a header also holds its sort arrow, which a cell does not
function columnWidth(values: string[], header: string) {
  return Math.max(
    measureGridWidth(values, { minWidth: 50 }),
    measureGridWidth([header], { minWidth: 50, padding: 40 }),
  )
}

function hitColumns(
  rows: HitRow[],
  resultNoun: string,
  goTo: (feature: SimpleFeatureSerialized) => void,
) {
  const position: GridColDef<HitRow> = {
    field: 'position',
    headerName: 'Position',
    flex: 1,
    minWidth: 120,
    renderCell: ({ row }) => (
      <Link
        href="#"
        title={row.position}
        sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
        onClick={event => {
          event.preventDefault()
          goTo(row.feature)
        }}
      >
        {row.position}
      </Link>
    ),
  }
  const size: GridColDef<HitRow> = {
    field: 'size',
    headerName: 'Size',
    type: 'number',
    width: columnWidth(
      rows.map(r => bp(r.size)),
      'Size',
    ),
    valueFormatter: (value: number) => bp(value),
  }
  const identity: GridColDef<HitRow> = {
    field: 'identity',
    headerName: 'Identity',
    description: 'Matching bases over aligned bases',
    type: 'number',
    width: columnWidth(['100%'], 'Identity'),
    valueFormatter: percent,
  }
  const coverage: GridColDef<HitRow> = {
    field: 'coverage',
    headerName: 'Query',
    description:
      'Share of the query in the alignment. Hover a value for which bases',
    type: 'number',
    width: columnWidth(['100%'], 'Query'),
    renderCell: ({ row }) => (
      <span title={row.alignment}>{percent(row.coverage)}</span>
    ),
  }
  return resultNoun === 'product'
    ? [position, size]
    : [position, identity, coverage]
}

const HitGrid = observer(function HitGrid({
  session,
  assembly,
  hits,
  resultNoun,
}: {
  session: UcscHost
  assembly: string
  hits: SimpleFeatureSerialized[]
  resultNoun: string
}) {
  const rows = hits.map(hitRow)
  return rows.length ? (
    <DataGridFlexContainer>
      <DataGrid
        disableRowSelectionOnClick
        disableColumnMenu
        rows={rows}
        rowHeight={25}
        columnHeaderHeight={35}
        hideFooter={rows.length < 25}
        columns={hitColumns(rows, resultNoun, feature => {
          void navToFeature(session, assembly, feature)
        })}
      />
    </DataGridFlexContainer>
  ) : (
    <Typography variant="body2" color="textSecondary">
      {`No ${resultNoun}s for this sequence`}
    </Typography>
  )
})

// The hit list for a BLAT / in-silico PCR query. The query deliberately does not
// navigate (see addResultTrack), so this is where the results become reachable:
// every hit's position is a link that takes the open view there, listed
// best-first, and going to one is a click rather than a re-run. The search is
// a record in the feature details panel's label column; the hits are a grid,
// because the point of reading them is comparing one against the next.
const UcscResultsWidget = observer(function UcscResultsWidget({
  model,
}: {
  model: UcscResultsWidgetModel
}) {
  const { features, assembly, trackName, resultNoun, queries } = model
  const session = getSession(model)
  const groups = groupHitsByQuery(features, queries)
  const { 'Query length': queryLength, ...primers } = searchFields(features[0])
  return (
    <div>
      <BaseCard title="Search">
        <Attributes
          attributes={{
            Assembly: assembly,
            Track: trackName,
            [resultNoun === 'product' ? 'Products' : 'Hits']: features.length,
            ...primers,
            'Query length': groups.length > 1 ? undefined : queryLength,
          }}
        />
        {resultNoun === 'product' && features.length > 1 ? (
          // The reason a bench scientist runs this at all: a second product is a
          // second band, and two of similar size will not resolve. The sizes are
          // on the rows below, so this only has to say to go and read them.
          <Typography variant="body2" color="warning.main" sx={{ mt: 2 }}>
            These primers amplify more than once, so expect a band per product.
          </Typography>
        ) : null}
      </BaseCard>
      {groups.length > 1 ? (
        groups.map(({ query, hits }) => (
          <BaseCard
            key={query}
            title={`${query} (${hits.length ? plural(hits.length, resultNoun) : `no ${resultNoun}s`})`}
          >
            <HitGrid
              session={session}
              assembly={assembly}
              hits={hits}
              resultNoun={resultNoun}
            />
          </BaseCard>
        ))
      ) : (
        <BaseCard title={resultNoun === 'product' ? 'Products' : 'Hits'}>
          <HitGrid
            session={session}
            assembly={assembly}
            hits={features}
            resultNoun={resultNoun}
          />
        </BaseCard>
      )}
    </div>
  )
})

export default UcscResultsWidget
