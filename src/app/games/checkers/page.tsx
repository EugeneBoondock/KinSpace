'use client'

import { useState } from 'react'
import Link from 'next/link'

type PieceType = 'red' | 'black' | 'red-king' | 'black-king' | null

interface Position {
  row: number
  col: number
}

export default function CheckersPage() {
  const [board, setBoard] = useState<PieceType[][]>(() => {
    const initialBoard = Array(8).fill(null).map(() => Array(8).fill(null))
    
    // Place red pieces (top)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          initialBoard[row][col] = 'red'
        }
      }
    }
    
    // Place black pieces (bottom)
    for (let row = 5; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          initialBoard[row][col] = 'black'
        }
      }
    }
    
    return initialBoard
  })
  
  const [currentPlayer, setCurrentPlayer] = useState<'red' | 'black'>('red')
  const [selectedSquare, setSelectedSquare] = useState<Position | null>(null)
  const [validMoves, setValidMoves] = useState<Position[]>([])
  const [gameStatus, setGameStatus] = useState<'active' | 'finished'>('active')
  const [winner, setWinner] = useState<string | null>(null)
  const [captures, setCaptures] = useState({ red: 0, black: 0 })

  const players = [
    { name: 'Emma Thompson', avatar: 'ET', color: 'red' },
    { name: 'Michael Chen', avatar: 'MC', color: 'black' }
  ]

  const isValidSquare = (row: number, col: number) => {
    return row >= 0 && row < 8 && col >= 0 && col < 8 && (row + col) % 2 === 1
  }

  const getPossibleMoves = (row: number, col: number, piece: PieceType): Position[] => {
    if (!piece) return []
    
    const moves: Position[] = []
    const isKing = piece.includes('king')
    const pieceColor = piece.includes('red') ? 'red' : 'black'
    
    // Movement directions based on piece type
    const directions = isKing 
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] // King moves in all directions
      : pieceColor === 'red' 
        ? [[1, -1], [1, 1]] // Red moves down
        : [[-1, -1], [-1, 1]] // Black moves up
    
    directions.forEach(([dRow, dCol]) => {
      const newRow = row + dRow
      const newCol = col + dCol
      
      if (isValidSquare(newRow, newCol)) {
        if (!board[newRow][newCol]) {
          // Empty square - valid move
          moves.push({ row: newRow, col: newCol })
        } else if (board[newRow][newCol] && !board[newRow][newCol]!.includes(pieceColor)) {
          // Enemy piece - check for jump
          const jumpRow = newRow + dRow
          const jumpCol = newCol + dCol
          
          if (isValidSquare(jumpRow, jumpCol) && !board[jumpRow][jumpCol]) {
            moves.push({ row: jumpRow, col: jumpCol })
          }
        }
      }
    })
    
    return moves
  }

  const makeMove = (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    const newBoard = board.map(row => [...row])
    const piece = newBoard[fromRow][fromCol]
    
    // Move piece
    newBoard[toRow][toCol] = piece
    newBoard[fromRow][fromCol] = null
    
    // Check for capture (jump)
    const midRow = (fromRow + toRow) / 2
    const midCol = (fromCol + toCol) / 2
    
    if (Math.abs(toRow - fromRow) === 2 && Math.abs(toCol - fromCol) === 2) {
      // Capture occurred
      const capturedPiece = newBoard[midRow][midCol]
      newBoard[midRow][midCol] = null
      
      if (capturedPiece?.includes('red')) {
        setCaptures(prev => ({ ...prev, black: prev.black + 1 }))
      } else {
        setCaptures(prev => ({ ...prev, red: prev.red + 1 }))
      }
    }
    
    // Promote to king if reached opposite end
    if (piece === 'red' && toRow === 7) {
      newBoard[toRow][toCol] = 'red-king'
    } else if (piece === 'black' && toRow === 0) {
      newBoard[toRow][toCol] = 'black-king'
    }
    
    setBoard(newBoard)
    setCurrentPlayer(currentPlayer === 'red' ? 'black' : 'red')
    setSelectedSquare(null)
    setValidMoves([])
    
    // Check for winner
    checkWinner(newBoard)
  }

  const checkWinner = (board: PieceType[][]) => {
    let redPieces = 0
    let blackPieces = 0
    
    board.forEach(row => {
      row.forEach(piece => {
        if (piece?.includes('red')) redPieces++
        if (piece?.includes('black')) blackPieces++
      })
    })
    
    if (redPieces === 0) {
      setWinner('black')
      setGameStatus('finished')
    } else if (blackPieces === 0) {
      setWinner('red')
      setGameStatus('finished')
    }
  }

  const handleSquareClick = (row: number, col: number) => {
    if (gameStatus !== 'active') return
    
    const piece = board[row][col]
    
    if (selectedSquare) {
      // Check if this is a valid move
      const isValidMove = validMoves.some(move => move.row === row && move.col === col)
      
      if (isValidMove) {
        makeMove(selectedSquare.row, selectedSquare.col, row, col)
      } else {
        // Select new piece or deselect
        if (piece && piece.includes(currentPlayer)) {
          setSelectedSquare({ row, col })
          setValidMoves(getPossibleMoves(row, col, piece))
        } else {
          setSelectedSquare(null)
          setValidMoves([])
        }
      }
    } else {
      // Select piece if it belongs to current player
      if (piece && piece.includes(currentPlayer)) {
        setSelectedSquare({ row, col })
        setValidMoves(getPossibleMoves(row, col, piece))
      }
    }
  }

  const resetGame = () => {
    const initialBoard = Array(8).fill(null).map(() => Array(8).fill(null))
    
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          initialBoard[row][col] = 'red'
        }
      }
    }
    
    for (let row = 5; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          initialBoard[row][col] = 'black'
        }
      }
    }
    
    setBoard(initialBoard)
    setCurrentPlayer('red')
    setSelectedSquare(null)
    setValidMoves([])
    setGameStatus('active')
    setWinner(null)
    setCaptures({ red: 0, black: 0 })
  }

  const isSquareSelected = (row: number, col: number) => {
    return selectedSquare?.row === row && selectedSquare?.col === col
  }

  const isValidMoveSquare = (row: number, col: number) => {
    return validMoves.some(move => move.row === row && move.col === col)
  }

  const currentPlayerInfo = players.find(p => p.color === currentPlayer)
  const winnerInfo = winner ? players.find(p => p.color === winner) : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
      <div className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md z-50 px-4 py-3 border-b border-red-100">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <Link href="/games" className="w-8 h-8 flex items-center justify-center">
            <i className="ri-arrow-left-line text-xl text-gray-700"></i>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">Checkers</h1>
          <button onClick={resetGame} className="w-8 h-8 flex items-center justify-center">
            <i className="ri-refresh-line text-xl text-gray-700"></i>
          </button>
        </div>
      </div>

      <div className="pt-16 pb-4 px-4">
        <div className="max-w-sm mx-auto space-y-4">
          {gameStatus === 'finished' ? (
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl p-4 shadow-sm">
              <div className="text-center">
                <div className="text-2xl mb-2">🏆</div>
                <h3 className="font-bold text-lg">{winnerInfo?.name} Wins!</h3>
                <p className="text-green-100">Playing as {winner}</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-red-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${currentPlayer === 'red' ? 'bg-red-500' : 'bg-gray-800'} rounded-lg flex items-center justify-center text-white font-semibold text-sm`}>
                  {currentPlayerInfo?.avatar}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{currentPlayerInfo?.name}</div>
                  <div className="text-sm text-gray-500">Turn to move {currentPlayer} pieces</div>
                </div>
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl p-4 shadow-sm border border-red-100">
            <div className="aspect-square bg-amber-100 rounded-lg p-2">
              <div className="grid grid-cols-8 gap-0 h-full w-full">
                {board.map((row, rowIndex) =>
                  row.map((piece, colIndex) => {
                    const isLight = (rowIndex + colIndex) % 2 === 0
                    const isSelected = isSquareSelected(rowIndex, colIndex)
                    const isValidMove = isValidMoveSquare(rowIndex, colIndex)
                    
                    return (
                      <button
                        key={`${rowIndex}-${colIndex}`}
                        onClick={() => handleSquareClick(rowIndex, colIndex)}
                        disabled={isLight}
                        className={`
                          aspect-square flex items-center justify-center transition-all
                          ${isLight ? 'bg-amber-50' : 'bg-amber-800'}
                          ${isSelected ? 'ring-2 ring-blue-500' : ''}
                          ${isValidMove ? 'ring-2 ring-green-500 bg-green-100' : ''}
                          ${!isLight && !piece ? 'hover:bg-amber-700' : ''}
                        `}
                      >
                        {piece && (
                          <div className={`
                            w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold
                            ${piece.includes('red') ? 'bg-red-500 border-red-700 text-white' : 'bg-gray-800 border-gray-900 text-white'}
                          `}>
                            {piece.includes('king') ? '♔' : ''}
                          </div>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {players.map((player) => (
              <div key={player.color} className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-6 h-6 ${player.color === 'red' ? 'bg-red-500' : 'bg-gray-800'} rounded-full flex items-center justify-center text-white font-semibold text-xs`}>
                    {player.avatar}
                  </div>
                  <div className="text-sm font-medium text-gray-900">{player.name}</div>
                </div>
                <div className="text-xs text-gray-500">
                  Captures: {captures[player.color as keyof typeof captures]}
                </div>
                {currentPlayer === player.color && gameStatus === 'active' && (
                  <div className="mt-2 w-2 h-2 bg-green-500 rounded-full mx-auto"></div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button 
              onClick={resetGame}
              className="flex-1 py-3 px-4 bg-red-500 text-white rounded-lg font-medium !rounded-button"
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