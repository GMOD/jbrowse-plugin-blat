import createFetchMock from 'vitest-fetch-mock'

// the dialogs' fetch is the network boundary every query crosses, so tests
// script its answers through the global `fetchMock`
const fetchMock = createFetchMock(vi)
fetchMock.enableMocks()

declare global {
  var fetchMock: ReturnType<typeof createFetchMock>
}
globalThis.fetchMock = fetchMock
