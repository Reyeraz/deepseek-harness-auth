/**
 * End-to-end test for the dsh-auth plugin against a running `dsh web`
 * instance. Requires the Playwright package (and a downloaded Chromium)
 * somewhere resolvable, e.g. inside a dsh source checkout.
 *
 * Usage:
 *   node scripts/e2e-test.mjs [baseUrl] [outDir]
 *
 * Steps covered: forced login dialog on boot (not dismissible), register,
 * sign in, session restore, profile view, sign out (dialog reopens), admin
 * sign-in, account management in "My account", registration switch, user
 * deletion, register tab disabled while registration is closed, and the
 * 403 register rejection.
 */
import { mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

let playwright
try {
  playwright = await import('playwright')
} catch {
  // pnpm checkouts do not hoist playwright; probe candidate store paths.
  const candidates = [
    new URL('./node_modules/.pnpm/', import.meta.url),
    new URL('../node_modules/.pnpm/', import.meta.url),
    new URL('../../node_modules/.pnpm/', import.meta.url),
  ]
  for (const storeDir of candidates) {
    let entry
    try {
      entry = readdirSync(storeDir).find(name => name.startsWith('playwright@'))
    } catch {
      continue
    }
    if (entry === undefined) continue
    playwright = await import(
      new URL(`${entry}/node_modules/playwright/index.mjs`, storeDir)
    )
    break
  }
  if (playwright === undefined) {
    throw new Error('playwright not found: install it or run from a dsh checkout')
  }
}
const { chromium } = playwright

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:3080'
const outDir = process.argv[3] ?? 'test-shots'
mkdirSync(outDir, { recursive: true })

const results = []
const failures = []
const consoleErrors = []

function log(step, ok, detail = '') {
  results.push({ step, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${step}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

page.on('console', (msg) => {
  // 401/403/409 resource messages are the intentional negative-path tests.
  if (msg.type() === 'error' && !/Failed to load resource.*(401|403|409)/u.test(msg.text())) {
    consoleErrors.push(msg.text())
  }
})
page.on('pageerror', (err) => { consoleErrors.push(`pageerror: ${err.message}`) })
page.on('dialog', (dialog) => { void dialog.accept() })

const shot = (name) => page.screenshot({ path: join(outDir, `${name}.png`) })
const authDialog = () => page.locator('[data-dsh-auth-dialog]')

/** Dismiss the app's own first-run "add API key" dialog when it shows up. */
async function dismissBootModal() {
  const button = page.locator('[role="dialog"] button:has-text("稍后配置")')
  for (let i = 0; i < 150; i += 1) {
    if (await button.count() > 0) break
    await page.waitForTimeout(200)
  }
  if (await button.count() > 0) {
    await button.first().click()
    for (let i = 0; i < 30; i += 1) {
      await page.waitForTimeout(200)
      if (await page.locator('[role="presentation"]').count() === 0) break
    }
    return true
  }
  return false
}

/** Sign in through the (already open) auth dialog. */
async function signIn(username, password) {
  await authDialog().waitFor({ timeout: 15_000 })
  await page.fill('#dsh-auth-username', username)
  await page.fill('#dsh-auth-password', password)
  await page.click('[data-dsh-auth-dialog] [data-dsh-auth-submit]')
  await authDialog().waitFor({ state: 'detached', timeout: 15_000 })
  await page.waitForTimeout(400)
}

try {
  const username = `tester${Date.now() % 100_000_000}`

  // 1. Boot: the auth dialog must open on its own (forced login).
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await authDialog().waitFor({ timeout: 120_000 })
  log('forced login dialog opens on boot', true)
  // The app's own first-run "add API key" dialog may stack on top; dismiss it.
  await dismissBootModal()
  log('no close button while signed out', await page.locator('[data-dsh-auth-dialog-close]').count() === 0)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  log('Escape does not dismiss the forced dialog', await authDialog().count() === 1)
  await shot('01-forced-login')

  // 2. Register through the forced dialog.
  // If a previous run left registration closed, reopen it as admin first.
  if (await page.locator('[data-dsh-auth-tab]:has-text("注册")').isDisabled()) {
    await signIn('admin', 'admin123')
    await dismissBootModal()
    await page.click('[data-dsh-auth-trigger]')
    await authDialog().waitFor({ timeout: 15_000 })
    await page.waitForSelector('[data-dsh-auth-settings]', { timeout: 15_000 })
    await page.waitForFunction(
      () => {
        const text = document.querySelector('[data-dsh-auth-registration-toggle]')?.textContent
        return text === '已开启' || text === '已关闭'
      },
      { timeout: 15_000 },
    )
    const toggleText = await page.locator('[data-dsh-auth-registration-toggle]').innerText()
    if (toggleText.includes('已关闭')) {
      await page.click('[data-dsh-auth-registration-toggle]')
    }
    await page.waitForFunction(
      () => document.querySelector('[data-dsh-auth-registration-toggle]')?.textContent?.includes('已开启'),
      { timeout: 15_000 },
    )
    await page.click('[data-dsh-auth-dialog] [data-dsh-auth-logout]')
    await page.waitForFunction(
      () => [...document.querySelectorAll('[data-dsh-auth-tab]')]
        .some(el => el.textContent.includes('注册') && el.disabled !== true),
      { timeout: 15_000 },
    )
    log('registration re-opened before test run', true)
  }
  await page.click('[data-dsh-auth-tab]:has-text("注册")')
  await page.fill('#dsh-auth-username', username)
  await page.fill('#dsh-auth-password', 'secret123')
  await page.fill('#dsh-auth-confirm', 'secret123')
  await page.fill('#dsh-auth-display', '测试用户')
  await shot('02-modal-register-filled')
  await page.click('[data-dsh-auth-dialog] [data-dsh-auth-submit]')
  await page.waitForSelector('[data-dsh-auth-notice]', { timeout: 15_000 })
  log('register succeeds with notice', true, await page.locator('[data-dsh-auth-notice]').innerText())
  const stillLogin = await page.locator('[data-dsh-auth-tab][aria-selected="true"]').innerText()
  log('register switches back to login tab', stillLogin.includes('登录'), stillLogin.trim())

  // 3. Sign in: the dialog closes and the app becomes usable.
  await signIn(username, 'secret123')
  log('sign-in closes the forced dialog', true)
  await dismissBootModal()
  const loggedInText = await page.locator('[data-dsh-auth-trigger]').innerText()
  log('trigger shows signed-in user', loggedInText.includes('测试用户'), loggedInText.trim())
  await shot('03-logged-in')

  // 4. Reload: the dialog must NOT reopen while a session exists.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-dsh-auth-trigger]', { timeout: 120_000 })
  await page.waitForTimeout(1500)
  await dismissBootModal()
  log('forced dialog stays closed after reload while signed in', await authDialog().count() === 0)
  const restoredText = await page.locator('[data-dsh-auth-trigger]').innerText()
  log('session restored after reload', restoredText.includes('测试用户'), restoredText.trim())
  await shot('04-session-restored')

  // 5. Profile view opens with a close button once signed in.
  await page.click('[data-dsh-auth-trigger]')
  await authDialog().waitFor({ timeout: 15_000 })
  log('profile view opens', await page.locator('[data-dsh-auth-dialog-close]').count() === 1)
  await shot('05-profile')

  // 6. Sign out: the dialog stays open on the login tab (forced again).
  await page.click('[data-dsh-auth-dialog] [data-dsh-auth-logout]')
  await page.waitForTimeout(500)
  log('sign out keeps the forced dialog open', await authDialog().count() === 1)
  log('no close button after sign out', await page.locator('[data-dsh-auth-dialog-close]').count() === 0)
  const afterLogout = await page.locator('[data-dsh-auth-trigger]').innerText()
  log('trigger resets after sign out', afterLogout.includes('登录 / 注册'), afterLogout.trim())
  await shot('06-after-logout')

  // 7. Wrong-password error path.
  await page.fill('#dsh-auth-username', username)
  await page.fill('#dsh-auth-password', 'wrong-password')
  await page.click('[data-dsh-auth-dialog] [data-dsh-auth-submit]')
  await page.waitForSelector('[data-dsh-auth-error]', { timeout: 15_000 })
  log('wrong password shows error', true, await page.locator('[data-dsh-auth-error]').innerText())
  await shot('07-login-error')

  // 8. Sign in as the built-in admin.
  await signIn('admin', 'admin123')
  log('admin signs in', true)
  await dismissBootModal()
  await shot('08-admin-signed-in')

  // 9. Account management lives in the "My account" view.
  await page.click('[data-dsh-auth-trigger]')
  await authDialog().waitFor({ timeout: 15_000 })
  await page.waitForSelector('[data-dsh-auth-settings]', { timeout: 15_000 })
  await page.waitForSelector('[data-dsh-auth-user]:has-text("admin")', { timeout: 15_000 })
  const rowText = await page.locator('[data-dsh-auth-settings]').innerText()
  log('account management renders in My account',
    rowText.includes('账号管理') && rowText.includes('开放注册') && rowText.includes('admin'),
    rowText.slice(0, 140).replace(/\n/g, ' / '))
  await shot('09-account-management')

  // 10. Toggle registration off and confirm via /meta.
  await page.click('[data-dsh-auth-registration-toggle]')
  await page.waitForFunction(
    () => document.querySelector('[data-dsh-auth-registration-toggle]')?.textContent?.includes('已关闭'),
    { timeout: 15_000 },
  )
  const metaClosed = await page.evaluate(async () => (await fetch('/dsh-auth/meta')).json())
  log('registration closed by admin', metaClosed.registrationOpen === false, JSON.stringify(metaClosed))
  await shot('10-registration-closed')

  // 11. Delete the test account from the management list.
  const userRow = page.locator(`[data-dsh-auth-user]:has-text("${username}")`)
  await userRow.waitFor({ timeout: 15_000 })
  await userRow.locator('[data-dsh-auth-user-delete]').click()
  await page.waitForFunction(
    (name) => ![...document.querySelectorAll('[data-dsh-auth-user]')].some(el => el.textContent.includes(name)),
    username,
    { timeout: 15_000 },
  )
  log('admin deletes a user from My account', true)
  await shot('11-user-deleted')

  // 12. Sign out as admin; the register tab must be disabled.
  await page.click('[data-dsh-auth-dialog] [data-dsh-auth-logout]')
  await page.waitForFunction(
    () => [...document.querySelectorAll('[data-dsh-auth-tab]')]
      .some(el => el.textContent.includes('注册') && el.disabled === true),
    { timeout: 15_000 },
  )
  const registerTabDisabled = await page.locator('[data-dsh-auth-tab]:has-text("注册")').isDisabled()
  const closedNotice = await page.locator('[data-dsh-auth-notice]:has-text("管理员已关闭注册")').count()
  log('register tab disabled when registration closed', registerTabDisabled && closedNotice > 0)
  await shot('12-register-closed-ui')

  // 13. Direct API check: registration must reject with 403.
  const rejectResult = await page.evaluate(async () => {
    const response = await fetch('/dsh-auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `blocked${Date.now() % 100_000}`,
        password: 'secret123',
      }),
    })
    return { status: response.status, body: await response.json() }
  })
  log('register API rejects when closed',
    rejectResult.status === 403,
    `${rejectResult.status} ${rejectResult.body?.error?.code}`)

  // 14. Sign back in as admin and re-open registration for later runs.
  await signIn('admin', 'admin123')
  await dismissBootModal()
  await page.click('[data-dsh-auth-trigger]')
  await authDialog().waitFor({ timeout: 15_000 })
  await page.waitForSelector('[data-dsh-auth-settings]', { timeout: 15_000 })
  await page.waitForFunction(
    () => {
      const text = document.querySelector('[data-dsh-auth-registration-toggle]')?.textContent
      return text === '已开启' || text === '已关闭'
    },
    { timeout: 15_000 },
  )
  const toggleText = await page.locator('[data-dsh-auth-registration-toggle]').innerText()
  if (toggleText.includes('已关闭')) {
    await page.click('[data-dsh-auth-registration-toggle]')
  }
  await page.waitForFunction(
    () => document.querySelector('[data-dsh-auth-registration-toggle]')?.textContent?.includes('已开启'),
    { timeout: 15_000 },
  )
  const metaOpen = await page.evaluate(async () => (await fetch('/dsh-auth/meta')).json())
  log('registration re-opened by admin', metaOpen.registrationOpen === true, JSON.stringify(metaOpen))
  await shot('13-registration-reopened')
} catch (error) {
  failures.push(`${error.stack ?? error}`)
  log('run', false, error.message)
} finally {
  log('no browser console errors', consoleErrors.length === 0,
    consoleErrors.length > 0 ? consoleErrors.slice(0, 5).join(' | ') : '')
  await browser.close()
}

console.log(`\nSUMMARY: ${results.filter(r => r.ok).length}/${results.length} passed`)
if (failures.length > 0) {
  console.log('FAILURES:\n' + failures.join('\n---\n'))
  process.exit(1)
}
