export type UnoColor = 'red' | 'yellow' | 'green' | 'blue'
export type UnoWildColor = UnoColor | 'wild'
export type UnoValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4'

export type UnoCard = {
  id: string
  color: UnoWildColor
  value: UnoValue
}

export type UnoPlayer = {
  id: string
  name: string
  isAI: boolean
  hand: UnoCard[]
}

export type UnoState = {
  deck: UnoCard[]
  discard: UnoCard[]
  players: UnoPlayer[]
  currentIndex: number
  direction: 1 | -1
  activeColor: UnoColor
  drawStack: number
  winner: string | null
  lastAction: string
}

const COLORS: UnoColor[] = ['red', 'yellow', 'green', 'blue']

export function createDeck(): UnoCard[] {
  const deck: UnoCard[] = []
  let id = 0
  for (const color of COLORS) {
    deck.push({ id: `c${id++}`, color, value: '0' })
    for (const value of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'] as UnoValue[]) {
      deck.push({ id: `c${id++}`, color, value })
      deck.push({ id: `c${id++}`, color, value })
    }
  }
  for (let n = 0; n < 4; n += 1) {
    deck.push({ id: `c${id++}`, color: 'wild', value: 'wild' })
    deck.push({ id: `c${id++}`, color: 'wild', value: 'wild4' })
  }
  return shuffle(deck)
}

export function shuffle<T>(deck: T[]): T[] {
  const next = [...deck]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

export function setupGame(playerNames: Array<{ id: string; name: string; isAI: boolean }>): UnoState {
  let deck = createDeck()
  const players: UnoPlayer[] = playerNames.map((player) => ({ ...player, hand: [] }))
  for (let round = 0; round < 7; round += 1) {
    for (const player of players) {
      player.hand.push(deck.shift()!)
    }
  }
  // First non-wild discard
  let top = deck.shift()!
  while (top.color === 'wild') {
    deck.push(top)
    deck = shuffle(deck)
    top = deck.shift()!
  }
  return {
    deck,
    discard: [top],
    players,
    currentIndex: 0,
    direction: 1,
    activeColor: top.color as UnoColor,
    drawStack: 0,
    winner: null,
    lastAction: `Game started — top card is ${labelFor(top)}.`,
  }
}

export function labelFor(card: UnoCard) {
  if (card.value === 'wild') return 'Wild'
  if (card.value === 'wild4') return 'Wild Draw 4'
  if (card.value === 'skip') return `${colorLabel(card.color)} Skip`
  if (card.value === 'reverse') return `${colorLabel(card.color)} Reverse`
  if (card.value === 'draw2') return `${colorLabel(card.color)} Draw 2`
  return `${colorLabel(card.color)} ${card.value}`
}

function colorLabel(color: UnoWildColor) {
  return color.charAt(0).toUpperCase() + color.slice(1)
}

export function canPlay(card: UnoCard, state: UnoState): boolean {
  if (state.drawStack > 0) {
    if (state.discard[state.discard.length - 1].value === 'draw2') return card.value === 'draw2' || card.value === 'wild4'
    if (state.discard[state.discard.length - 1].value === 'wild4') return card.value === 'wild4'
  }
  if (card.color === 'wild') return true
  const top = state.discard[state.discard.length - 1]
  return card.color === state.activeColor || card.value === top.value
}

function drawFromDeck(state: UnoState, count: number): UnoCard[] {
  const drawn: UnoCard[] = []
  for (let index = 0; index < count; index += 1) {
    if (state.deck.length === 0) {
      const top = state.discard.pop()!
      state.deck = shuffle(state.discard)
      state.discard = [top]
    }
    if (state.deck.length === 0) break
    drawn.push(state.deck.shift()!)
  }
  return drawn
}

function advance(state: UnoState, skip = 0) {
  const total = state.players.length
  const step = skip + 1
  state.currentIndex = ((state.currentIndex + state.direction * step) % total + total) % total
}

export function drawCard(state: UnoState): UnoState {
  const next: UnoState = JSON.parse(JSON.stringify(state))
  const current = next.players[next.currentIndex]
  if (next.drawStack > 0) {
    current.hand.push(...drawFromDeck(next, next.drawStack))
    next.lastAction = `${current.name} drew ${next.drawStack} cards.`
    next.drawStack = 0
    advance(next)
    return next
  }
  const drawn = drawFromDeck(next, 1)
  current.hand.push(...drawn)
  next.lastAction = `${current.name} drew a card.`
  advance(next)
  return next
}

export function playCard(state: UnoState, cardId: string, chosenColor?: UnoColor): UnoState {
  const next: UnoState = JSON.parse(JSON.stringify(state))
  const current = next.players[next.currentIndex]
  const index = current.hand.findIndex((card) => card.id === cardId)
  if (index < 0) return state

  const card = current.hand[index]
  if (!canPlay(card, next)) return state

  current.hand.splice(index, 1)
  next.discard.push(card)
  next.lastAction = `${current.name} played ${labelFor(card)}.`

  if (card.color === 'wild') {
    next.activeColor = chosenColor ?? 'red'
  } else {
    next.activeColor = card.color as UnoColor
  }

  if (current.hand.length === 0) {
    next.winner = current.id
    next.lastAction += ` ${current.name} wins!`
    return next
  }

  let skip = 0
  if (card.value === 'skip') skip = 1
  if (card.value === 'reverse') {
    if (next.players.length === 2) skip = 1
    else next.direction = next.direction === 1 ? -1 : 1
  }
  if (card.value === 'draw2') next.drawStack += 2
  if (card.value === 'wild4') next.drawStack += 4

  advance(next, skip)
  return next
}

// AI picks a playable card; prefers action cards. Returns playable id or null to draw.
export function aiChoose(state: UnoState): { cardId: string | null; chosenColor?: UnoColor } {
  const player = state.players[state.currentIndex]
  const playable = player.hand.filter((card) => canPlay(card, state))
  if (playable.length === 0) return { cardId: null }

  // Prefer action cards
  const sorted = [...playable].sort((a, b) => score(b) - score(a))
  const card = sorted[0]
  if (card.color === 'wild') {
    const counts: Record<UnoColor, number> = { red: 0, yellow: 0, green: 0, blue: 0 }
    for (const other of player.hand) {
      if (other.color !== 'wild') counts[other.color as UnoColor] += 1
    }
    const best = (Object.entries(counts) as Array<[UnoColor, number]>).sort(
      (a, b) => b[1] - a[1],
    )[0][0]
    return { cardId: card.id, chosenColor: best }
  }
  return { cardId: card.id }
}

function score(card: UnoCard) {
  if (card.value === 'wild4') return 50
  if (card.value === 'wild') return 40
  if (card.value === 'draw2') return 35
  if (card.value === 'skip' || card.value === 'reverse') return 25
  return Number.parseInt(card.value as string, 10) || 1
}
