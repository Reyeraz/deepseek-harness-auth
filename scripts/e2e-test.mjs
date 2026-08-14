/**
 * End-to-end test for the dsh-auth plugin against a running
 * `dsh web` instance. Requires the Playwright package (and a downloaded
 * Chromium) somewhere resolvable, e.g. inside a dsh source checkout.
 *
 * Usage:
 *   node scripts/e2e-test.mjs [baseUrl] [outDir]
 *
 * Steps covered: boot, trigger render, modal open, register, login,
 * session restore after reload, profile view, sign out, and the
 * wrong-password error path.
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
  // 401/409 resource messages are the intentional negative-path tests.
  if (msg.type() === 'error' && !/Failed to load resource.*(401|403|409)/u.test(msg.text())) {
    consoleErrors.push(msg.text())
  }
})
page.on('pageerror', (err) => { consoleErrors.push(`pageerror: ${err.message}`) })
page.on('dialog', (dialog) => { void dialog.accept() })

const shot = (name) => page.screenshot({ path: join(outDir, `${name}.png`) })

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
      const dialogs = await page.locator('[role="dialog"]').count()
      const masks = await page.locator('[role="presentation"]').count()
      if (dialogs === 0 && masks === 0) break
    }
    return true
  }
  return false
}

try {
  const username = `tester${Date.now() % 100_000_000}`

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForSelector('[data-dsh-auth-trigger]', { timeout: 120_000 })
  await dismissBootModal()
  log('app boots and auth trigger renders', true)
  await shot('01-app-trigger')

  const triggerText = await page.locator('[data-dsh-auth-trigger]').innerText()
  log('trigger label when logged out', triggerText.includes('登录 / 注册'), triggerText.trim())

  await page.click('[data-dsh-auth-trigger]')
  await page.waitForSelector('[role="dialog"]', { timeout: 15_000 })
  log('login/register modal opens', true)
  await shot('02-modal-login')

  await page.click('[data-dsh-auth-tab]:has-text("注册")')
  await page.fill('#dsh-auth-username', username)
  await page.fill('#dsh-auth-password', 'secret123')
  await page.fill('#dsh-auth-confirm', 'secret123')
  await page.fill('#dsh-auth-display', '测试用户')
  await shot('03-modal-register-filled')
  await page.click('[role="dialog"] [data-dsh-auth-submit]')
  await page.waitForSelector('[data-dsh-auth-notice]', { timeout: 15_000 })
  log('register succeeds with notice', true, await page.locator('[data-dsh-auth-notice]').innerText())
  const stillLogin = await page.locator('[data-dsh-auth-tab][aria-selected="true"]').innerText()
  log('register switches back to login tab', stillLogin.includes('登录'), stillLogin.trim())

  await page.fill('#dsh-auth-password', 'secret123')
  await shot('04-modal-login-filled')
  await page.click('[role="dialog"] [data-dsh-auth-submit]')
  await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 15_000 })
  log('login closes the modal', true)
  await page.waitForTimeout(500)
  const loggedInText = await page.locator('[data-dsh-auth-trigger]').innerText()
  log('trigger shows signed-in user', loggedInText.includes('测试用户'), loggedInText.trim())
  await shot('05-logged-in')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-dsh-auth-trigger]', { timeout: 120_000 })
  await dismissBootModal()
  await page.waitForTimeout(1500)
  const restoredText = await page.locator('[data-dsh-auth-trigger]').innerText()
  log('session restored after reload', restoredText.includes('测试用户'), restoredText.trim())
  await shot('06-session-restored')

  await page.click('[data-dsh-auth-trigger]')
  await page.waitForSelector('[role="dialog"]', { timeout: 15_000 })
  log('profile view opens', true)
  await shot('07-profile')
  await page.click('[role="dialog"] [data-dsh-auth-logout]')
  await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 15_000 })
  await page.waitForTimeout(500)
  const afterLogout = await page.locator('[data-dsh-auth-trigger]').innerText()
  log('sign out resets the trigger', afterLogout.includes('登录 / 注册'), afterLogout.trim())
  await shot('08-after-logout')

  await page.click('[data-dsh-auth-trigger]')
  await page.waitForSelector('[role="dialog"]', { timeout: 15_000 })
  await page.fill('#dsh-auth-username', username)
  await page.fill('#dsh-auth-password', 'wrong-password')
  await page.click('[role="dialog"] [data-dsh-auth-submit]')
  await page.waitForSelector('[data-dsh-auth-error]', { timeout: 15_000 })
  log('wrong password shows error', true, await page.locator('[data-dsh-auth-error]').innerText())
  await shot('09-login-error')

  // 10. Close the error modal and sign in as the built-in admin.
  await page.keyboard.press('Escape')
  await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 15_000 }).catch(() => {})
  await page.click('[data-dsh-auth-trigger]')
  await page.waitForSelector('[role="dialog"]', { timeout: 15_000 })
  await page.fill('#dsh-auth-username', 'admin')
  await page.fill('#dsh-auth-password', 'admin123')
  await page.click('[role="dialog"] [data-dsh-auth-submit]')
  await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 15_000 })
  await page.waitForTimeout(500)
  const adminTrigger = await page.locator('[data-dsh-auth-trigger]').innerText()
  log('admin signs in', adminTrigger.includes('管理员'), adminTrigger.trim())
  await shot('10-admin-signed-in')

  // 11. Open settings and find the account-management row.
  await page.click('button[aria-haspopup="dialog"]')
  await page.waitForSelector('[data-dsh-auth-settings]', { timeout: 15_000 })
  const rowText = await page.locator('[data-dsh-auth-settings]').innerText()
  log('settings account-management row renders',
    rowText.includes('账号管理') && rowText.includes('开放注册'),
    rowText.slice(0, 120).replace(/\n/g, ' / '))
  await shot('11-settings-account-management')

  // 12. Toggle registration off and confirm via /meta.
  await page.click('[data-dsh-auth-registration-toggle]')
  await page.waitForFunction(
    () => document.querySelector('[data-dsh-auth-registration-toggle]')?.textContent?.includes('已关闭'),
    { timeout: 15_000 },
  )
  const metaClosed = await page.evaluate(async () => (await fetch('/dsh-auth/meta')).json())
  log('registration closed by admin', metaClosed.registrationOpen === false, JSON.stringify(metaClosed))
  await shot('12-registration-closed')

  // 13. Delete the test account from the settings list.
  const userRow = page.locator(`[data-dsh-auth-user]:has-text("${username}")`)
  await userRow.waitFor({ timeout: 15_000 })
  await userRow.locator('[data-dsh-auth-user-delete]').click()
  await page.waitForFunction(
    (name) => ![...document.querySelectorAll('[data-dsh-auth-user]')].some(el => el.textContent.includes(name)),
    username,
    { timeout: 15_000 },
  )
  log('admin deletes a user from settings', true)
  await shot('13-user-deleted')

  // 14. Close settings, sign out, and verify the register tab is disabled.
  await page.keyboard.press('Escape')
  await page.waitForSelector('[data-dsh-auth-settings]', { state: 'detached', timeout: 15_000 }).catch(() => {})
  await page.click('[data-dsh-auth-trigger]')
  await page.waitForSelector('[role="dialog"]', { timeout: 15_000 })
  await page.click('[role="dialog"] [data-dsh-auth-logout]')
  await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 15_000 })
  await page.click('[data-dsh-auth-trigger]')
  await page.waitForSelector('[role="dialog"]', { timeout: 15_000 })
  await page.waitForTimeout(800)
  const registerTabDisabled = await page.locator('[data-dsh-auth-tab]:has-text("注册")').isDisabled()
  const closedNotice = await page.locator('[data-dsh-auth-notice]:has-text("管理员已关闭注册")').count()
  log('register tab disabled when registration closed', registerTabDisabled && closedNotice > 0)
  await shot('14-register-closed-ui')

  // 15. Direct API check: registration must reject with 403.
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

  // 16. Sign back in as admin and re-open registration for later runs.
  await page.keyboard.press('Escape')
  await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 15_000 }).catch(() => {})
  await page.click('[data-dsh-auth-trigger]')
  await page.waitForSelector('[role="dialog"]', { timeout: 15_000 })
  await page.fill('#dsh-auth-username', 'admin')
  await page.fill('#dsh-auth-password', 'admin123')
  await page.click('[role="dialog"] [data-dsh-auth-submit]')
  await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 15_000 })
  await page.click('button[aria-haspopup="dialog"]')
  await page.waitForSelector('[data-dsh-auth-settings]', { timeout: 15_000 })
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
  await shot('15-registration-reopened')
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
