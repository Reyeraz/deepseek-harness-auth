/**
 * Auth UI store: modal open state, active tab, form drafts, busy/error
 * flags, and the signed-in user. One handle is shared by the sidebar trigger
 * and the overlay modal (created in apply, passed as `store:` to both
 * registrations), so both entries read and write the same instance.
 */
import { defineStore } from '@deepseek-ai/dsh-client-runtime/client'

export interface AuthUser {
  username: string
  displayName: string
  role: 'user' | 'admin'
}

export interface AuthState {
  open: boolean
  tab: 'login' | 'register'
  busy: boolean
  error: string | null
  notice: string | null
  user: AuthUser | null
  username: string
  password: string
  confirm: string
  displayName: string
}

export type AuthField = 'username' | 'password' | 'confirm' | 'displayName'

/** localStorage key holding the demo session token. */
export const TOKEN_KEY = 'dsh-auth.token'

export function createAuthStore() {
  return defineStore({
    init: (): AuthState => ({
      open: false,
      tab: 'login',
      busy: false,
      error: null,
      notice: null,
      user: null,
      username: '',
      password: '',
      confirm: '',
      displayName: '',
    }),
    persist: 'dsh-auth.state',
    actions: {
      open(state, tab: 'login' | 'register' = 'login') {
        state.open = true
        state.tab = tab
        state.error = null
        state.notice = null
      },
      close(state) {
        state.open = false
        state.error = null
        state.notice = null
      },
      switchTab(state, tab: 'login' | 'register') {
        state.tab = tab
        state.error = null
        state.notice = null
      },
      setField(state, field: AuthField, value: string) {
        state[field] = value
      },
      setBusy(state, busy: boolean) {
        state.busy = busy
      },
      setError(state, message: string | null) {
        state.error = message
      },
      setNotice(state, message: string | null) {
        state.notice = message
      },
      setUser(state, user: AuthUser | null) {
        state.user = user
      },
      resetForm(state) {
        state.username = ''
        state.password = ''
        state.confirm = ''
        state.displayName = ''
      },
    },
  })
}

export type AuthStore = ReturnType<typeof createAuthStore>
