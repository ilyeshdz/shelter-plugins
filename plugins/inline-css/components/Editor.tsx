import loader from '@monaco-editor/loader'

import {css, classes} from './Editor.scss'
import { debounce } from '../../../util/debounce.js'
import { Popout } from './Popout.jsx'
import { Window } from './Window.jsx'

interface Props {
  styleElm?: HTMLStyleElement
  popout?: boolean
}

const {
  ui: {
    injectCss,
    Header,
    HeaderTags,
    Button,
    CheckboxItem
  },
  plugin: { store },
  solid: { createSignal, onMount, onCleanup },
  flux: {
    dispatcher
  }
} = shelter

const saveCss = debounce((css: string, styleElm: HTMLStyleElement) => {
  store.inlineCss = css

  if (styleElm) {
    styleElm.textContent = css
  }
}, 500)

let injectedCss = false

export default function (props: Props) {
  // eslint-disable-next-line prefer-const
  let ref: HTMLDivElement | undefined = null
  let editorInstance: any = null

  if (!injectedCss) {
    injectCss(css)
    injectedCss = true
  }

  const [hotReload, setHotReload] = createSignal(true)

  onMount(() => {
    requestAnimationFrame(() => {
      const container = ref
      if (!container || editorInstance) return

      loader.init().then((monaco) => {
        if (editorInstance) {
          editorInstance.dispose()
        }

        editorInstance = monaco.editor.create(container, {
          value: store.inlineCss || '',
          language: 'css',
          theme: 'vs-dark',
          minimap: { enabled: false },
          fontSize: 14,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          lineNumbers: 'on',
          lineNumbersMinChars: 3,
          lineDecorationsWidth: 5,
          showFoldingControls: 'mouseover',
          glyphMargin: false,
          folding: false,
          wordWrap: 'on'
        })

        editorInstance.onDidChangeModelContent(() => {
          const value = editorInstance.getValue()
          if (hotReload()) {
            saveCss(value, props.styleElm)
          }
        })
      })

      onCleanup(() => {
        if (editorInstance) {
          editorInstance.dispose()
        }
      })
    })
  })

  const setCss = () => {
    if (editorInstance) {
      const value = editorInstance.getValue()
      saveCss(value, props.styleElm)
    }
  }

  return (
    <>
      <Header tag={HeaderTags.H1}>CSS Editor</Header>

      {
        !props.popout && (
          <Button
            class={classes.popout}
            onClick={() => {
              document.body.appendChild(
                Window()
              )

              dispatcher.dispatch({
                type: 'LAYER_POP'
              })
            }}
          >
            Pop Out 
            <Popout />
          </Button>
        )
      }

      <div class={classes.controls}>
        <CheckboxItem
          checked={hotReload()}
          onChange={setHotReload}
        >
          Hot Reload
        </CheckboxItem>

        <Button
          onClick={setCss}
          disabled={hotReload()}
        >
          Save & Apply
        </Button>
      </div>

      <div class={classes.ceditor} ref={ref} data-popout={props.popout ? 'true' : 'false'} />
    </>
  )
}