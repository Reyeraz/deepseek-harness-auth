/**
 * The login / registration window: a controlled Modal on the frame-wide
 * shell.overlay layer with login/register tabs, client-side validation,
 * busy/error states, and a profile view once signed in.
 */
import {
  Button, IconUserOutline16, IconWarningOutline16, Input, Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the ui-layout SlotMap merge ('shell.overlay').
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { AuthApi } from './api.ts'
import type { AuthStore } from './authStore.ts'

export interface AuthModalInjected {
  api: AuthApi
}

export type AuthModalProps =
  PropsRuntime<'shell.overlay'> & PropsStore<AuthStore> & InjectFace<AuthModalInjected> & PropsLocale<'auth'>

const USERNAME_RE = /^[\w.-]{3,64}$/u

export function AuthModal({ useStore, actions, api, t }: AuthModalProps) {
  const open = useStore(state => state.open)
  const tab = useStore(state => state.tab)
  const busy = useStore(state => state.busy)
  const error = useStore(state => state.error)
  const notice = useStore(state => state.notice)
  const user = useStore(state => state.user)
  const username = useStore(state => state.username)
  const password = useStore(state => state.password)
  const confirm = useStore(state => state.confirm)
  const displayName = useStore(state => state.displayName)

  if (!open) return null

  const submit = async (): Promise<void> => {
    if (busy || user !== null) return
    if (tab === 'login') {
      if (username === '' || password === '') {
        actions.setError(t('error.required'))
        return
      }
    } else {
      if (username === '' || password === '' || confirm === '') {
        actions.setError(t('error.required'))
        return
      }
      if (!USERNAME_RE.test(username.trim())) {
        actions.setError(t('error.usernameFormat'))
        return
      }
      if (password.length < 6) {
        actions.setError(t('error.passwordMin'))
        return
      }
      if (password !== confirm) {
        actions.setError(t('error.confirmMismatch'))
        return
      }
    }
    actions.setBusy(true)
    actions.setError(null)
    try {
      if (tab === 'login') {
        const signedIn = await api.login(username.trim(), password)
        actions.setUser(signedIn)
        actions.resetForm()
        actions.close()
      } else {
        await api.register(username.trim(), password, displayName.trim())
        actions.switchTab('login')
        actions.setNotice(t('notice.registered'))
        actions.setField('password', '')
        actions.setField('confirm', '')
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : ''
      const friendly = message === '' || message === 'network' || message === 'request-failed'
        ? t('error.generic')
        : message
      actions.setError(friendly)
    } finally {
      actions.setBusy(false)
    }
  }

  const signOut = async (): Promise<void> => {
    actions.setBusy(true)
    try {
      await api.logout()
    } catch {
      // Local sign-out must still succeed even if the server is unreachable.
    }
    actions.setUser(null)
    actions.resetForm()
    actions.close()
    actions.setBusy(false)
  }

  const title = user !== null
    ? t('modal.title.profile')
    : tab === 'login' ? t('modal.title.login') : t('modal.title.register')

  const body = user !== null ? (
    <div data-dsh-auth-profile>
      <span data-dsh-auth-profile-avatar><IconUserOutline16 size={22} /></span>
      <span data-dsh-auth-profile-name>{user.displayName}</span>
      <span data-dsh-auth-profile-user>{user.username}</span>
    </div>
  ) : (
    <>
      <div data-dsh-auth-tabs role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'login'}
          data-dsh-auth-tab
          data-active={tab === 'login' ? '' : undefined}
          onClick={() => { actions.switchTab('login') }}
        >
          {t('tab.login')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'register'}
          data-dsh-auth-tab
          data-active={tab === 'register' ? '' : undefined}
          onClick={() => { actions.switchTab('register') }}
        >
          {t('tab.register')}
        </button>
      </div>
      <div data-dsh-auth-field>
        <label data-dsh-auth-field-label htmlFor="dsh-auth-username">{t('field.username')}</label>
        <Input
          id="dsh-auth-username"
          icon={<IconUserOutline16 size={14} />}
          placeholder={t('placeholder.username')}
          autoComplete="username"
          value={username}
          disabled={busy}
          onChange={event => { actions.setField('username', event.target.value) }}
        />
      </div>
      <div data-dsh-auth-field>
        <label data-dsh-auth-field-label htmlFor="dsh-auth-password">{t('field.password')}</label>
        <Input
          id="dsh-auth-password"
          type="password"
          placeholder={t('placeholder.password')}
          autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
          value={password}
          disabled={busy}
          onChange={event => { actions.setField('password', event.target.value) }}
          onKeyDown={event => { if (event.key === 'Enter') void submit() }}
        />
      </div>
      {tab === 'register' && (
        <>
          <div data-dsh-auth-field>
            <label data-dsh-auth-field-label htmlFor="dsh-auth-confirm">{t('field.confirm')}</label>
            <Input
              id="dsh-auth-confirm"
              type="password"
              placeholder={t('placeholder.confirm')}
              autoComplete="new-password"
              value={confirm}
              disabled={busy}
              onChange={event => { actions.setField('confirm', event.target.value) }}
              onKeyDown={event => { if (event.key === 'Enter') void submit() }}
            />
          </div>
          <div data-dsh-auth-field>
            <label data-dsh-auth-field-label htmlFor="dsh-auth-display">{t('field.displayName')}</label>
            <Input
              id="dsh-auth-display"
              placeholder={t('placeholder.displayName')}
              autoComplete="name"
              value={displayName}
              disabled={busy}
              onChange={event => { actions.setField('displayName', event.target.value) }}
            />
          </div>
        </>
      )}
      {error !== null && (
        <div data-dsh-auth-error role="alert">
          <IconWarningOutline16 size={14} />
          <span>{error}</span>
        </div>
      )}
      {notice !== null && <div data-dsh-auth-notice>{notice}</div>}
    </>
  )

  const footer = user !== null ? (
    <Button variant="outline" data-dsh-auth-logout disabled={busy} onClick={() => { void signOut() }}>
      {t('action.logout')}
    </Button>
  ) : (
    <>
      <Button variant="ghost" onClick={() => { actions.close() }}>{t('action.cancel')}</Button>
      <Button variant="primary" data-dsh-auth-submit disabled={busy} onClick={() => { void submit() }}>
        {tab === 'login' ? t('action.login') : t('action.register')}
      </Button>
    </>
  )

  return (
    <Modal
      open
      title={title}
      closeLabel={t('action.cancel')}
      description={user === null ? t('modal.description') : undefined}
      onClose={() => { actions.close() }}
      footer={footer}
    >
      {body}
    </Modal>
  )
}
