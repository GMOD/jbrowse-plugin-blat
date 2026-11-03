import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { types } from '@jbrowse/mobx-state-tree'
import { linearGenomeViewStateModelFactory } from '@jbrowse/plugin-linear-genome-view'

import { addBlatMenuItems } from './launchBlat.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// The view type registered the way a host registers it, since a view menu
// contribution extends the registered type, not a model built from the factory
function createView() {
  const pluginManager = new PluginManager()
  addBlatMenuItems(pluginManager)
  pluginManager.addViewType(
    () =>
      new ViewType({
        name: 'LinearGenomeView',
        stateModel: linearGenomeViewStateModelFactory(pluginManager),
        ReactComponent: () => null,
      }),
  )
  pluginManager.createPluggableElements()
  const assembly = { initialized: true, regions: [] }
  const { view } = types
    .model({
      view: pluginManager.getViewType('LinearGenomeView').stateModel,
      configuration: types.frozen({}),
    })
    .volatile(() => ({
      rpcManager: {},
      assemblyManager: {
        get: () => assembly,
        waitForAssembly: () => Promise.resolve(assembly),
      },
    }))
    .create({ view: { type: 'LinearGenomeView' } }, { pluginManager })
  view.setWidth(800)
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10_000_000, refName: 'ctgA' },
  ])
  return view
}

function blatSelection(items: MenuItem[]) {
  return items.find(item => 'label' in item && item.label === 'BLAT selection')
}

test('a rubberband selection offers BLAT, disabled past the UCSC limit', () => {
  const view = createView()
  view.zoomTo(10)
  view.setOffsets(view.pxToBp(100), view.pxToBp(200))
  expect(blatSelection(view.rubberBandLaunchMenuItems())).toMatchObject({
    disabled: false,
  })

  view.zoomTo(100)
  view.setOffsets(view.pxToBp(100), view.pxToBp(600))
  expect(blatSelection(view.rubberBandLaunchMenuItems())).toMatchObject({
    disabled: true,
    disabledHelpText: expect.stringContaining('25,000 bp per sequence'),
  })
})
