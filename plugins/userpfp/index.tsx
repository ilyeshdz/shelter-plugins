import { createApi, webpackChunk } from '@cumjar/websmack'
import { after } from 'spitroast'
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

const chunk = webpackChunk()
const wp = chunk && createApi([undefined, ...chunk])

console.log('[UserPFP] webpackChunk:', !!chunk)
console.log('[UserPFP] wp:', !!wp)

// Try findByCode first (more reliable)
const c = wp?.findByCode('getUserAvatarURL')
console.log('[UserPFP] findByCode result:', c)

if (c) {
  after('getUserAvatarURL', c, (args, response) => {
    const customUrl = window.userpfp?.getUrl(args[0])
    console.log('[UserPFP] getUserAvatarURL called', args[0], 'customUrl:', customUrl, 'response:', response)
    return store.preferNitro && response?.includes('a_') ? response : customUrl ?? response
  })
} else {
  // Fallback to findByPropsAll
  const c2 = wp?.findByPropsAll('getUserAvatarURL')
  console.log('[UserPFP] findByPropsAll result:', c2)
  for (const m of c2 || []) {
    after('getUserAvatarURL', m, (args, response) => {
      const customUrl = window.userpfp?.getUrl(args[0])
      console.log('[UserPFP] getUserAvatarURL called', args[0], 'customUrl:', customUrl, 'response:', response)
      return store.preferNitro && response?.includes('a_') ? response : customUrl ?? response
    })
  }
}

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
    console.log('[UserPFP] Loaded', Object.keys(window.userpfp.avatars || {}).length, 'avatars')
    showToast('UserPFP loaded!')
  } catch (e) {
    console.error('[UserPFP] Failed to load:', e)
    showToast('UserPFP failed to load')
  }
}