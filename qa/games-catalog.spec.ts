import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { gameCatalog, getGameHref } from '../src/lib/games'

const BASE_URL = process.env.KINSPACE_PROD_URL ?? 'https://www.kinspace.co.za'
const marker = `games${Date.now()}`
const testUser = {
  fullName: `QA Games ${marker}`,
  username: `qa_${marker}`,
  email: `qa+${marker}@kinspace.test`,
  password: `KinSpace-${marker}-Pass!`,
}

let createdUserId: string | null = null

test.use({ channel: 'msedge', baseURL: BASE_URL })
test.describe.configure({ mode: 'serial' })

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

async function signUpAndLogin(page: Page) {
  const existing = runD1(`SELECT id FROM users WHERE email=${sqlString(testUser.email)} LIMIT 1;`)
  createdUserId = (existing[0]?.results?.[0]?.id as string | undefined) ?? null

  if (!createdUserId) {
    await page.goto('/signup')
    await page.getByLabel('What should we call you?').fill(testUser.fullName)
    await page.getByLabel('Username').fill(testUser.username)
    await page.getByLabel('Email').fill(testUser.email)
    await page.getByLabel('Password').fill(testUser.password)
    await page.getByRole('button', { name: 'Create account' }).click()

    const botCheckFailed = await page.getByText('Bot check failed', { exact: false }).isVisible().catch(() => false)
    test.skip(botCheckFailed, 'Signup is protected by Turnstile in this environment.')

    await expect.poll(() => {
      const rows = runD1(`SELECT id FROM users WHERE email=${sqlString(testUser.email)} LIMIT 1;`)
      return (rows[0]?.results?.[0]?.id as string | undefined) ?? null
    }, { timeout: 15000 }).not.toBeNull()

    const rows = runD1(`SELECT id FROM users WHERE email=${sqlString(testUser.email)} LIMIT 1;`)
    createdUserId = (rows[0]?.results?.[0]?.id as string | undefined) ?? null
    await page.waitForLoadState('networkidle').catch(() => undefined)
  }

  expect(createdUserId).toBeTruthy()

  runD1(`
    UPDATE profiles
    SET onboarding_complete=1,
        conditions='["Anxiety"]',
        location='Johannesburg, South Africa'
    WHERE user_id=${sqlString(createdUserId!)};
  `)

  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('Email').fill(testUser.email)
  await page.getByLabel('Password').fill(testUser.password)
  const signInButton = page.getByRole('button', { name: 'Sign in' })
  await expect(signInButton).toBeEnabled({ timeout: 15000 })
  await signInButton.click()
  await expect(page.getByRole('heading', { name: testUser.fullName })).toBeVisible({ timeout: 15000 })
}

async function expectNoConsoleErrors(errors: string[]) {
  expect(errors.filter((message) => !message.includes('React DevTools'))).toEqual([])
}

async function openGame(page: Page, href: string, heading: string) {
  await page.goto(href)
  await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 15000 })
}

test.afterAll(() => {
  const id = createdUserId
  if (!id) return
  runD1(`DELETE FROM games WHERE host_id=${sqlString(id)};`)
  runD1(`DELETE FROM users WHERE id=${sqlString(id)};`)
})

test('games catalog routes and VS flows work in production', async ({ page }) => {
  test.setTimeout(180000)
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await signUpAndLogin(page)

  await page.goto('/games')
  await expect(page.getByRole('heading', { name: 'Games' })).toBeVisible()
  await page.getByRole('tab', { name: 'VS games' }).click()
  await expect(page.getByRole('group', { name: 'Connect Four game' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Reversi game' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Rock Paper Scissors game' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Go game' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Xiangqi game' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Gomoku game' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Battleship game' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Dots and Boxes game' })).toBeVisible()
  for (const game of gameCatalog.filter((item) => item.isMultiplayer)) {
    await expect(page.getByRole('group', { name: `${game.name} game` }).getByRole('link', { name: /AI/ })).toBeVisible()
  }

  await page.getByRole('group', { name: 'Go game' }).getByRole('button', { name: 'Tutorial' }).click()
  const goTutorial = page.getByRole('dialog', { name: 'Go tutorial' })
  await expect(goTutorial).toContainText('Step 1')
  await goTutorial.locator('button').filter({ hasText: /^Close$/ }).click()

  await page.getByRole('tab', { name: 'Practice' }).click()
  await page.getByRole('button', { name: 'All' }).click()
  for (const game of gameCatalog) {
    const group = page.getByRole('group', { name: `${game.name} game` })
    await expect(group.getByRole('button', { name: 'Tutorial' })).toBeVisible()
    await expect(group.getByRole('link', { name: game.isMultiplayer ? /AI/ : game.practiceLabel })).toBeVisible()
  }

  await page.getByRole('tab', { name: 'VS games' }).click()
  await page
    .getByRole('group', { name: 'Connect Four game' })
    .getByRole('button', { name: 'Open room' })
    .click()
  await expect(page.getByRole('dialog', { name: /New room/ })).toContainText('Connect Four')
  await page.getByRole('button', { name: 'Create room' }).click()
  await expect(page).toHaveURL(/\/games\/rooms\//)
  await expect(page.getByRole('heading', { name: 'Connect Four' })).toBeVisible()
  await page.getByRole('link', { name: 'Open board' }).click()
  await expect(page.getByRole('heading', { name: 'Connect Four' })).toBeVisible()

  for (const game of gameCatalog) {
    const href = getGameHref(game.id, { difficulty: game.supportsDifficulty ? 'easy' : undefined })
    await page.goto(href)
    await expect(page.getByRole('heading', { name: game.name })).toBeVisible({ timeout: 15000 })
  }

  await page.goto('/games/connect-four')
  await page.getByRole('button', { name: 'Column 1, row 1' }).click()
  await expect(page.getByText('Yellow to move')).toBeVisible()

  await page.goto('/games/connect-four?mode=ai')
  await page.getByRole('button', { name: 'Column 1, row 1' }).click()
  await expect(page.getByText('You are red')).toBeVisible()

  await openGame(page, '/games/reversi', 'Reversi')
  await page.getByRole('button', { name: 'Square 3, 4' }).click()
  await expect(page.getByText('Black 4')).toBeVisible()

  await page.goto('/games/rock-paper-scissors')
  await page.getByRole('button', { name: 'Rock' }).click()
  await expect(page.getByText('Locked')).toBeVisible()
  await page.getByRole('button', { name: 'Scissors' }).click()
  await expect(page.getByText('Player 1 wins the round')).toBeVisible()

  await page.goto('/games/rock-paper-scissors?mode=ai')
  await page.getByRole('button', { name: 'Rock' }).click()
  await expect(page.getByText('P2 is AI')).toBeVisible()

  await expectNoConsoleErrors(consoleErrors)
})

test('all game boards accept primary interactions in production', async ({ page }) => {
  test.setTimeout(240000)
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await signUpAndLogin(page)

  await openGame(page, '/games/memory?difficulty=easy', 'Memory Match')
  await page.getByRole('button', { name: /card-1-/ }).click()
  await page.getByRole('button', { name: /card-2-/ }).click()
  await expect(page.getByText(/Moves/i)).toBeVisible()

  await openGame(page, '/games/lightsout?difficulty=easy', 'Lights Out')
  await page.getByRole('button', { name: /tile-0-/ }).click()
  await expect(page.getByText('Moves 1')).toBeVisible()

  await openGame(page, '/games/wordsearch?difficulty=easy', 'Word Search')
  await page.locator('button[aria-label^="cell-"]').first().click()
  await page.locator('button[aria-label^="cell-"]').nth(1).click()
  await expect(page.getByRole('heading', { name: 'Word Search' })).toBeVisible()

  await openGame(page, '/games/wordle', 'Wordle')
  for (const letter of ['A', 'B', 'C', 'D', 'E']) {
    await page.getByRole('button', { name: letter, exact: true }).click()
  }
  await page.getByRole('button', { name: 'Enter' }).click()
  await expect(page.getByText('Round 1 / 6')).toBeVisible()

  await openGame(page, '/games/sudoku?difficulty=easy', 'Sudoku')
  const emptySudokuCell = page.getByRole('button', { name: /Sudoku cell .* empty/ }).first()
  await expect(emptySudokuCell).toBeVisible({ timeout: 15000 })
  await emptySudokuCell.click()
  await page.locator('button').filter({ hasText: /^1$/ }).last().click()
  await expect(page.getByRole('button', { name: /Sudoku cell .* value 1/ }).first()).toBeVisible()

  await openGame(page, '/games/2048', '2048')
  await page.keyboard.press('ArrowRight')
  await page.getByRole('button', { name: 'New game' }).click()
  await expect(page.getByText('Score 0')).toBeVisible()

  await openGame(page, '/games/minesweeper?difficulty=easy', 'Minesweeper')
  await page.getByRole('button', { name: /Minesweeper square 1, 1 hidden/ }).click({ button: 'right' })
  await expect(page.getByRole('button', { name: /Minesweeper square 1, 1 flagged/ })).toBeVisible()

  await openGame(page, '/games/simon?difficulty=easy', 'Simon')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText(/Watch closely|Your turn/)).toBeVisible()

  await openGame(page, '/games/snake?difficulty=easy', 'Snake')
  await page.keyboard.press('ArrowRight')
  await page.getByRole('button', { name: 'New game' }).click()
  await expect(page.getByText(/Score 0/)).toBeVisible()

  await openGame(page, '/games/tetris', 'Tetris')
  const tetrisBoard = page.locator('.game-board')
  await expect(tetrisBoard).toBeVisible()
  await expect(tetrisBoard.locator('.game-block')).toHaveCount(200)
  const tetrisBoardBox = await tetrisBoard.boundingBox()
  expect(tetrisBoardBox?.width ?? 0).toBeGreaterThanOrEqual(200)
  expect(tetrisBoardBox?.height ?? 0).toBeGreaterThanOrEqual(360)
  await expect(page.locator('.game-board .game-block:not(.block-empty)').first()).toBeVisible()
  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()
  await page.getByRole('button', { name: 'Resume' }).click()

  await openGame(page, '/games/tictactoe?difficulty=easy', 'Tic Tac Toe')
  await page.getByRole('button', { name: 'cell-0' }).click()
  await expect(page.getByRole('button', { name: 'cell-0' })).toContainText('X')

  await openGame(page, '/games/checkers?difficulty=easy', 'Checkers')
  await page.getByRole('button', { name: /Checkers square 6, 1 black/ }).click()
  await page.getByRole('button', { name: /Checkers square 5, 2 empty/ }).click()
  await expect(page.getByText(/Turn:/)).toBeVisible()

  await openGame(page, '/games/chess?difficulty=easy', 'Chess')
  await page.getByRole('button', { name: 'New game' }).click()
  await expect(page.getByText('No moves yet.')).toBeVisible()

  await openGame(page, '/games/uno', 'UNO Cards')
  await page.getByRole('button', { name: 'Draw', exact: true }).click()
  await expect(page.getByText('You drew a card.')).toBeVisible()

  await openGame(page, '/games/drawing', 'Draw & Guess')
  const canvas = page.locator('canvas')
  const box = await canvas.boundingBox()
  expect(box).toBeTruthy()
  await page.mouse.move(box!.x + 20, box!.y + 20)
  await page.mouse.down()
  await page.mouse.move(box!.x + 90, box!.y + 60)
  await page.mouse.up()
  await page.getByRole('button', { name: 'Clear' }).click()
  await page.getByRole('button', { name: 'New prompt' }).click()
  await expect(page.getByRole('heading', { name: 'Draw & Guess' })).toBeVisible()

  await openGame(page, '/games/connect-four', 'Connect Four')
  await page.getByRole('button', { name: 'Column 1, row 1' }).click()
  await expect(page.getByText('Yellow to move')).toBeVisible()

  await openGame(page, '/games/reversi', 'Reversi')
  await page.getByRole('button', { name: 'Square 3, 4' }).click()
  await expect(page.getByText('Black 4')).toBeVisible()

  await openGame(page, '/games/rock-paper-scissors', 'Rock Paper Scissors')
  await page.getByRole('button', { name: 'Rock' }).click()
  await expect(page.getByText('Locked')).toBeVisible()
  await page.getByRole('button', { name: 'Scissors' }).click()
  await expect(page.getByText('Player 1 wins the round')).toBeVisible()

  await openGame(page, '/games/go?mode=ai', 'Go')
  await page.getByRole('button', { name: 'Go point 5, 5 empty' }).click()
  await expect(page.getByText(/AI placed|AI passed/)).toBeVisible()

  await openGame(page, '/games/xiangqi?mode=ai', 'Xiangqi')
  await page.getByRole('button', { name: 'Xiangqi square 7, 1 red soldier' }).click()
  await page.getByRole('button', { name: 'Xiangqi square 6, 1 empty' }).click()
  await expect(page.getByText(/AI moved|AI has no move/)).toBeVisible()

  await openGame(page, '/games/gomoku?mode=ai', 'Gomoku')
  await page.getByRole('button', { name: 'Gomoku square 8, 8 empty' }).click()
  await expect(page.getByText('You black')).toBeVisible()

  await openGame(page, '/games/battleship?mode=ai', 'Battleship')
  await page.getByRole('button', { name: 'Target square 2, 1 unknown' }).click()
  await expect(page.getByText(/Hit on the AI fleet|Missed the AI fleet|You sank the AI fleet/)).toBeVisible()

  await openGame(page, '/games/dots-and-boxes?mode=ai', 'Dots and Boxes')
  await page.getByRole('button', { name: 'Horizontal line 1, 1' }).click()
  await expect(page.getByText(/AI turn|Your turn|AI closed a box|You closed a box/)).toBeVisible()

  await expectNoConsoleErrors(consoleErrors)
})
