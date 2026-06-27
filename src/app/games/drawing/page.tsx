'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import PageFrame from '@/components/PageFrame'

const PROMPTS = [
  'cat', 'house', 'tree', 'star', 'sun', 'moon', 'flower', 'cloud',
  'bird', 'fish', 'heart', 'car', 'boat', 'hat', 'book', 'apple',
  'banana', 'cup', 'chair', 'table', 'phone', 'clock', 'key', 'shoe',
  'smiley face', 'rainbow', 'pencil', 'lightbulb', 'ghost', 'pizza',
  'balloon', 'mountain', 'bicycle', 'kite', 'umbrella', 'leaf', 'cactus',
  'snowman', 'coffee mug', 'stairs',
]

type Status = 'drawing' | 'reveal'

function randomPrompt() {
  return PROMPTS[Math.floor(Math.random() * PROMPTS.length)]
}

export default function DrawingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [prompt, setPrompt] = useState<string>(() => randomPrompt())
  const [status, setStatus] = useState<Status>('drawing')
  const [drawing, setDrawing] = useState(false)
  const [color, setColor] = useState('#eedfc8')
  const [brush, setBrush] = useState(4)

  const newRound = useCallback(() => {
    setPrompt(randomPrompt())
    setStatus('drawing')
    const canvas = canvasRef.current
    if (canvas) {
      const context = canvas.getContext('2d')
      context?.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [])

  function startDraw(event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (status !== 'drawing') return
    setDrawing(true)
    const point = getPoint(event)
    const context = canvasRef.current?.getContext('2d')
    if (context && point) {
      context.beginPath()
      context.moveTo(point.x, point.y)
    }
  }

  function continueDraw(event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!drawing) return
    const point = getPoint(event)
    const context = canvasRef.current?.getContext('2d')
    if (!context || !point) return
    context.strokeStyle = color
    context.lineWidth = brush
    context.lineCap = 'round'
    context.lineTo(point.x, point.y)
    context.stroke()
  }

  function stopDraw() {
    setDrawing(false)
  }

  function getPoint(event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if ('touches' in event) {
      const touch = event.touches[0] ?? event.changedTouches[0]
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
    }
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function clear() {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    context?.clearRect(0, 0, canvas.width, canvas.height)
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedfc8]/45">
                Draw & Guess
              </p>
              <h1 className="mt-2 text-3xl font-bold text-[#eedfc8]">Draw & Guess</h1>
              <p className="mt-2 max-w-xl text-sm text-[#eedfc8]/60">
                A prompt-word warm-up. Great as a solo focus break or shared in a group room.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="badge">Prompt</span>
              <span className="badge bg-[#D19A58]/15 text-[#D19A58]">
                {status === 'drawing' ? prompt : `It was: ${prompt}`}
              </span>
            </div>
          </div>
        </section>

        <section className="card flex flex-col items-center gap-4">
          <canvas
            ref={canvasRef}
            width={560}
            height={420}
            className="touch-none rounded-2xl border border-[#eedfc8]/12 bg-[#0f1f1b]"
            onMouseDown={startDraw}
            onMouseMove={continueDraw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={continueDraw}
            onTouchEnd={stopDraw}
          />

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
              {['#eedfc8', '#B85C3A', '#D19A58', '#6B8A83', '#0f1f1b'].map((hex) => (
                <button
                  key={hex}
                  onClick={() => setColor(hex)}
                  className={`h-8 w-8 rounded-full border ${color === hex ? 'border-[#D19A58]' : 'border-[#eedfc8]/20'}`}
                  style={{ background: hex }}
                  aria-label={`color-${hex}`}
                />
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-[#eedfc8]/60">
              Brush
              <input
                type="range"
                min={1}
                max={24}
                value={brush}
                onChange={(event) => setBrush(Number(event.target.value))}
              />
            </label>
            <button onClick={clear} className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm">
              Clear
            </button>
            <button
              onClick={() => setStatus(status === 'drawing' ? 'reveal' : 'drawing')}
              className="btn-secondary !rounded-2xl !px-4 !py-2 text-sm"
            >
              {status === 'drawing' ? 'Reveal prompt' : 'Hide prompt'}
            </button>
            <button onClick={newRound} className="btn-primary !rounded-2xl !px-4 !py-2 text-sm">
              New prompt
            </button>
          </div>
        </section>
      </div>

      <BottomNav />
    </PageFrame>
  )
}
