/**
 * Sidebar footer action: opens the auth modal. Shows a sign-in entry when
 * logged out and the signed-in user name when logged in; the modal body
 * switches to the profile view in that case.
 */
import { IconUserOutline16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the ui-sidebar SlotMap merge ('sidebar.footer.action').
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { AuthStore } from './authStore.ts'

export type AuthTriggerProps =
  PropsRuntime<'sidebar.footer.action'> & PropsStore<AuthStore> & PropsLocale<'auth'>

export function AuthTrigger({ wide, useStore, actions, t }: AuthTriggerProps) {
  const user = useStore(state => state.user)
  const busy = useStore(state => state.busy)
  const label = user === null ? t('trigger.loggedOut') : user.displayName
  const tooltip = user === null ? t('trigger.open') : t('trigger.loggedIn')

  const trigger = (
    <button
      type="button"
      className={wide ? undefined : 'dsh-auth-rail'}
      data-dsh-auth-trigger
      aria-label={tooltip}
      disabled={busy}
      onClick={() => { actions.open('login') }}
    >
      <IconUserOutline16 size={16} />
      {wide && <span data-dsh-auth-trigger-label>{label}</span>}
    </button>
  )

  return wide
    ? trigger
    : <Tooltip label={tooltip} side="right" delayMs={500}>{trigger}</Tooltip>
}
