/**
 * The login / registration window: a controlled headless Modal on the
 * frame-wide shell.overlay layer with login/register tabs, client-side
 * validation, busy/error states, and a signed-in profile view that carries
 * the admin account-management section. While signed out the dialog cannot
 * be dismissed (no close button; Escape and mask clicks are ignored), which
 * enforces login before the rest of the app can be used.
 */
import {
  Button, IconCloseOutline16, IconUserOutline16, IconWarningOutline16, Input, Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { useEffect, useState } from 'react'
// Type-only: pulls the ui-layout SlotMap merge ('shell.overlay').
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { AccountManagement } from './AccountManagement.tsx'
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
  // Null while unknown: the modal stays permissive until meta answers.
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void api.meta().then(
      meta => { if (!cancelled) setRegistrationOpen(meta.registrationOpen !== false) },
      () => { if (!cancelled) setRegistrationOpen(true) },
    )
    return () => { cancelled = true }
  }, [open, api, user?.username])

  if (!open) return null

  const registrationDisabled = registrationOpen === false
  const signedIn = user !== null
  // While signed out the dialog is the app's front door: it cannot be closed.
  const close = (): void => { if (signedIn) actions.close() }

  const submit = async (): Promise<void> => {
    if (busy || signedIn) return
    if (tab === 'register' && registrationDisabled) {
      actions.setError(t('modal.registerClosed'))
      return
    }
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
        const signedInUser = await api.login(username.trim(), password)
        actions.setUser(signedInUser)
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
    // Forced login: the dialog stays open on the login tab.
    actions.setUser(null)
    actions.resetForm()
    actions.switchTab('login')
    actions.setNotice(null)
    actions.setBusy(false)
  }

  const title = signedIn
    ? t('modal.title.profile')
    : tab === 'login' ? t('modal.title.login') : t('modal.title.register')

  const body = signedIn ? (
    <>
      <div data-dsh-auth-profile>
        <span data-dsh-auth-profile-avatar><IconUserOutline16 size={22} /></span>
        <span data-dsh-auth-profile-name>{user.displayName}</span>
        <span data-dsh-auth-profile-user>{user.username}</span>
      </div>
      {user.role === 'admin' && <AccountManagement api={api} t={t} />}
    </>
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
          disabled={registrationDisabled}
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
      {registrationDisabled && tab === 'login' && (
        <div data-dsh-auth-notice>{t('modal.registerClosed')}</div>
      )}
    </>
  )

  const footer = signedIn ? (
    <Button variant="outline" data-dsh-auth-logout disabled={busy} onClick={() => { void signOut() }}>
      {t('action.logout')}
    </Button>
  ) : (
    <Button variant="primary" data-dsh-auth-submit disabled={busy} onClick={() => { void submit() }}>
      {tab === 'login' ? t('action.login') : t('action.register')}
    </Button>
  )

  return (
    <Modal
      open
      headless
      title={title}
      closeLabel={t('action.cancel')}
      onClose={close}
      className="dsh-auth-dialog"
    >
      <div data-dsh-auth-dialog>
        <div data-dsh-auth-dialog-head>
          <h2 data-dsh-auth-dialog-title>{title}</h2>
          {signedIn && (
            <button
              type="button"
              data-dsh-auth-dialog-close
              aria-label={t('action.cancel')}
              onClick={close}
            >
              <IconCloseOutline16 size={14} />
            </button>
          )}
        </div>
        {!signedIn && <p data-dsh-auth-dialog-desc>{t('modal.description')}</p>}
        <div data-dsh-auth-dialog-body>{body}</div>
        <div data-dsh-auth-dialog-foot>{footer}</div>
      </div>
    </Modal>
  )
}
