'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// AI difficulty levels
const AI_LEVELS = {
  easy: { randomness: 0.7 },    // 70% random moves
  medium: { randomness: 0.3 },  // 30% random moves  
  hard: { randomness: 0 }       // Always optimal moves
}

export default function TicTacToePage() {
  const [board, setBoard] = useState(Array(9).fill(null))
  const [currentPlayer, setCurrentPlayer] = useState('X')
  const [gameStatus, setGameStatus] = useState('active')
  const [winner, setWinner] = useState<string | null>(null)
  const [isAIGame, setIsAIGame] = useState(false)
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  
  const players = [
    { id: '1', name: 'Emma Thompson', avatar: 'ET', symbol: 'X', color: 'text-blue-500' },
    { id: '2', name: 'Michael Chen', avatar: 'MC', symbol: 'O', color: 'text-red-500' }
  ]

  // Check URL parameters for AI mode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mode = params.get('mode')
    const difficulty = params.get('difficulty') as 'easy' | 'medium' | 'hard'
    
    if (mode === 'ai') {
      setIsAIGame(true)
      if (difficulty) {
        setAiDifficulty(difficulty)
      }
    }
  }, [])

  const checkWinner = useCallback((squares: (string | null)[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ]

    for (const [a, b, c] of lines) {
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a]
      }
    }

    if (squares.every(square => square !== null)) {
      return 'tie'
    }

    return null
  }, [])

  // Minimax algorithm for AI
  const minimax = useCallback((squares: (string | null)[], isMaximizing: boolean): number => {
    const winner = checkWinner(squares)
    
    if (winner === 'O') return 1
    if (winner === 'X') return -1
    if (winner === 'tie') return 0
    
    if (isMaximizing) {
      let bestScore = -Infinity
      for (let i = 0; i < 9; i++) {
        if (squares[i] === null) {
          squares[i] = 'O'
          const score = minimax(squares, false)
          squares[i] = null
          bestScore = Math.max(score, bestScore)
        }
      }
      return bestScore
    } else {
      let bestScore = Infinity
      for (let i = 0; i < 9; i++) {
        if (squares[i] === null) {
          squares[i] = 'X'
          const score = minimax(squares, true)
          squares[i] = null
          bestScore = Math.min(score, bestScore)
        }
      }
      return bestScore
    }
  }, [checkWinner])



  // AI move effect
  useEffect(() => {
    if (isAIGame && currentPlayer === 'O' && gameStatus === 'active') {
      const timer = setTimeout(() => {
        const { randomness } = AI_LEVELS[aiDifficulty]
        
        // Random move for easier difficulties
        if (Math.random() < randomness) {
          const availableMoves = board.map((square, index) => square === null ? index : null)
            .filter(index => index !== null) as number[]
          const bestMove = availableMoves[Math.floor(Math.random() * availableMoves.length)]
          handleSquareClick(bestMove, true)
        } else {
          // Optimal move using minimax
          let bestScore = -Infinity
          let bestMove = 0
          
          for (let i = 0; i < 9; i++) {
            if (board[i] === null) {
              const newBoard = [...board]
              newBoard[i] = 'O'
              const score = minimax(newBoard, false)
              
              if (score > bestScore) {
                bestScore = score
                bestMove = i
              }
            }
          }
          
          handleSquareClick(bestMove, true)
        }
      }, 500 + Math.random() * 1000) // Random delay for realism
      
      return () => clearTimeout(timer)
    }
  }, [currentPlayer, isAIGame, gameStatus, board, aiDifficulty, handleSquareClick, minimax])

  const handleSquareClick = useCallback((index: number, isAIMove = false) => {
    if (board[index] || gameStatus !== 'active') return
    if (isAIGame && currentPlayer === 'O' && !isAIMove) return

    const newBoard = [...board]
    newBoard[index] = currentPlayer
    setBoard(newBoard)

    const gameWinner = checkWinner(newBoard)
    if (gameWinner) {
      setWinner(gameWinner)
      setGameStatus('finished')
    } else {
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X')
    }
  }, [board, gameStatus, isAIGame, currentPlayer, setBoard, setWinner, setGameStatus, setCurrentPlayer, checkWinner])

  const resetGame = () => {
    setBoard(Array(9).fill(null))
    setCurrentPlayer('X')
    setGameStatus('active')
    setWinner(null)
  }

  const currentPlayerInfo = players.find(p => p.symbol === currentPlayer)
  const winnerInfo = winner && winner !== 'tie' ? players.find(p => p.symbol === winner) : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md z-50 px-4 py-3 border-b border-blue-100">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <Link href="/games" className="w-8 h-8 flex items-center justify-center">
            <i className="ri-arrow-left-line text-xl text-gray-700"></i>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">
            Tic Tac Toe {isAIGame && `(vs AI - ${aiDifficulty})`}
          </h1>
          <button onClick={resetGame} className="w-8 h-8 flex items-center justify-center">
            <i className="ri-refresh-line text-xl text-gray-700"></i>
          </button>
        </div>
      </div>

      <div className="pt-16 pb-4 px-4">
        <div className="max-w-sm mx-auto space-y-6">
          {gameStatus === 'active' && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${currentPlayer === 'X' ? 'bg-blue-500' : 'bg-red-500'} rounded-lg flex items-center justify-center text-white font-semibold text-sm`}>
                  {isAIGame && currentPlayer === 'O' ? '🤖' : currentPlayerInfo?.avatar}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {isAIGame && currentPlayer === 'O' ? `AI (${aiDifficulty})` : currentPlayerInfo?.name}
                  </div>
                  <div className="text-sm text-gray-500">Turn to play {currentPlayer}</div>
                </div>
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          )}

          {gameStatus === 'finished' && (
            <div className={`rounded-xl p-4 shadow-sm ${
              winner === 'tie' 
                ? 'bg-gray-100 border border-gray-200' 
                : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
            }`}>
              <div className="text-center">
                {winner === 'tie' ? (
                  <div>
                    <div className="text-2xl mb-2">🤝</div>
                    <h3 className="font-bold text-lg text-gray-900">It&apos;s a Tie!</h3>
                    <p className="text-gray-600">Great game, both played well</p>
                  </div>
                ) : (
                  <div>
                    <div className="text-2xl mb-2">🎉</div>
                    <h3 className="font-bold text-lg">
                      {isAIGame && winner === 'O' ? 'AI Wins!' : 
                       isAIGame && winner === 'X' ? 'You Win!' : 
                       `${winnerInfo?.name} Wins!`}
                    </h3>
                    <p className="text-green-100">Playing as {winner}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl p-6 shadow-sm border border-blue-100">
            <div className="grid grid-cols-3 gap-2 aspect-square">
              {board.map((square, index) => (
                <button
                  key={index}
                  onClick={() => handleSquareClick(index)}
                  className={`
                    aspect-square bg-gray-50 rounded-lg border-2 border-gray-200
                    flex items-center justify-center text-4xl font-bold
                    transition-all duration-200 hover:bg-gray-100
                    ${square === 'X' ? 'text-blue-500 bg-blue-50 border-blue-200' : ''}
                    ${square === 'O' ? 'text-red-500 bg-red-50 border-red-200' : ''}
                    ${!square && gameStatus === 'active' && (!isAIGame || currentPlayer === 'X') ? 'hover:border-purple-300' : ''}
                  `}
                  disabled={square !== null || gameStatus !== 'active' || (isAIGame && currentPlayer === 'O')}
                >
                  {square}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Players</h3>
            <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-semibold text-xs">
                  {players[0].avatar}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{players[0].name}</div>
                  <div className="text-sm text-gray-500">Playing as X</div>
                </div>
                {currentPlayer === 'X' && gameStatus === 'active' && (
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                )}
                {winner === 'X' && (
                  <div className="text-green-500 font-semibold text-sm">Winner!</div>
                )}
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center text-white font-semibold text-xs">
                  {isAIGame ? '🤖' : players[1].avatar}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {isAIGame ? `AI (${aiDifficulty})` : players[1].name}
                  </div>
                  <div className="text-sm text-gray-500">Playing as O</div>
                </div>
                {currentPlayer === 'O' && gameStatus === 'active' && (
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                )}
                {winner === 'O' && (
                  <div className="text-green-500 font-semibold text-sm">Winner!</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={resetGame}
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