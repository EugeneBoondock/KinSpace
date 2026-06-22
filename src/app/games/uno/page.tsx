'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import {
  aiChoose,
  canPlay,
  drawCard,
  labelFor,
  playCard,
  setupGame,
  type UnoCard,
  type UnoColor,
  type UnoState,
} from '@/lib/game-engines/uno'

const colorClass: Record<string, string> = {
  red: 'bg-[#B85C3A] text-[#eedfc8]',
  yellow: 'bg-[#D19A58] text-[#2A4A42]',
  green: 'bg-[#6B8A83] text-[#eedfc8]',
  blue: 'bg-[#3e6d88] text-[#eedfc8]',
  wild: 'bg-gradient-to-br from-[#B85C3A] via-[#D19A58] to-[#3e6d88] text-[#eedfc8]',
}

export default function UnoPage() {
  const [state, setState] = useState<UnoState>(() =>
    setupGame([
      { id: 'you', name: 'You', isAI: false },
      { id: 'ai1', name: 'Aiden', isAI: true },
      { id: 'ai2', name: 'Blaire', isAI: true },
      { id: 'ai3', name: 'Cory', isAI: true },
    ]),
  )
  const [colorPicker, setColorPicker] = useState<string | null>(null)

  const reset = useCallback(() => {
    setState(setupGame([
      { id: 'you', name: 'You', isAI: false },
      { id: 'ai1', name: 'Aiden', isAI: true },
      { id: 'ai2', name: 'Blaire', isAI: true },
      { id: 'ai3', name: 'Cory', isAI: true },
    ]))
    setColorPicker(null)
  }, [])

  useEffect(() => {
    if (state.winner) return
    const current = state.players[state.currentIndex]
    if (!current.isAI) return
    const timer = setTimeout(() => {
      const choice = aiChoose(state)
      if (choice.cardId) {
        setState(playCard(state, choice.cardId, choice.chosenColor))
      } else {
        setState(drawCard(state))
      }
    }, 600)
    return () => clearTimeout(timer)
  }, [state])

  const you = state.players.find((player) => player.id === 'you')!
  const myTurn = state.players[state.currentIndex].id === 'you' && !state.winner

  function handleCardClick(card: UnoCard) {
    if (!myTurn) return
    if (!canPlay(card, state)) return
    if (card.color === 'wild') {
      setColorPicker(card.id)
      return
    }
    setState(playCard(state, card.id))
  }

  function handleColorChoice(color: UnoColor) {
    if (!colorPicker) return
    setState(playCard(state, colorPicker, color))
    setColorPicker(null)
  }

  function handleDraw() {
    if (!myTurn) return
    setState(drawCard(state))
  }

  const topCard = state.discard[state.discard.length - 1]
  const opponents = useMemo(() => state.players.filter((player) => player.id !== 'you'), [state.players])

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <Link href="/games" className="text-sm text-[#D19A58]">
            ← Back to games
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/45">UNO</p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">UNO Cards</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                Four-player match with AI opponents. Match the active color or value. Action cards apply instantly.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">Active color: {state.activeColor}</span>
              <span className="badge">Deck {state.deck.length}</span>
              {state.drawStack > 0 && <span className="badge bg-[#B85C3A]/25 text-[#B85C3A]">Stack +{state.drawStack}</span>}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="grid gap-4 sm:grid-cols-3">
            {opponents.map((opponent) => (
              <div
                key={opponent.id}
                className={`rounded-2xl border border-[#eedfc8]/10 bg-[#eedfc8]/5 p-4 ${
                  state.players[state.currentIndex].id === opponent.id ? 'ring-2 ring-[#D19A58]/60' : ''
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">{opponent.name}</p>
                <p className="mt-2 text-2xl font-bold text-[#eedfc8]">{opponent.hand.length}</p>
                <p className="text-xs text-[#eedfc8]/45">cards in hand</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card flex flex-col items-center gap-5">
          <div className="flex items-center gap-4">
            <button
              onClick={handleDraw}
              disabled={!myTurn}
              className="flex h-28 w-20 items-center justify-center rounded-2xl bg-[#0f1f1b] text-xs font-semibold text-[#eedfc8]/70 disabled:opacity-50"
            >
              Draw
            </button>
            <div className={`flex h-28 w-20 items-center justify-center rounded-2xl px-2 text-center text-xs font-bold ${colorClass[topCard.color]}`}>
              <span className="leading-tight">{labelFor(topCard)}</span>
            </div>
          </div>

          <p className="text-xs text-[#eedfc8]/55">{state.lastAction}</p>

          {state.winner ? (
            <div className="rounded-2xl bg-[#eedfc8]/10 px-4 py-3 text-sm font-semibold text-[#D19A58]">
              {state.winner === 'you' ? 'You won!' : `${state.players.find((player) => player.id === state.winner)?.name} wins.`}
              <button onClick={reset} className="ml-3 text-[#D19A58] underline">
                Play again
              </button>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/40">Your hand</p>
              <div className="flex flex-wrap justify-center gap-2">
                {you.hand.map((card) => {
                  const disabled = !myTurn || !canPlay(card, state)
                  return (
                    <button
                      key={card.id}
                      onClick={() => handleCardClick(card)}
                      disabled={disabled}
                      aria-label={`Play ${labelFor(card)}`}
                      className={`flex h-24 w-16 items-center justify-center rounded-xl px-1 text-center text-[10px] font-bold transition-transform ${colorClass[card.color]} ${
                        disabled ? 'opacity-50' : 'hover:-translate-y-1'
                      }`}
                    >
                      <span className="leading-tight">{labelFor(card)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {colorPicker && (
            <div className="flex gap-2">
              {(['red', 'yellow', 'green', 'blue'] as UnoColor[]).map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorChoice(color)}
                  className={`h-10 w-10 rounded-full ${colorClass[color]}`}
                  aria-label={color}
                />
              ))}
            </div>
          )}

          <button onClick={reset} className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">
            New game
          </button>
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
