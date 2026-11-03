import PluginManager from '@jbrowse/core/PluginManager'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { addBlatMenuItems } from './launchBlat.ts'

import type { MenuItem } from '@jbrowse/core/ui'

interface FakeDisplay {
  contextMenuFeature?: SimpleFeature
  session: { queueDialog: (build: (close: () => void) => unknown[]) => void }
  view: { assemblyNames: string[] }
}

// The read's Launch items, as the callback BLAT hands addDisplayMenuItems
// computes them; the alignments display that would call it lives in
// jbrowse-components, outside what this package can build against
const registered = vi.hoisted(() => ({
  readItems: undefined as
    ((self: FakeDisplay) => MenuItem[] | undefined) | undefined,
}))

vi.mock('@jbrowse/core/pluggableElementTypes', async importOriginal => ({
  ...(await importOriginal<
    typeof import('@jbrowse/core/pluggableElementTypes')
  >()),
  addViewMenuItems: () => {},
  addDisplayMenuItems: (
    _pluginManager: unknown,
    _displayType: string,
    { items }: { items: (self: FakeDisplay) => MenuItem[] | undefined },
  ) => {
    registered.readItems = items
  },
}))

vi.mock('@jbrowse/core/util', async importOriginal => ({
  ...(await importOriginal<typeof import('@jbrowse/core/util')>()),
  getSession: (self: FakeDisplay) => self.session,
  getContainingView: (self: FakeDisplay) => self.view,
}))

const LEFT_CLIP = 'C'.repeat(25)
const ALIGNED = 'A'.repeat(50)

function readFeature(fields: Record<string, unknown>) {
  return new SimpleFeature({
    uniqueId: 'read1',
    refName: 'ctgA',
    start: 100,
    end: 150,
    name: 'read1',
    ...fields,
  })
}

function display(feature?: SimpleFeature) {
  const dialogs: unknown[] = []
  const self: FakeDisplay = {
    contextMenuFeature: feature,
    session: {
      queueDialog: build => {
        dialogs.push(build(() => {})[1])
      },
    },
    view: { assemblyNames: ['volvox'] },
  }
  addBlatMenuItems(new PluginManager())
  return { items: registered.readItems!(self) ?? [], dialogs }
}

function item(items: MenuItem[], label: string) {
  return items.find(i => 'label' in i && i.label === label)
}

function click(items: MenuItem[], label: string) {
  const found = item(items, label)
  if (found && 'onClick' in found) {
    found.onClick()
  } else {
    throw new Error(`no clickable ${label}`)
  }
}

test('a clipped read offers BLAT of the read and of its clips', () => {
  const { items, dialogs } = display(
    readFeature({ seq: LEFT_CLIP + ALIGNED, CIGAR: '25S50M' }),
  )
  expect(item(items, 'BLAT read')).toBeDefined()
  expect(item(items, 'BLAT soft-clipped bases')).toBeDefined()

  click(items, 'BLAT soft-clipped bases')
  expect(dialogs[0]).toMatchObject({
    initialSequence: `>read1_left_clip\n${LEFT_CLIP}`,
    initialAssembly: 'volvox',
  })

  click(items, 'BLAT read')
  expect(dialogs[1]).toMatchObject({
    initialSequence: `>read1\n${LEFT_CLIP}${ALIGNED}`,
  })
})

test('an unclipped read offers only the read', () => {
  const { items } = display(readFeature({ seq: ALIGNED, CIGAR: '50M' }))
  expect(item(items, 'BLAT read')).toBeDefined()
  expect(item(items, 'BLAT soft-clipped bases')).toBeUndefined()
})

// the menu opens on the read id and the feature lands an RPC later, which
// rebuilds the menu; until then there are no bases to search
test('nothing is offered before the read has been fetched', () => {
  expect(display().items).toEqual([])
})

test('a read longer than UCSC takes is shown disabled, saying why', () => {
  const { items } = display(
    readFeature({ seq: 'A'.repeat(30_000), CIGAR: '30000M' }),
  )
  expect(item(items, 'BLAT read')).toMatchObject({
    disabled: true,
    disabledHelpText: expect.stringContaining('25,000 bp per sequence'),
  })
})
