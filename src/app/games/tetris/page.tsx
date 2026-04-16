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
          <Link href="/games" className="text-sm text-[#D19A58]">
            ← Back to games
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/45">Tetris</p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Tetris</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                Classic falling blocks. Arrow keys move, up rotates, down soft-drops, space hard-drops.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge bg-[#D19A58]/15 text-[#D19A58]">Best {best}</span>
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center gap-5">
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
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-start gap-6">
                    <div className="space-y-3 text-xs text-[#eedfc8]/70">
                      <div>
                        <p className="uppercase tracking-[0.18em] text-[#eedfc8]/40">Held</p>
                        <HeldPiece />
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.18em] text-[#eedfc8]/40">Points</p>
                        <p className="text-2xl font-bold text-[#eedfc8]">{points}</p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.18em] text-[#eedfc8]/40">Lines</p>
                        <p className="text-lg font-semibold text-[#eedfc8]">{linesCleared}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#eedfc8]/15 bg-[#0f1f1b] p-2">
                      <Gameboard />
                    </div>

                    <div className="space-y-3">
                      <p className="uppercase tracking-[0.18em] text-xs text-[#eedfc8]/40">Next</p>
                      <PieceQueue />
                    </div>
                  </div>

                  {state === 'LOST' && (
                    <div className="rounded-2xl bg-[#B85C3A]/20 px-4 py-2 text-sm font-semibold text-[#B85C3A]">
                      Game over — {points} points.
                      <button onClick={controller.restart} className="ml-3 underline">
                        Restart
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
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
