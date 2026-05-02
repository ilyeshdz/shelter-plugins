import { css, classes } from './index.scss'

const {
  ui: {
    SwitchItem,
    LinkButton,
    injectCss,
    showToast
  },
  plugin: {
    store
  }
} = shelter

const DATA_URL = 'https://userpfp.github.io/UserPFP/source/data.json'

declare global {
  interface Window {
    userpfp: {
      avatars: Record<string, string>
      getUrl: (id: string) => string
    }
  }
}

let injectedCss = false

if (!injectedCss) {
  injectedCss = true
  injectCss(css)
}

const replaceAvatar = (img: HTMLImageElement) => {
  const src = img.src
  if (!src.includes('cdn.discordapp.com/avatars')) return

  const match = src.match(/\/avatars\/(\d+)/)
  if (!match) return

  const userId = match[1]
  const customUrl = window.userpfp?.getUrl(userId)

  if (customUrl && img.src !== customUrl) {
    img.src = customUrl
  }
}

const processImages = () => {
  const images = document.querySelectorAll('img[src*="cdn.discordapp.com/avatars"]')
  images.forEach((img) => replaceAvatar(img as HTMLImageElement))
}

export const settings = () => (
  <>
    <LinkButton
      href='https://userpfp.github.io/UserPFP/#how-to-request-a-profile-picture-pfp'
      class={classes.submit}
    >
      Submit your PFP here!
    </LinkButton>

    <SwitchItem
      value={store.preferNitro}
      onChange={(v) => (store.preferNitro = v)}
      tooltip="If the user has Nitro but also has a custom UserPFP, prefer the Nitro one."
    >
      Prefer Nitro
    </SwitchItem>
  </>
)

export const onLoad = async () => {
  try {
    const resp = await fetch(DATA_URL)
    window.userpfp = await resp.json()
    window.userpfp.getUrl = (id: string) => window.userpfp.avatars[id] ?? null

    processImages()

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLImageElement) {
            replaceAvatar(node)
          }
          if (node instanceof Element) {
            node.querySelectorAll('img[src*="cdn.discordapp.com/avatars"]').forEach((img) => {
              replaceAvatar(img as HTMLImageElement)
            })
          }
        }
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    showToast('UserPFP loaded!')
  } catch (e) {
    console.error('[UserPFP] Failed to load:', e)
    showToast('UserPFP failed to load')
  }
}