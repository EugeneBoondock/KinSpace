'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState } from 'react'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { useAuth } from '@/lib/AuthContext'
import { DatabaseService } from '@/lib/database'

const Tetris = dynamic(() => import('react-tetris'), { ssr: false }) as unknown as React.ComponentType<{
  keyboardControls?: Record<string, string>
  children: (params: TetrisRenderParams) => React.ReactElement
}>

type TetrisRenderParams = {
  HeldPiece: React.ComponentType
  Gameboard: React.ComponentType
  PieceQueue: React.ComponentType
  points: number
  linesCleared: number
  level: number
  state: 'PAUSED' | 'PLAYING' | 'LOST'
  controller: {
    hold: () => void
    hardDrop: () => void
    moveDown: () => void
    moveLeft: () => void
    moveRight: () => void
    flipClockwise: () => void
    pause: () => void
    resume: () => void
    restart: () => void
  }
}

export default function TetrisPage() {
  const { user } = useAuth()
  const [best, setBest] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    const stored = localStorage.getItem('kinspace:tetris:best')
    return stored ? Number.parseInt(stored, 10) || 0 : 0
  })

  function handleScoreChange(points: number) {
    if (points <= best) return
    setBest(points)
    if (typeof window !== 'undefined') {
      localStorage.setItem('kinspace:tetris:best', String(points))
    }
    if (user) DatabaseService.recordGameScore(user.userId, 'tetris', points).catch(() => undefined)
  }

  return (
    <PageFrame>
      <div className="page-grid">
        <section className="card">
          <Link href="/games" className="text-sm font-medium text-brand-accent2">
            Back to games
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink/45">Tetris</p>
              <h1 className="mt-2 text-3xl font-bold text-brand-ink">Tetris</h1>
              <p className="mt-2 max-w-xl text-sm text-brand-ink/65">
                Classic falling blocks. Arrow keys move, up rotates, down soft drops, space hard drops.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge-gold">Best {best}</span>
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center gap-5 overflow-hidden">
          <Tetris
            keyboardControls={{
              down: 'MOVE_DOWN',
              left: 'MOVE_LEFT',
              right: 'MOVE_RIGHT',
              space: 'HARD_DROP',
              z: 'FLIP_COUNTERCLOCKWISE',
              x: 'FLIP_CLOCKWISE',
              up: 'FLIP_CLOCKWISE',
              p: 'TOGGLE_PAUSE',
              c: 'HOLD',
              shift: 'HOLD',
            }}
          >
            {({ HeldPiece, Gameboard, PieceQueue, points, linesCleared, state, controller }: TetrisRenderParams) => {
              if (state === 'LOST' && points > best) handleScoreChange(points)
              return (
                <div className="tetris-game-panel flex w-full flex-col items-center gap-5">
                  <div className="grid w-full max-w-3xl grid-cols-1 items-start gap-4 md:grid-cols-[7rem_minmax(13rem,auto)_7rem] md:justify-center">
                    <div className="order-2 grid grid-cols-3 gap-3 text-xs text-brand-ink/70 md:order-1 md:block md:space-y-4">
                      <div>
                        <p className="uppercase tracking-[0.18em] text-brand-ink/45">Held</p>
                        <HeldPiece />
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.18em] text-brand-ink/45">Points</p>
                        <p className="text-2xl font-bold text-brand-ink">{points}</p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.18em] text-brand-ink/45">Lines</p>
                        <p className="text-lg font-semibold text-brand-ink">{linesCleared}</p>
                      </div>
                    </div>

                    <div
                      className="tetris-board-shell order-1 rounded-2xl border border-brand-line-strong bg-brand-surface-sunken p-2 shadow-inner md:order-2"
                      aria-label="Tetris board"
                    >
                      <Gameboard />
                    </div>

                    <div className="order-3 space-y-3 justify-self-center">
                      <p className="text-xs uppercase tracking-[0.18em] text-brand-ink/45">Next</p>
                      <PieceQueue />
                    </div>
                  </div>

                  {state === 'LOST' && (
                    <div className="rounded-2xl bg-brand-crisis/15 px-4 py-2 text-sm font-semibold text-brand-crisis">
                      Game over. {points} points.
                      <button onClick={controller.restart} className="ml-3 underline">
                        Restart
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-5 gap-2 sm:hidden" aria-label="Tetris touch controls">
                    <button onClick={controller.moveLeft} className="btn-secondary !rounded-2xl !px-3 !py-2" aria-label="Move left">
                      <i className="ri-arrow-left-line" aria-hidden="true" />
                    </button>
                    <button onClick={controller.flipClockwise} className="btn-secondary !rounded-2xl !px-3 !py-2" aria-label="Rotate">
                      <i className="ri-refresh-line" aria-hidden="true" />
                    </button>
                    <button onClick={controller.moveDown} className="btn-secondary !rounded-2xl !px-3 !py-2" aria-label="Move down">
                      <i className="ri-arrow-down-line" aria-hidden="true" />
                    </button>
                    <button onClick={controller.moveRight} className="btn-secondary !rounded-2xl !px-3 !py-2" aria-label="Move right">
                      <i className="ri-arrow-right-line" aria-hidden="true" />
                    </button>
                    <button onClick={controller.hardDrop} className="btn-secondary !rounded-2xl !px-3 !py-2" aria-label="Hard drop">
                      <i className="ri-arrow-down-double-line" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2">
                    {state === 'PLAYING' && (
                      <button onClick={controller.pause} className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">
                        Pause
                      </button>
                    )}
                    {state === 'PAUSED' && (
                      <button onClick={controller.resume} className="btn-primary !rounded-2xl !px-4 !py-2 text-sm">
                        Resume
                      </button>
                    )}
                    <button onClick={controller.hold} className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">
                      Hold
                    </button>
                    <button onClick={controller.restart} className="btn-primary !rounded-2xl !px-4 !py-2 text-sm">
                      Restart
                    </button>
                  </div>
                </div>
              )
            }}
          </Tetris>
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
