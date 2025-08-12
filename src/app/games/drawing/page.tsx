'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

const WORDS = [
  'cat', 'dog', 'house', 'tree', 'car', 'sun', 'flower', 'book', 'phone', 'apple',
  'fish', 'bird', 'chair', 'table', 'computer', 'music', 'smile', 'heart', 'star', 'rainbow'
]

interface Player {
  id: string
  name: string
  avatar: string
  score: number
}

export default function DrawingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentWord, setCurrentWord] = useState('')
  const [timeLeft, setTimeLeft] = useState(60)
  const [gamePhase, setGamePhase] = useState<'waiting' | 'drawing' | 'guessing' | 'results'>('waiting')
  const [currentDrawer, setCurrentDrawer] = useState(0)
  const [guess, setGuess] = useState('')
  const [guesses, setGuesses] = useState<{player: string, guess: string, correct: boolean}[]>([])
  const [brushSize, setBrushSize] = useState(3)
  const [brushColor, setBrushColor] = useState('#000000')
  const [round, setRound] = useState(1)
  const [maxRounds] = useState(3)

  const [players] = useState<Player[]>([
    { id: '1', name: 'You', avatar: '👤', score: 0 },
    { id: '2', name: 'Emma', avatar: 'ET', score: 0 },
    { id: '3', name: 'Mike', avatar: 'MC', score: 0 },
    { id: '4', name: 'Sara', avatar: 'SW', score: 0 }
  ])

  const colors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500']

  useEffect(() => {
    if (gamePhase === 'drawing' || gamePhase === 'guessing') {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (gamePhase === 'drawing') {
              setGamePhase('guessing')
              return 30
            } else if (gamePhase === 'guessing') {
              setGamePhase('results')
              setTimeout(() => {
                nextRound()
              }, 3000)
              return 0
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [gamePhase, nextRound])

  const startGame = useCallback(() => {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)]
    setCurrentWord(word)
    setGamePhase('drawing')
    setTimeLeft(60)
    setGuesses([])
    clearCanvas()
  }, [])



  const nextRound = useCallback(() => {
    if (round >= maxRounds) {
      setGamePhase('waiting')
      setRound(1)
    } else {
      setRound(round + 1)
      setCurrentDrawer((currentDrawer + 1) % players.length)
      startGame()
    }
  }, [round, maxRounds, currentDrawer, players.length, startGame])

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gamePhase !== 'drawing' || currentDrawer !== 0) return
    
    const canvas = canvasRef.current
    if (canvas) {
      setIsDrawing(true)
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.lineWidth = brushSize
        ctx.strokeStyle = brushColor
      }
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || gamePhase !== 'drawing' || currentDrawer !== 0) return
    
    const canvas = canvasRef.current
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.lineTo(x, y)
        ctx.stroke()
      }
    }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const handleGuess = () => {
    if (guess.trim() === '' || currentDrawer === 0) return
    
    const isCorrect = guess.toLowerCase().trim() === currentWord.toLowerCase()
    const newGuess = {
      player: players[0].name,
      guess: guess.trim(),
      correct: isCorrect
    }
    
    setGuesses(prev => [...prev, newGuess])
    setGuess('')
    
    if (isCorrect) {
      setGamePhase('results')
      setTimeout(() => {
        nextRound()
      }, 2000)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <div className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md z-50 px-4 py-3 border-b border-purple-100">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <Link href="/games" className="w-8 h-8 flex items-center justify-center">
            <i className="ri-arrow-left-line text-xl text-gray-700"></i>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">Guess Drawing</h1>
          <div className="text-sm font-medium text-purple-600">
            Round {round}/{maxRounds}
          </div>
        </div>
      </div>

      <div className="pt-16 pb-4 px-4">
        <div className="max-w-sm mx-auto space-y-4">
          {gamePhase === 'waiting' && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-purple-100 text-center">
              <div className="text-4xl mb-4">🎨</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Drawing Game</h2>
              <p className="text-gray-600 mb-6">Draw and guess what others create!</p>
              <button 
                onClick={startGame}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium !rounded-button"
              >
                Start Game
              </button>
            </div>
          )}

          {(gamePhase === 'drawing' || gamePhase === 'guessing') && (
            <>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                      {players[currentDrawer].avatar}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {currentDrawer === 0 ? 'You are drawing' : `${players[currentDrawer].name} is drawing`}
                      </div>
                      {currentDrawer === 0 && gamePhase === 'drawing' && (
                        <div className="text-xs text-purple-600">Word: <strong>{currentWord}</strong></div>
                      )}
                    </div>
                  </div>
                  <div className="text-lg font-bold text-purple-600">
                    {formatTime(timeLeft)}
                  </div>
                </div>
                <div className="w-full bg-purple-100 rounded-full h-2">
                  <div 
                    className="bg-purple-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${(timeLeft / (gamePhase === 'drawing' ? 60 : 30)) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Drawing Canvas */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-100">
                <canvas
                  ref={canvasRef}
                  width={300}
                  height={200}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  className="w-full border border-gray-200 rounded cursor-crosshair"
                  style={{ aspectRatio: '3/2' }}
                />
                
                {currentDrawer === 0 && gamePhase === 'drawing' && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Size:</span>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-sm text-gray-600">{brushSize}px</span>
                    </div>
                    
                    <div className="flex gap-2 items-center">
                      <span className="text-sm text-gray-600">Color:</span>
                      {colors.map(color => (
                        <button
                          key={color}
                          onClick={() => setBrushColor(color)}
                          className={`w-6 h-6 rounded-full border-2 ${
                            brushColor === color ? 'border-purple-500' : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      <button
                        onClick={clearCanvas}
                        className="ml-2 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs !rounded-button"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Guessing Area */}
              {currentDrawer !== 0 && gamePhase === 'guessing' && (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-100">
                  <h3 className="font-semibold text-gray-900 mb-3">Make Your Guess</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={guess}
                      onChange={(e) => setGuess(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleGuess()}
                      placeholder="What do you think it is?"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg"
                    />
                    <button
                      onClick={handleGuess}
                      className="px-4 py-2 bg-purple-500 text-white rounded-lg font-medium !rounded-button"
                    >
                      Guess
                    </button>
                  </div>
                </div>
              )}

              {/* Guesses */}
              {guesses.length > 0 && (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-100">
                  <h3 className="font-semibold text-gray-900 mb-3">Guesses</h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {guesses.map((g, index) => (
                      <div key={index} className={`flex items-center justify-between p-2 rounded ${
                        g.correct ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <span className="text-sm">{g.player}: {g.guess}</span>
                        {g.correct && <span className="text-green-600 text-xs">✓ Correct!</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {gamePhase === 'results' && (
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl p-6 shadow-sm text-center">
              <div className="text-3xl mb-4">🎉</div>
              <h2 className="text-xl font-bold mb-2">Round Complete!</h2>
              <p className="text-green-100 mb-2">The word was: <strong>{currentWord}</strong></p>
              {guesses.some(g => g.correct) ? (
                <p className="text-green-100">Someone guessed correctly!</p>
              ) : (
                <p className="text-green-100">Nobody guessed it this time!</p>
              )}
            </div>
          )}

          {/* Players */}
          <div className="grid grid-cols-2 gap-3">
            {players.map((player, index) => (
              <div key={player.id} className={`bg-white rounded-lg p-3 shadow-sm border ${
                currentDrawer === index ? 'border-purple-400 bg-purple-50' : 'border-gray-100'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 ${index === 0 ? 'bg-blue-500' : 'bg-gray-500'} rounded-lg flex items-center justify-center text-white font-semibold text-xs`}>
                    {player.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{player.name}</div>
                    <div className="text-xs text-gray-500">Score: {player.score}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => {
                setGamePhase('waiting')
                setRound(1)
                setCurrentDrawer(0)
              }}
              className="flex-1 py-3 px-4 bg-purple-500 text-white rounded-lg font-medium !rounded-button"
            >
              New Game
            </button>
            <Link 
              href="/games"
              className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium !rounded-button text-center"
            >
              Back to Games
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}