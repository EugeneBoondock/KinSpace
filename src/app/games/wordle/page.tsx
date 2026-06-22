'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'
import { playSfx } from '@/lib/audio/sfx'
import { WORDLE_WORDS } from '@/lib/game-data/wordle-words'

type LetterState = 'correct' | 'present' | 'absent' | 'empty'
type GameStatus = 'playing' | 'won' | 'lost'

const MAX_ROUNDS = 6
const WORD_LENGTH = 5

const VALID_WORDS = WORDLE_WORDS.filter((word) => word.length === WORD_LENGTH && /^[A-Z]{5}$/.test(word))

function pickWord(): string {
  return VALID_WORDS[Math.floor(Math.random() * VALID_WORDS.length)]
}

function evaluateGuess(guess: string, answer: string): LetterState[] {
  const result: LetterState[] = Array(WORD_LENGTH).fill('absent')
  const answerChars = answer.split('')
  const guessChars = guess.split('')

  // First pass - correct
  for (let index = 0; index < WORD_LENGTH; index += 1) {
    if (guessChars[index] === answerChars[index]) {
      result[index] = 'correct'
      answerChars[index] = '_'
    }
  }
  // Second pass - present
  for (let index = 0; index < WORD_LENGTH; index += 1) {
    if (result[index] === 'correct') continue
    const position = answerChars.indexOf(guessChars[index])
    if (position > -1) {
      result[index] = 'present'
      answerChars[position] = '_'
    }
  }
  return result
}

const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']

export default function WordlePage() {
  const [answer, setAnswer] = useState<string>(() => pickWord())
  const [guesses, setGuesses] = useState<string[]>([])
  const [currentGuess, setCurrentGuess] = useState('')
  const [status, setStatus] = useState<GameStatus>('playing')

  const reset = useCallback(() => {
    setAnswer(pickWord())
    setGuesses([])
    setCurrentGuess('')
    setStatus('playing')
  }, [])

  const submitGuess = useCallback(() => {
    if (status !== 'playing') return
    if (currentGuess.length !== WORD_LENGTH) return
    const guess = currentGuess.toUpperCase()
    const next = [...guesses, guess]
    setGuesses(next)
    setCurrentGuess('')
    if (guess === answer) {
      setStatus('won')
      playSfx('win')
    } else if (next.length >= MAX_ROUNDS) {
      setStatus('lost')
      playSfx('lose')
    } else {
      playSfx('move')
    }
  }, [answer, currentGuess, guesses, status])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (status !== 'playing') return
      const key = event.key.toUpperCase()
      if (key === 'ENTER') {
        event.preventDefault()
        submitGuess()
        return
      }
      if (key === 'BACKSPACE') {
        setCurrentGuess((value) => value.slice(0, -1))
        return
      }
      if (key.length === 1 && /[A-Z]/.test(key) && currentGuess.length < WORD_LENGTH) {
        setCurrentGuess((value) => value + key)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [currentGuess, status, submitGuess])

  const keyStates = useMemo(() => {
    const states = new Map<string, LetterState>()
    for (const guess of guesses) {
      const evaluation = evaluateGuess(guess, answer)
      for (let index = 0; index < guess.length; index += 1) {
        const letter = guess[index]
        const current = states.get(letter)
        const next = evaluation[index]
        if (current === 'correct') continue
        if (current === 'present' && next === 'absent') continue
        states.set(letter, next)
      }
    }
    return states
  }, [guesses, answer])

  function pressKey(key: string) {
    if (status !== 'playing') return
    if (key === 'ENTER') return submitGuess()
    if (key === 'BACK') return setCurrentGuess((value) => value.slice(0, -1))
    if (currentGuess.length < WORD_LENGTH) setCurrentGuess((value) => value + key)
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/45">Five-letter focus</p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Wordle</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                Fresh word each game. You have six guesses. Use your keyboard or tap the on-screen keys.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">Round {guesses.length} / {MAX_ROUNDS}</span>
              <span className="badge">Dictionary {VALID_WORDS.length.toLocaleString()} words</span>
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center gap-5">
          <div className="grid grid-rows-6 gap-2">
            {Array.from({ length: MAX_ROUNDS }).map((_, rowIndex) => {
              const guess = guesses[rowIndex]
              const isCurrent = rowIndex === guesses.length
              const display = guess ? guess.split('') : (isCurrent ? currentGuess.padEnd(WORD_LENGTH).split('') : Array(WORD_LENGTH).fill(''))
              const evaluation = guess ? evaluateGuess(guess, answer) : null
              return (
                <div key={rowIndex} className="grid grid-cols-5 gap-2">
                  {display.map((letter, colIndex) => {
                    const state: LetterState = evaluation ? evaluation[colIndex] : 'empty'
                    const cls =
                      state === 'correct'
                        ? 'bg-[#6B8A83] text-[#eedfc8]'
                        : state === 'present'
                          ? 'bg-[#D19A58] text-[#2A4A42]'
                          : state === 'absent'
                            ? 'bg-[#0f1f1b] text-[#eedfc8]/40'
                            : 'border border-[#eedfc8]/15 bg-[#eedfc8]/4 text-[#eedfc8]'
                    return (
                      <div
                        key={colIndex}
                        className={`flex h-14 w-14 items-center justify-center rounded-xl text-2xl font-bold uppercase ${cls}`}
                      >
                        {letter.trim()}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          <div className="flex flex-col gap-1.5">
            {KEY_ROWS.map((row, rowIndex) => (
              <div key={row} className="flex justify-center gap-1">
                {rowIndex === 2 && (
                  <button
                    onClick={() => pressKey('ENTER')}
                    className="rounded-md bg-[#eedfc8]/10 px-3 py-3 text-xs font-semibold text-[#eedfc8] hover:bg-[#eedfc8]/20"
                  >
                    ENTER
                  </button>
                )}
                {row.split('').map((key) => {
                  const state = keyStates.get(key)
                  const cls =
                    state === 'correct'
                      ? 'bg-[#6B8A83] text-[#eedfc8]'
                      : state === 'present'
                        ? 'bg-[#D19A58] text-[#2A4A42]'
                        : state === 'absent'
                          ? 'bg-[#0f1f1b] text-[#eedfc8]/40'
                          : 'bg-[#eedfc8]/10 text-[#eedfc8] hover:bg-[#eedfc8]/20'
                  return (
                    <button
                      key={key}
                      onClick={() => pressKey(key)}
                      className={`rounded-md px-3 py-3 text-sm font-semibold ${cls}`}
                    >
                      {key}
                    </button>
                  )
                })}
                {rowIndex === 2 && (
                  <button
                    onClick={() => pressKey('BACK')}
                    className="rounded-md bg-[#eedfc8]/10 px-3 py-3 text-xs font-semibold text-[#eedfc8] hover:bg-[#eedfc8]/20"
                  >
                    ⌫
                  </button>
                )}
              </div>
            ))}
          </div>

          {status !== 'playing' && (
            <div className="rounded-2xl bg-[#eedfc8]/8 px-4 py-2 text-sm font-semibold text-[#D19A58]">
              {status === 'won'
                ? `Solved in ${guesses.length} ${guesses.length === 1 ? 'guess' : 'guesses'}.`
                : `The word was ${answer}.`}
            </div>
          )}

          <button onClick={reset} className="btn-primary !rounded-2xl !px-4 !py-2 text-sm">
            New word
          </button>
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
