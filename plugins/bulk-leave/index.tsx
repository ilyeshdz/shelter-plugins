import { BulkLeave } from './components/BulkLeave.jsx'

const {
  settings: {
    registerSection,
  },
  plugin: {
    store,
  },
  ui: {
    Slider,
    Text,
  },
} = shelter

if (store.delay === undefined) {
  store.delay = 5000
}

const unload = registerSection('section', 'bulk-leave', 'Bulk Leave', BulkLeave)

export const settings = () => (
  <>
    <Text>Configure the delay between each server leave request.</Text>
    <br />
    <Slider
      min={1000}
      max={10000}
      step={500}
      value={store.delay as number}
      onInput={(v) => {
        store.delay = v
      }}
    />
    <Text style={{ fontSize: '12px', opacity: 0.7 }}>
      Current: {store.delay}ms per server
    </Text>
  </>
)

export const onUnload = () => {
  unload()
  cleanupCss()
}