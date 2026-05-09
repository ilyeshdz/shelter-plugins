import { css, classes } from '../BulkLeave.scss'

const {
  ui: {
    Button,
    ButtonColors,
    ButtonSizes,
    CheckboxItem,
    injectCss,
    showToast,
    ToastColors,
    Header,
    HeaderTags,
    Divider,
    Text,
    TextTags,
    TextWeights,
    niceScrollbarsClass,
    openConfirmationModal,
    tooltip,
  },
  solid: {
    createSignal,
    onMount,
    onCleanup,
  },
  http,
  plugin: {
    store,
  },
  flux: {
    stores: {
      GuildStore,
      UserStore,
    },
  },
} = shelter

interface Guild {
  id: string
  name: string
  icon?: string
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

interface PluginStore {
  delay: number
}

const pluginStore = store as PluginStore

export function BulkLeave() {
  const unloadCss = injectCss(css)
  onCleanup(unloadCss)

  const [guilds, setGuilds] = createSignal<Guild[]>([])
  const [selected, setSelected] = createSignal<Set<string>>(new Set())
  const [loading, setLoading] = createSignal(false)
  const [leaving, setLeaving] = createSignal(false)
  const [progress, setProgress] = createSignal(0)
  const [total, setTotal] = createSignal(0)
  const [error, setError] = createSignal<string | null>(null)
  const [cancelled, setCancelled] = createSignal(false)

  const delay = () => Math.max(0, Math.min(pluginStore.delay ?? 5000, 60_000))

  const cancellableSleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const end = Date.now() + ms
      const iv = setInterval(() => {
        if (cancelled() || Date.now() >= end) {
          clearInterval(iv)
          resolve()
        }
      }, 50)
    })

  onMount(() => {
    loadGuilds()
  })

  const loadGuilds = async () => {
    if (loading() || leaving()) return
    setLoading(true)
    setError(null)
    try {
      const currentUser = UserStore.getCurrentUser()
      const currentUserId = currentUser?.id
      const data = GuildStore.getGuildsArray()
      setGuilds(
        data
          .filter((g) => g.ownerId !== currentUserId)
          .map((g) => ({ id: g.id, name: g.name, icon: g.icon }))
          .sort((a: Guild, b: Guild) => a.name.localeCompare(b.name))
      )
    } catch {
      setError('Failed to load servers.')
    } finally {
      setLoading(false)
    }
  }

  const toggleSelected = (id: string) => {
    const next = new Set(selected())
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const selectAll = () => setSelected(new Set(guilds().map((g) => g.id)))
  const deselectAll = () => setSelected(new Set())

  const leaveSelected = async () => {
    const toLeave = selected()
    if (toLeave.size === 0) {
      showToast({ title: 'Bulk Leave', content: 'No servers selected.', color: ToastColors.WARNING })
      return
    }

    try {
      await openConfirmationModal({
        header: () => 'Leave servers?',
        body: () => (
          <Text tag={TextTags.textMD}>
            You are about to leave <Text tag={TextTags.textMD} weight={TextWeights.bold} style={{ display: 'inline' }}>{toLeave.size} server{toLeave.size !== 1 ? 's' : ''}</Text>. This cannot be undone unless you are re-invited.
          </Text>
        ),
        type: 'danger',
        confirmText: `Leave ${toLeave.size} server${toLeave.size !== 1 ? 's' : ''}`,
        cancelText: 'Cancel',
      })
    } catch {
      return
    }

    setLeaving(true)
    setCancelled(false)
    setProgress(0)
    setTotal(toLeave.size)

    const arr = Array.from(toLeave)
    const failed: string[] = []

    for (let i = 0; i < arr.length; i++) {
      if (cancelled()) break
      try {
        await http.del(`/users/@me/guilds/${arr[i]}`, { body: { lurking: false } })
      } catch (e) {
        console.error(`Failed to leave guild ${arr[i]}`, e)
        failed.push(arr[i])
      }
      setProgress(i + 1)
      if (i < arr.length - 1) await cancellableSleep(delay())
    }

    const wasCancelled = cancelled()
    const processed = progress()
    const succeeded = processed - failed.length

    if (wasCancelled) {
      showToast({
        title: 'Bulk Leave',
        content: `Cancelled. Left ${succeeded} of ${toLeave.size} server${toLeave.size !== 1 ? 's' : ''}${failed.length > 0 ? `. ${failed.length} failed.` : '.'}`,
        color: ToastColors.WARNING,
      })
    } else if (failed.length === 0) {
      showToast({
        title: 'Bulk Leave',
        content: `Left ${toLeave.size} server${toLeave.size > 1 ? 's' : ''}!`,
        color: ToastColors.SUCCESS,
      })
    } else {
      showToast({
        title: 'Bulk Leave',
        content: `Left ${succeeded} of ${toLeave.size} server${toLeave.size !== 1 ? 's' : ''}. ${failed.length} failed.`,
        color: ToastColors.WARNING,
      })
    }

    setLeaving(false)
    setSelected(new Set())
    await sleep(1000)
    await loadGuilds()
  }

  const progressPct = () =>
    total() > 0 ? Math.round((progress() / total()) * 100) : 0

  const allSelected = () =>
    guilds().length > 0 && selected().size === guilds().length

  const renderGuildList = () => {
    const list = guilds()

    if (list.length === 0) return null

    return (
      <div class={`${classes.list} ${niceScrollbarsClass()}`}>
        {list.map((guild) => (
          <CheckboxItem
            checked={selected().has(guild.id)}
            onChange={() => toggleSelected(guild.id)}
            disabled={leaving()}
          >
            <div class={classes.guildItem}>
              {guild.icon ? (
                <img
                  src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=32`}
                  alt=""
                  class={classes.icon}
                />
              ) : (
                <div class={classes.iconPlaceholder}>
                  {guild.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div class={classes.guildMeta}>
                <Text tag={TextTags.textSM} weight={TextWeights.medium}>
                  {guild.name}
                </Text>
              </div>
            </div>
          </CheckboxItem>
        ))}
      </div>
    )
  }

  const renderControls = () => {
    const count = selected().size

    return (
      <div class={classes.controls}>
        <div class={classes.selectionRow}>
          <Text tag={TextTags.textSM} class={classes.mutedText}>
            {count > 0
              ? `${count} of ${guilds().length} selected`
              : `${guilds().length} server${guilds().length !== 1 ? 's' : ''}`}
          </Text>

          <div class={classes.selectionActions}>
            <Button
              size={ButtonSizes.MEDIUM}
              color={ButtonColors.SECONDARY}
              onClick={allSelected() ? deselectAll : selectAll}
              disabled={leaving()}
            >
              {allSelected() ? 'Deselect all' : 'Select all'}
            </Button>
          </div>
        </div>

        <Divider mt="8px" mb="12px" />

        {leaving() ? (
          <div class={classes.progressSection}>
            <div class={classes.progressHeader}>
              <Text tag={TextTags.textSM} weight={TextWeights.medium}>
                Leaving servers…
              </Text>
              <Text tag={TextTags.textSM} class={classes.mutedText}>
                {progress()} / {total()}
              </Text>
            </div>
            <div class={classes.progressTrack}>
              <div
                class={classes.progressFill}
                style={{ width: `${progressPct()}%` }}
              />
            </div>
            <Text tag={TextTags.textXS} class={classes.progressNote}>
              {progressPct()}% complete
            </Text>
            <Button
              color={ButtonColors.SECONDARY}
              size={ButtonSizes.SMALL}
              onClick={() => setCancelled(true)}
              disabled={cancelled()}
            >
              {cancelled() ? 'Cancelling…' : 'Cancel'}
            </Button>
          </div>
        ) : (
          <div
            use:tooltip={count === 0 ? 'Select at least one server first' : undefined}
          >
            <Button
              color={ButtonColors.CRITICAL_PRIMARY}
              size={ButtonSizes.MEDIUM}
              grow
              onClick={leaveSelected}
              disabled={count === 0}
            >
              {count > 0
                ? `Leave ${count} server${count !== 1 ? 's' : ''}`
                : 'Select servers to leave'}
            </Button>
          </div>
        )}
      </div>
    )
  }

  const renderBody = () => {
    if (loading()) {
      return (
        <div class={classes.centerState}>
          <Text tag={TextTags.textSM} class={classes.mutedText}>
            Loading servers…
          </Text>
        </div>
      )
    }

    if (error()) {
      return (
        <div class={classes.errorState}>
          <Text tag={TextTags.textSM} class={classes.dangerText}>
            {error()}
          </Text>
          <Button
            color={ButtonColors.PRIMARY}
            size={ButtonSizes.SMALL}
            onClick={loadGuilds}
          >
            Try again
          </Button>
        </div>
      )
    }

    if (guilds().length === 0) {
      return (
        <div class={classes.centerState}>
          <Text tag={TextTags.textSM} class={classes.mutedText}>
            You're not a member of any servers, or you own all of them.
          </Text>
        </div>
      )
    }

    return (
      <>
        {renderGuildList()}
        <Divider mt="12px" mb="12px" />
        {renderControls()}
      </>
    )
  }

  return (
    <div class={classes.root}>
      <div class={classes.headerRow}>
        <Header tag={HeaderTags.H2} margin={false}>
          Bulk Leave
        </Header>

        <Button
          color={ButtonColors.SECONDARY}
          size={ButtonSizes.SMALL}
          onClick={loadGuilds}
          disabled={loading() || leaving()}
          use:tooltip="Refresh server list"
        >
          {loading() ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      <Divider mt="8px" mb="12px" />

      {renderBody()}
    </div>
  )
}