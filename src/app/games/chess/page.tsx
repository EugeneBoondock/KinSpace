'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import ChessBoard from './ChessBoard'

// AI difficulty levels
const AI_LEVELS = {
  easy: { depth: 1, randomness: 0.3 },
  medium: { depth: 2, randomness: 0.1 },
  hard: { depth: 3, randomness: 0 }
}

type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p' | 'K' | 'Q' | 'R' | 'B' | 'N' | 'P' | null

interface ChessMove {
  from: string
  to: string
  piece: PieceType
  captured?: PieceType
  notation: string
}

export default function ChessGamePage() {
  const [gameState, setGameState] = useState({
    board: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
    turn: 'white',
    moves: [] as ChessMove[],
    gameStatus: 'active'
  })
  
  const [players] = useState([
    { id: '1', name: 'Emma Thompson', avatar: 'ET', color: 'white' },
    { id: '2', name: 'Michael Chen', avatar: 'MC', color: 'black' }
  ])

  const [currentPlayer] = useState('1')
  const [timeLeft, setTimeLeft] = useState({ white: 600, black: 600 })
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [validMoves, setValidMoves] = useState<string[]>([])
  const [isAIGame, setIsAIGame] = useState(false)
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')

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

  useEffect(() => {
    if (gameState.gameStatus === 'active') {
      const timer = setInterval(() => {
        setTimeLeft(prev => ({
          ...prev,
          [gameState.turn]: Math.max(0, prev[gameState.turn as keyof typeof prev] - 1)
        }))
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [gameState.turn, gameState.gameStatus])

  // AI move logic
  useEffect(() => {
    if (isAIGame && gameState.turn === 'black' && gameState.gameStatus === 'active') {
      const timer = setTimeout(() => {
        const board = parseFEN(gameState.board)
        const possibleMoves = getAllPossibleMoves(board, 'black')
        
        if (possibleMoves.length === 0) {
          setGameState(prev => ({ ...prev, gameStatus: 'checkmate' }))
          return
        }
        
        let bestMove: ChessMove
        const { depth, randomness } = AI_LEVELS[aiDifficulty]
        
        if (Math.random() < randomness) {
          // Random move for easier difficulty
          bestMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)]
        } else {
          // Use minimax algorithm
          let bestValue = -Infinity
          bestMove = possibleMoves[0]
          
          for (const move of possibleMoves) {
            const newBoard = makeMove(board, move.from, move.to)
            const value = minimax(newBoard, depth, false, -Infinity, Infinity)
            
            if (value > bestValue) {
              bestValue = value
              bestMove = move
            }
          }
        }
        
        // Execute the move
        handleSquareClick(bestMove.to, bestMove.from)
      }, 1000 + Math.random() * 2000) // Random delay for realism

      return () => clearTimeout(timer)
    }
  }, [gameState.turn, isAIGame, gameState.gameStatus, gameState.board, aiDifficulty, getAllPossibleMoves, handleSquareClick, makeMove, minimax, parseFEN])

  const parseFEN = useCallback((fen: string): PieceType[][] => {
    const board = Array(8).fill(null).map(() => Array(8).fill(null))
    const rows = fen.split('/')
    
    for (let row = 0; row < 8; row++) {
      let col = 0
      for (const char of rows[row]) {
        if (char >= '1' && char <= '8') {
          col += parseInt(char)
        } else {
          board[row][col] = char as PieceType
          col++
        }
      }
    }
    return board
  }, [])

  const boardToFEN = useCallback((board: PieceType[][]): string => {
    return board.map(row => {
      let fen = ''
      let empty = 0
      for (const piece of row) {
        if (piece) {
          if (empty > 0) {
            fen += empty.toString()
            empty = 0
          }
          fen += piece
        } else {
          empty++
        }
      }
      if (empty > 0) fen += empty.toString()
      return fen
    }).join('/')
  }, [])

  const getSquareCoords = useCallback((square: string): [number, number] => {
    const col = square.charCodeAt(0) - 97 // a=0, b=1, etc.
    const row = 8 - parseInt(square[1]) // 8=0, 7=1, etc.
    return [row, col]
  }, [])

  const getCoordsSquare = useCallback((row: number, col: number): string => {
    return String.fromCharCode(97 + col) + (8 - row).toString()
  }, [])

  const isValidMove = useCallback((from: string, to: string, board: PieceType[][], turn: string): boolean => {
    const [fromRow, fromCol] = getSquareCoords(from)
    const [toRow, toCol] = getSquareCoords(to)
    const piece = board[fromRow][fromCol]
    
    if (!piece) return false
    if ((turn === 'white') !== (piece === piece.toUpperCase())) return false
    if (board[toRow][toCol] && (board[toRow][toCol]!.toUpperCase() === board[toRow][toCol]!) === (piece.toUpperCase() === piece)) return false
    
    const rowDiff = toRow - fromRow
    const colDiff = toCol - fromCol
    const absRowDiff = Math.abs(rowDiff)
    const absColDiff = Math.abs(colDiff)
    
    switch (piece.toLowerCase()) {
      case 'p': // Pawn
        const direction = piece === piece.toUpperCase() ? 1 : -1
        const startRow = piece === piece.toUpperCase() ? 1 : 6
        
        if (colDiff === 0) { // Forward move
          if (rowDiff === direction && !board[toRow][toCol]) return true
          if (fromRow === startRow && rowDiff === 2 * direction && !board[toRow][toCol] && !board[fromRow + direction][fromCol]) return true
        } else if (absColDiff === 1 && rowDiff === direction) { // Capture
          return !!board[toRow][toCol]
        }
        return false
        
      case 'r': // Rook
        if (rowDiff === 0 || colDiff === 0) {
          return isPathClear(fromRow, fromCol, toRow, toCol, board)
        }
        return false
        
      case 'n': // Knight
        return (absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2)
        
      case 'b': // Bishop
        if (absRowDiff === absColDiff) {
          return isPathClear(fromRow, fromCol, toRow, toCol, board)
        }
        return false
        
      case 'q': // Queen
        if (rowDiff === 0 || colDiff === 0 || absRowDiff === absColDiff) {
          return isPathClear(fromRow, fromCol, toRow, toCol, board)
        }
        return false
        
      case 'k': // King
        return absRowDiff <= 1 && absColDiff <= 1
        
      default:
        return false
    }
  }, [getSquareCoords, isPathClear])

  const isPathClear = useCallback((fromRow: number, fromCol: number, toRow: number, toCol: number, board: PieceType[][]): boolean => {
    const rowStep = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0
    const colStep = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0
    
    let row = fromRow + rowStep
    let col = fromCol + colStep
    
    while (row !== toRow || col !== toCol) {
      if (board[row][col]) return false
      row += rowStep
      col += colStep
    }
    
    return true
  }, [])

  const getValidMoves = useCallback((square: string, board: PieceType[][], turn: string): string[] => {
    const moves: string[] = []
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const to = getCoordsSquare(row, col)
        if (isValidMove(square, to, board, turn)) {
          moves.push(to)
        }
      }
    }
    
    return moves
  }, [getCoordsSquare, isValidMove])

  const getAllPossibleMoves = useCallback((board: PieceType[][], turn: string): ChessMove[] => {
    const moves: ChessMove[] = []
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const from = getCoordsSquare(row, col)
        const piece = board[row][col]
        
        if (piece && ((turn === 'white') === (piece === piece.toUpperCase()))) {
          const validMoves = getValidMoves(from, board, turn)
          
          validMoves.forEach(to => {
            const [toRow, toCol] = getSquareCoords(to)
            moves.push({
              from,
              to,
              piece,
              captured: board[toRow][toCol],
              notation: `${from}-${to}`
            })
          })
        }
      }
    }
    
    return moves
  }, [getCoordsSquare, getValidMoves, getSquareCoords])

  const evaluateBoard = useCallback((board: PieceType[][]): number => {
    const pieceValues: { [key: string]: number } = {
      'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 100,
      'P': -1, 'N': -3, 'B': -3, 'R': -5, 'Q': -9, 'K': -100
    }
    
    let score = 0
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col]
        if (piece) {
          score += pieceValues[piece] || 0
        }
      }
    }
    return score
  }, [])

  const minimax = useCallback((board: PieceType[][], depth: number, isMaximizing: boolean, alpha: number, beta: number): number => {
    if (depth === 0) {
      return evaluateBoard(board)
    }
    
    const turn = isMaximizing ? 'black' : 'white'
    const moves = getAllPossibleMoves(board, turn)
    
    if (moves.length === 0) {
      return isMaximizing ? -1000 : 1000
    }
    
    if (isMaximizing) {
      let maxEval = -Infinity
      for (const move of moves) {
        const newBoard = makeMove(board, move.from, move.to)
        const evaluation = minimax(newBoard, depth - 1, false, alpha, beta)
        maxEval = Math.max(maxEval, evaluation)
        alpha = Math.max(alpha, evaluation)
        if (beta <= alpha) break
      }
      return maxEval
    } else {
      let minEval = Infinity
      for (const move of moves) {
        const newBoard = makeMove(board, move.from, move.to)
        const evaluation = minimax(newBoard, depth - 1, true, alpha, beta)
        minEval = Math.min(minEval, evaluation)
        beta = Math.min(beta, evaluation)
        if (beta <= alpha) break
      }
      return minEval
    }
  }, [getAllPossibleMoves, makeMove, evaluateBoard])

  const makeMove = useCallback((board: PieceType[][], from: string, to: string): PieceType[][] => {
    const newBoard = board.map(row => [...row])
    const [fromRow, fromCol] = getSquareCoords(from)
    const [toRow, toCol] = getSquareCoords(to)
    
    newBoard[toRow][toCol] = newBoard[fromRow][fromCol]
    newBoard[fromRow][fromCol] = null
    
    return newBoard
  }, [getSquareCoords])



  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSquareClick = useCallback((square: string, forceFrom?: string) => {
    if (gameState.gameStatus !== 'active') return
    if (isAIGame && gameState.turn === 'black' && !forceFrom) return
    
    const board = parseFEN(gameState.board)
    
    if (selectedSquare === square && !forceFrom) {
      setSelectedSquare(null)
      setValidMoves([])
    } else if (selectedSquare && selectedSquare !== square) {
      const from = forceFrom || selectedSquare
      const to = square
      
      if (isValidMove(from, to, board, gameState.turn)) {
        const [fromRow, fromCol] = getSquareCoords(from)
        const [toRow, toCol] = getSquareCoords(to)
        const piece = board[fromRow][fromCol]
        const captured = board[toRow][toCol]
        
        // Make the move
        const newBoard = makeMove(board, from, to)
        const newFEN = boardToFEN(newBoard)
        
        const move: ChessMove = {
          from,
          to,
          piece: piece!,
          captured: captured || undefined,
          notation: `${from}-${to}`
        }
        
        setGameState(prev => ({
          ...prev,
          board: newFEN,
          turn: prev.turn === 'white' ? 'black' : 'white',
          moves: [...prev.moves, move]
        }))
        
        setSelectedSquare(null)
        setValidMoves([])
      }
    } else if (!forceFrom) {
      const [row, col] = getSquareCoords(square)
      const piece = board[row][col]
      
      if (piece && ((gameState.turn === 'white') === (piece === piece.toUpperCase()))) {
        setSelectedSquare(square)
        setValidMoves(getValidMoves(square, board, gameState.turn))
      }
    }
  }, [gameState.gameStatus, gameState.turn, gameState.board, isAIGame, selectedSquare, setGameState, setSelectedSquare, setValidMoves, parseFEN, isValidMove, getSquareCoords, boardToFEN, getValidMoves, makeMove])

  const resetGame = () => {
    setGameState({
      board: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
      turn: 'white',
      moves: [],
      gameStatus: 'active'
    })
    setSelectedSquare(null)
    setValidMoves([])
    setTimeLeft({ white: 600, black: 600 })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <div className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md z-50 px-4 py-3 border-b border-amber-100">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <Link href="/games" className="w-8 h-8 flex items-center justify-center">
            <i className="ri-arrow-left-line text-xl text-gray-700"></i>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">
            Chess {isAIGame && `(vs AI - ${aiDifficulty})`}
          </h1>
          <button onClick={resetGame} className="w-8 h-8 flex items-center justify-center">
            <i className="ri-refresh-line text-xl text-gray-700"></i>
          </button>
        </div>
      </div>

      <div className="pt-16 pb-4 px-4">
        <div className="max-w-sm mx-auto space-y-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                {isAIGame ? '🤖' : players[1].avatar}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">
                  {isAIGame ? `AI (${aiDifficulty})` : players[1].name}
                </div>
                <div className="text-sm text-gray-500">Black pieces</div>
              </div>
              <div className={`text-lg font-mono font-bold ${
                gameState.turn === 'black' ? 'text-red-500' : 'text-gray-400'
              }`}>
                {formatTime(timeLeft.black)}
              </div>
            </div>
            {gameState.turn === 'black' && gameState.gameStatus === 'active' && (
              <div className="h-1 bg-red-100 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 w-full animate-pulse"></div>
              </div>
            )}
          </div>

          <ChessBoard 
            gameState={gameState}
            selectedSquare={selectedSquare}
            validMoves={validMoves}
            onSquareClick={handleSquareClick}
            currentPlayer={currentPlayer}
          />

          <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
            {gameState.turn === 'white' && gameState.gameStatus === 'active' && (
              <div className="h-1 bg-blue-100 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-blue-500 w-full animate-pulse"></div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                {players[0].avatar}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{players[0].name}</div>
                <div className="text-sm text-gray-500">White pieces</div>
              </div>
              <div className={`text-lg font-mono font-bold ${
                gameState.turn === 'white' ? 'text-blue-500' : 'text-gray-400'
              }`}>
                {formatTime(timeLeft.white)}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Move History</h3>
              <span className="text-sm text-gray-500">Move {gameState.moves.length}</span>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {gameState.moves.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No moves yet</p>
              ) : (
                gameState.moves.map((move, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{index + 1}.</span>
                    <span className="font-mono text-gray-900">{move.notation}</span>
                    <span className="text-gray-400">{index % 2 === 0 ? 'White' : 'Black'}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium !rounded-button">
              Offer Draw
            </button>
            <button className="flex-1 py-3 px-4 bg-red-500 text-white rounded-lg font-medium !rounded-button">
              Resign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}