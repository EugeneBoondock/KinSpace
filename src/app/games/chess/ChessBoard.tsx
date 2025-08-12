'use client'

interface ChessBoardProps {
  gameState: {
    board: string
    turn: string
    moves: string[]
    gameStatus: string
  }
  selectedSquare: string | null
  validMoves: string[]
  onSquareClick: (square: string) => void
  currentPlayer: string
}

const pieceSymbols: { [key: string]: string } = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
}

export default function ChessBoard({ gameState, selectedSquare, validMoves, onSquareClick }: ChessBoardProps) {
  const parseBoardFromFEN = (fen: string) => {
    const board = Array(8).fill(null).map(() => Array(8).fill(null))
    const rows = fen.split('/')
    
    for (let row = 0; row < 8; row++) {
      let col = 0
      for (const char of rows[row]) {
        if (char >= '1' && char <= '8') {
          col += parseInt(char)
        } else {
          board[row][col] = char
          col++
        }
      }
    }
    return board
  }

  const board = parseBoardFromFEN(gameState.board)
  
  const getSquareName = (row: number, col: number) => {
    return String.fromCharCode(97 + col) + (8 - row)
  }

  const isSquareSelected = (row: number, col: number) => {
    return selectedSquare === getSquareName(row, col)
  }

  const isValidMoveSquare = (row: number, col: number) => {
    return validMoves.includes(getSquareName(row, col))
  }

  const isLightSquare = (row: number, col: number) => {
    return (row + col) % 2 === 0
  }

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-amber-100">
      <div className="aspect-square bg-amber-100 rounded-lg p-2">
        <div className="grid grid-cols-8 gap-0 h-full w-full">
          {board.map((row, rowIndex) =>
            row.map((piece, colIndex) => {
              const squareName = getSquareName(rowIndex, colIndex)
              const isSelected = isSquareSelected(rowIndex, colIndex)
              const isValidMove = isValidMoveSquare(rowIndex, colIndex)
              const isLight = isLightSquare(rowIndex, colIndex)
              
              return (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => onSquareClick(squareName)}
                  className={`
                    aspect-square flex items-center justify-center text-2xl font-bold transition-all
                    ${isLight ? 'bg-amber-50' : 'bg-amber-200'}
                    ${isSelected ? 'ring-2 ring-blue-500 bg-blue-100' : ''}
                    ${isValidMove ? 'ring-2 ring-green-500 bg-green-100' : ''}
                    hover:bg-opacity-80
                  `}
                >
                  {piece && pieceSymbols[piece] && (
                    <span className={piece === piece.toUpperCase() ? 'text-white drop-shadow-lg' : 'text-gray-900'}>
                      {pieceSymbols[piece]}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-3 text-sm">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            gameState.turn === 'white' ? 'bg-blue-500' : 'bg-gray-300'
          }`}></div>
          <span className="text-gray-600">
            {gameState.turn === 'white' ? "White's turn" : "Black's turn"}
          </span>
        </div>
        <div className="flex items-center gap-1 text-gray-500">
          <i className="ri-eye-line"></i>
          <span>3 watching</span>
        </div>
      </div>
    </div>
  )
}