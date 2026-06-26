import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import axe from 'axe-core'

const BASE_URL = process.env.KINSPACE_PROD_URL ?? 'https://www.kinspace.co.za'
const marker = `qa${Date.now()}`
const testUser = {
  fullName: `QA Member ${marker}`,
  username: `qa_${marker}`,
  email: `qa+${marker}@kinspace.test`,
  password: `KinSpace-${marker}-Pass!`,
}

let createdUserId: string | null = null

test.use({ channel: 'msedge', baseURL: BASE_URL })
test.describe.configure({ mode: 'serial' })

type AxeNode = { target: string[] }
type AxeViolation = { id: string; impact: string | null; help: string; nodes: AxeNode[] }
type AxeResult = { violations: AxeViolation[] }

declare global {
  interface Window {
    axe: {
      run: (
        context: Document,
        options: { runOnly: { type: 'tag'; values: string[] } },
      ) => Promise<AxeResult>
    }
  }
}

function runD1(command: string) {
  const wrangler = path.join(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js')
  const output = execFileSync(
    process.execPath,
    [wrangler, 'd1', 'execute', 'kinspace', '--remote', '--command', command],
    { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
  const start = output.indexOf('[\n')
  if (start === -1) return []
  return JSON.parse(output.slice(start)) as Array<{ results?: Array<Record<string, unknown>> }>
}

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

async function axeViolations(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined)
  await page.addScriptTag({ content: axe.source })
  return page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    })
    return result.violations.map((violation: AxeViolation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.slice(0, 5).map((node: AxeNode) => node.target.join(' ')),
    }))
  })
}

test.afterAll(() => {
  const id = createdUserId
  if (!id) return
  runD1(`DELETE FROM users WHERE id=${sqlString(id)};`)
})

test('runs production member smoke and accessibility checks', async ({ page }) => {
  test.setTimeout(120000)

  await page.goto('/signup')
  await page.getByLabel('What should we call you?').fill(testUser.fullName)
  await page.getByLabel('Username').fill(testUser.username)
  await page.getByLabel('Email').fill(testUser.email)
  await page.getByLabel('Password').fill(testUser.password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForTimeout(2500)

  const botCheckFailed = await page.getByText('Bot check failed', { exact: false }).isVisible().catch(() => false)
  test.skip(botCheckFailed, 'Signup is protected by Turnstile in this environment.')

  const rows = runD1(`SELECT id FROM users WHERE email=${sqlString(testUser.email)} LIMIT 1;`)
  createdUserId = (rows[0]?.results?.[0]?.id as string | undefined) ?? null
  expect(createdUserId).toBeTruthy()

  runD1(`
    UPDATE profiles
    SET onboarding_complete=1,
        conditions='["Anxiety"]',
        location='Johannesburg, South Africa'
    WHERE user_id=${sqlString(createdUserId!)};
  `)

  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined)
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('Email').fill(testUser.email)
  await page.getByLabel('Password').fill(testUser.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForTimeout(2500)

  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: testUser.fullName })).toBeVisible()
  await expect(page.getByText('Daily check-in')).toBeVisible()
  await page.getByRole('button', { name: 'Heavy' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Maybe later' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Heavy' })).toHaveAttribute('aria-pressed', 'true')

  const moodRows = runD1(`
    SELECT mood, COUNT(*) AS count
    FROM mood_checkins
    WHERE user_id=${sqlString(createdUserId!)} AND day=date('now')
    GROUP BY mood;
  `)
  expect(moodRows[0]?.results).toEqual([{ mood: 'heavy', count: 1 }])

  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  for (const route of ['/dashboard', '/ask', '/community', '/groups', '/resources', '/timeline', '/settings', '/games/2048']) {
    await page.goto(route)
    await expect(page.locator('body')).toContainText(/KinSpace|Daily check-in|Ask|Community|Groups|Resources|Timeline|Settings|2048/)
  }

  expect(errors).toEqual([])

  const checked: Record<string, Awaited<ReturnType<typeof axeViolations>>> = {}

  for (const route of ['/dashboard', '/ask', '/community', '/resources', '/groups', '/settings']) {
    await page.goto(route)
    checked[route] = (await axeViolations(page)).filter((violation: Awaited<ReturnType<typeof axeViolations>>[number]) =>
      violation.impact === 'serious' || violation.impact === 'critical',
    )
  }

  expect(checked).toEqual({
    '/dashboard': [],
    '/ask': [],
    '/community': [],
    '/resources': [],
    '/groups': [],
    '/settings': [],
  })
})
