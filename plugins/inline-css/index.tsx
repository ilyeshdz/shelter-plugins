import Editor from './components/Editor.jsx'

const {
  settings: {
    registerSection,
  },
  plugin: {
    store
  }
} = shelter

// Create style element to contain the CSS
let inlineStyleElm: HTMLStyleElement | null = null
const inlineStyle = document.createElement('style')
inlineStyle.id = 'inline-css-output'
inlineStyleElm = document.body.appendChild(inlineStyle)

// Set the initial contents of the inline CSS
inlineStyleElm.textContent = store.inlineCss

const unload = registerSection('section', 'inline-css', 'CSS Editor', () => Editor({ styleElm: inlineStyleElm }))

export const onUnload = () => {
  unload()

  if (inlineStyleElm) {
    inlineStyleElm.remove()
  }
}