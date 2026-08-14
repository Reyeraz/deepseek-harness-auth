/**
 * General-settings row: account management for the demo store. Shows a sign-in
 * prompt for non-admins; for an admin it lists every account, toggles
 * demo-mode registration on/off, and deletes non-admin accounts. Hidden
 * controls in proxy mode (the external service owns account management).
 */
import { useEffect, useState } from 'react'
import { IconWarningOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the settings SlotMap merge ('settings.general.item').
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { AuthApi } from './api.ts'
import type { AuthUser, AuthStore } from './authStore.ts'
import type { AuthModalInjected } from './AuthModal.tsx'

export type AccountManagementRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsStore<AuthStore>
  & InjectFace<AuthModalInjected>
  & PropsLocale<'auth'>

export function AccountManagementRow({ useStore, actions, api, t }: AccountManagementRowProps) {
  const user = useStore(state => state.user)
  const [mode, setMode] = useState<'demo' | 'proxy' | null>(null)
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null)
  const [users, setUsers] = useState<AuthUser[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = user?.role === 'admin'

  const load = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const meta = await api.meta()
      setMode(meta.mode)
      if (meta.mode === 'demo') {
        const snapshot = await api.adminUsers()
        setUsers(snapshot.users)
        setRegistrationOpen(snapshot.registrationOpen)
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : ''
      setError(message === '' || message === 'network' || message === 'request-failed'
        ? t('error.generic')
        : message)
    } finally {
      setBusy(false)
    }
  }

  // Reload whenever the signed-in user changes (login/logout/role change).
  useEffect(() => { void load() }, [user?.username, user?.role])

  const toggleRegistration = async (): Promise<void> => {
    if (registrationOpen === null) return
    setBusy(true)
    setError(null)
    try {
      await api.setRegistration(!registrationOpen)
      setRegistrationOpen(!registrationOpen)
    } catch (toggleError) {
      const message = toggleError instanceof Error ? toggleError.message : ''
      setError(message === '' || message === 'network' || message === 'request-failed'
        ? t('error.generic')
        : message)
    } finally {
      setBusy(false)
    }
  }

  const removeUser = async (username: string): Promise<void> => {
    if (!window.confirm(`确定删除账号 ${username} 吗？`)) return
    setBusy(true)
    setError(null)
    try {
      await api.deleteUser(username)
      setUsers(previous => previous.filter(account => account.username !== username))
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : ''
      setError(message === '' || message === 'network' || message === 'request-failed'
        ? t('error.generic')
        : message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-dsh-auth-settings>
      <div data-dsh-auth-settings-head>
        <div data-dsh-auth-settings-title>{t('settings.account.title')}</div>
        <div data-dsh-auth-settings-desc>
          {mode === 'proxy' ? t('settings.account.proxyDesc') : t('settings.account.desc')}
        </div>
      </div>
      {error !== null && (
        <div data-dsh-auth-error role="alert">
          <IconWarningOutline16 size={14} />
          <span>{error}</span>
        </div>
      )}
      {!isAdmin ? (
        <div data-dsh-auth-settings-actions>
          <span>{t('settings.account.loginPrompt')}</span>
          <button
            type="button"
            data-dsh-auth-settings-login
            onClick={() => { actions.open('login') }}
          >
            {t('settings.account.openLogin')}
          </button>
        </div>
      ) : mode === 'proxy' ? null : (
        <>
          <div data-dsh-auth-registration>
            <div>
              <div data-dsh-auth-settings-label>{t('settings.registration.title')}</div>
              <div data-dsh-auth-settings-desc>{t('settings.registration.desc')}</div>
            </div>
            <button
              type="button"
              data-dsh-auth-registration-toggle
              data-open={registrationOpen === true ? '' : undefined}
              disabled={busy || registrationOpen === null}
              onClick={() => { void toggleRegistration() }}
            >
              {registrationOpen === null ? '…' : registrationOpen === true
                ? t('settings.registration.open')
                : t('settings.registration.closed')}
            </button>
          </div>
          <div data-dsh-auth-users-head>
            <span data-dsh-auth-settings-label>{t('settings.users.title')}</span>
            <button
              type="button"
              data-dsh-auth-refresh
              disabled={busy}
              onClick={() => { void load() }}
            >
              {t('settings.refresh')}
            </button>
          </div>
          {users.length === 0 ? (
            <div data-dsh-auth-settings-desc>{t('settings.users.empty')}</div>
          ) : (
            <ul data-dsh-auth-users>
              {users.map(account => (
                <li key={account.username} data-dsh-auth-user>
                  <span data-dsh-auth-user-name>
                    {account.displayName}
                    <span data-dsh-auth-user-id>{account.username}</span>
                  </span>
                  <span data-dsh-auth-user-role>
                    {account.role === 'admin' ? t('settings.role.admin') : t('settings.role.user')}
                  </span>
                  {account.role !== 'admin' && (
                    <button
                      type="button"
                      data-dsh-auth-user-delete
                      disabled={busy}
                      onClick={() => { void removeUser(account.username) }}
                    >
                      {t('settings.user.delete')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
