'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

const WORDS = [
  'cat', 'dog', 'house', 'tree', 'car', 'sun', 'flower', 'book', 'phone', 'apple',
  'fish', 'bird', 'chair', 'table', 'computer', 'music', 'smile', 'heart', 'star', 'rainbow',
  'mountain', 'ocean', 'pizza', 'rocket', 'piano', 'dragon', 'castle', 'robot', 'umbrella', 'bicycle',
]

const COLORS = ['#eedfc8', '#F87171', '#34D399', '#60A5FA', '#FBBF24', '#A78BFA', '#F472B6', '#FB923C']
const SIZES = [2, 5, 10]

export default function DrawingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  const [word, setWord] = useState('')
  const [timeLeft, setTimeLeft] = useState(60)
  const [phase, setPhase] = useState<'idle' | 'drawing' | 'guessing' | 'result'>('idle')
  const [color, setColor] = useState('#eedfc8')
  const [size, setSize] = useState(5)
  const [score, setScore] = useState(0)
  const [round, setRound] = useState(0)
  const [aiGuesses, setAiGuesses] = useState<string[]>([])
  const [aiCorrect, setAiCorrect] = useState(false)

  // Timer
  useEffect(() => {
    if (phase !== 'drawing') return
    if (timeLeft <= 0) {
      setPhase('guessing')
      doAiGuess()
      return
    }
    const t = setTimeout(() => setTimeLeft(p => p - 1), 1000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft])

  const doAiGuess = () => {
    const guesses: string[] = []
    const pool = WORDS.filter(w => w !== word)
    // AI makes 3 guesses, last one might be correct
    for (let i = 0; i < 2; i++) {
      const w = pool[Math.floor(Math.random() * pool.length)]
      guesses.push(w)
    }
    const correct = Math.random() > 0.4
    if (correct) {
      guesses.push(word)
      setAiCorrect(true)
    } else {
      guesses.push(pool[Math.floor(Math.random() * pool.length)])
      setAiCorrect(false)
    }

    setAiGuesses([])
    guesses.forEach((g, i) => {
      setTimeout(() => {
        setAiGuesses(prev => [...prev, g])
        if (i === guesses.length - 1) {
          setTimeout(() => {
            if (correct) setScore(s => s + 100)
            setPhase('result')
          }, 1500)
        }
      }, (i + 1) * 2000)
    })
  }

  const startRound = () => {
    const w = WORDS[Math.floor(Math.random() * WORDS.length)]
    setWord(w)
    setTimeLeft(60)
    setPhase('drawing')
    setRound(r => r + 1)
    setAiGuesses([])
    setAiCorrect(false)
    clearCanvas()
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#1a3029'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    if (phase !== 'drawing') return
    e.preventDefault()
    drawing.current = true
    lastPos.current = getPos(e)
  }

  const moveDraw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing.current || phase !== 'drawing') return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !lastPos.current) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = color
    ctx.lineWidth = size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    lastPos.current = pos
  }

  const endDraw = () => { drawing.current = false; lastPos.current = null }

  // Init canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = 600
    canvas.height = 600
    const ctx = canvas.getContext('2d')
    if (ctx) { ctx.fillStyle = '#1a3029'; ctx.fillRect(0, 0, 600, 600) }
  }, [])

  return (
    <div className="min-h-screen bg-brand-primary flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-brand-primary/95 backdrop-blur-md border-b border-[#eedfc8]/10 px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <Link href="/games" className="text-[#eedfc8]/70"><i className="ri-arrow-left-line text-xl" /></Link>
          <h1 className="text-[#eedfc8] font-bold text-sm">Draw & Guess {round > 0 && `- Round ${round}`}</h1>
          <div className="flex items-center gap-2">
            <span className="text-brand-accent2 font-bold text-sm">{score} pts</span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 pt-4 max-w-md mx-auto w-full space-y-3 pb-8">
        {phase === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
            <div className="text-5xl mb-4">&#x1F3A8;</div>
            <h2 className="text-[#eedfc8] text-xl font-bold mb-2">Draw & Guess</h2>
            <p className="text-[#eedfc8]/60 text-sm mb-6 max-w-xs">Draw the word and the AI will try to guess what it is!</p>
            {round > 0 && <p className="text-[#eedfc8]/40 text-sm mb-4">Score: {score} points</p>}
            <button onClick={startRound} className="btn-primary px-8 py-3">
              {round === 0 ? 'Start Game' : 'Next Round'}
            </button>
          </div>
        )}

        {(phase === 'drawing' || phase === 'guessing') && (
          <>
            {/* Word + Timer */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[#eedfc8]/50 text-xs">Draw this word:</p>
                <p className="text-brand-accent2 font-bold text-lg tracking-widest uppercase">{word}</p>
              </div>
              <div className={`text-2xl font-bold font-mono ${timeLeft <= 10 ? 'text-red-400' : 'text-[#eedfc8]'}`}>
                {phase === 'drawing' ? timeLeft : ''}
              </div>
            </div>

            {/* Canvas */}
            <div className="rounded-xl overflow-hidden border-2 border-[#eedfc8]/15">
              <canvas
                ref={canvasRef}
                className="w-full aspect-square cursor-crosshair touch-none"
                onMouseDown={startDraw}
                onMouseMove={moveDraw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={moveDraw}
                onTouchEnd={endDraw}
              />
            </div>

            {/* Drawing tools */}
            {phase === 'drawing' && (
              <div className="card flex items-center justify-between">
                <div className="flex gap-1.5">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setColor(c)} className={`w-7 h-7 rounded-full border-2 transition ${color === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
                <div className="flex gap-1.5 items-center">
                  {SIZES.map(s => (
                    <button key={s} onClick={() => setSize(s)} className={`w-7 h-7 rounded-full flex items-center justify-center transition ${size === s ? 'bg-[#eedfc8]/20' : ''}`}>
                      <div className="rounded-full bg-[#eedfc8]" style={{ width: s * 2, height: s * 2 }} />
                    </button>
                  ))}
                  <button onClick={clearCanvas} className="ml-2 text-[#eedfc8]/50 hover:text-[#eedfc8]"><i className="ri-delete-bin-line" /></button>
                </div>
              </div>
            )}

            {/* AI guessing */}
            {phase === 'guessing' && aiGuesses.length > 0 && (
              <div className="card">
                <p className="text-[#eedfc8]/50 text-xs mb-2">AI is guessing...</p>
                <div className="space-y-2">
                  {aiGuesses.map((g, i) => (
                    <div key={i} className={`flex items-center gap-2 py-1.5 px-3 rounded-lg text-sm ${g === word ? 'bg-green-500/20 text-green-300' : 'bg-[#eedfc8]/5 text-[#eedfc8]/70'}`}>
                      <span>&#x1F916;</span>
                      <span className="capitalize">{g}</span>
                      {g === word && <i className="ri-check-line ml-auto text-green-400" />}
                      {g !== word && <i className="ri-close-line ml-auto text-red-400/50" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {phase === 'result' && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
            <div className="text-5xl mb-4">{aiCorrect ? '&#x1F389;' : '&#x1F914;'}</div>
            <h2 className="text-[#eedfc8] text-xl font-bold mb-2">
              {aiCorrect ? 'AI Guessed It!' : 'AI Failed!'}
            </h2>
            <p className="text-[#eedfc8]/60 text-sm mb-2">The word was: <span className="text-brand-accent2 font-bold uppercase">{word}</span></p>
            {aiCorrect && <p className="text-green-400 font-semibold mb-4">+100 points!</p>}
            <button onClick={startRound} className="btn-primary px-8 py-3 mt-4">Next Round</button>
          </div>
        )}
      </div>
    </div>
  )
}
