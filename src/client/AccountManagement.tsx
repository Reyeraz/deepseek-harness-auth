/**
 * Account management rendered inside the signed-in profile view of the auth
 * modal (admin role only): registration on/off switch, the account list, and
 * deleting regular accounts. Proxy mode hides the controls (the external
 * service owns account management).
 */
import { useEffect, useState } from 'react'
import { IconWarningOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { AuthApi } from './api.ts'
import type { AuthUser } from './authStore.ts'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'

export interface AccountManagementProps {
  api: AuthApi
  t: TranslateNS<'auth'>
}

export function AccountManagement({ api, t }: AccountManagementProps) {
  const [mode, setMode] = useState<'demo' | 'proxy' | null>(null)
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null)
  const [users, setUsers] = useState<AuthUser[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => { void load() }, [])

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
      {mode === 'proxy' ? null : (
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
