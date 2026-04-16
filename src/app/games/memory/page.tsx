'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'

type MemoryDifficulty = 'easy' | 'medium' | 'hard'

const SIZES: Record<MemoryDifficulty, { rows: number; cols: number }> = {
  easy: { rows: 4, cols: 4 },
  medium: { rows: 4, cols: 6 },
  hard: { rows: 6, cols: 6 },
}

const POOL = ['🌿', '🌼', '🍃', '🌸', '🍀', '🌻', '🌺', '🪴', '🌵', '🦋', '🐝', '🐞', '🍄', '🌞', '🌙', '⭐', '🌈', '🫶']

type Card = {
  id: number
  emoji: string
  matched: boolean
  flipped: boolean
}

function buildDeck(difficulty: MemoryDifficulty): Card[] {
  const { rows, cols } = SIZES[difficulty]
  const pairs = (rows * cols) / 2
  const deck: Card[] = []
  const symbols = [...POOL].sort(() => Math.random() - 0.5).slice(0, pairs)
  let id = 0
  for (const emoji of symbols) {
    deck.push({ id: id++, emoji, matched: false, flipped: false })
    deck.push({ id: id++, emoji, matched: false, flipped: false })
  }
  return deck.sort(() => Math.random() - 0.5)
}

export default function MemoryPage() {
  const params = useSearchParams()
  const difficulty = (params.get('difficulty') as MemoryDifficulty | null) ?? 'medium'
  const { rows, cols } = SIZES[difficulty]

  const [deck, setDeck] = useState<Card[]>(() => buildDeck(difficulty))
  const [flipped, setFlipped] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [matches, setMatches] = useState(0)

  const reset = useCallback(() => {
    setDeck(buildDeck(difficulty))
    setFlipped([])
    setMoves(0)
    setMatches(0)
  }, [difficulty])

  useEffect(() => {
    reset()
  }, [difficulty, reset])

  const totalPairs = (rows * cols) / 2
  const won = matches === totalPairs

  function handleCard(index: number) {
    const card = deck[index]
    if (card.flipped || card.matched || flipped.length === 2) return
    const next = [...deck]
    next[index] = { ...card, flipped: true }
    const current = [...flipped, index]
    setDeck(next)
    setFlipped(current)

    if (current.length === 2) {
      setMoves((value) => value + 1)
      const [a, b] = current
      if (next[a].emoji === next[b].emoji) {
        setTimeout(() => {
          setDeck((cards) => {
            const updated = [...cards]
            updated[a] = { ...updated[a], matched: true }
            updated[b] = { ...updated[b], matched: true }
            return updated
          })
          setMatches((value) => value + 1)
          setFlipped([])
        }, 300)
      } else {
        setTimeout(() => {
          setDeck((cards) => {
            const updated = [...cards]
            updated[a] = { ...updated[a], flipped: false }
            updated[b] = { ...updated[b], flipped: false }
            return updated
          })
          setFlipped([])
        }, 800)
      }
    }
  }

  const cardSize = useMemo(() => {
    if (difficulty === 'hard') return 'h-12 w-12 text-xl'
    return 'h-16 w-16 text-2xl'
  }, [difficulty])

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <Link href="/games" className="text-sm text-[#D19A58]">
            ← Back to games
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/45">
                Memory · {difficulty}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Memory Match</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                Flip two cards at a time. Matched pairs stay open. Calming and forgiving.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">Moves {moves}</span>
              <span className="badge bg-[#6B8A83]/20 text-[#6B8A83]">Matched {matches}/{totalPairs}</span>
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center gap-5">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {deck.map((card, index) => (
              <button
                key={card.id}
                onClick={() => handleCard(index)}
                className={`${cardSize} flex items-center justify-center rounded-xl transition-all ${
                  card.flipped || card.matched
                    ? card.matched
                      ? 'bg-[#6B8A83]/40'
                      : 'bg-[#D19A58]/40'
                    : 'bg-[#eedfc8]/10 hover:bg-[#eedfc8]/18'
                }`}
                aria-label={`card-${card.id}`}
              >
                {card.flipped || card.matched ? card.emoji : ''}
              </button>
            ))}
          </div>

          {won && (
            <div className="rounded-2xl bg-[#6B8A83]/20 px-4 py-2 text-sm font-semibold text-[#6B8A83]">
              All matched in {moves} moves.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={reset} className="btn-primary !rounded-2xl !px-4 !py-2 text-sm">
              New board
            </button>
            <Link href="/games/memory?difficulty=easy" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Easy</Link>
            <Link href="/games/memory?difficulty=medium" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Medium</Link>
            <Link href="/games/memory?difficulty=hard" className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">Hard</Link>
          </div>
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
