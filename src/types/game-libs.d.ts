declare module 'js-chess-engine' {
  export function aiMove(fen: string, level?: number): Record<string, string>
  export function move(board: string | object, from: string, to: string): Record<string, unknown>
  export function status(board: string | object): Record<string, unknown>
  export function moves(board: string | object): Record<string, string[]>
  export function getFen(board: object): string
  export class Game {
    constructor(configuration?: string | object)
    aiMove(level?: number): Record<string, string>
    move(from: string, to: string): Record<string, unknown>
    exportJson(): object
    exportFEN(): string
    printToConsole(): void
  }
}

declare module 'sudoku' {
  export function makepuzzle(): Array<number | null>
  export function solvepuzzle(puzzle: Array<number | null>): number[] | null
  export function ratepuzzle(puzzle: Array<number | null>, samples: number): number
}

declare module 'react-tetris' {
  import * as React from 'react'

  export type TetrisRenderParams = {
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
      hold: () => void
      hardDrop: () => void
      moveDown: () => void
      moveLeft: () => void
      moveRight: () => void
      flipClockwise: () => void
      flipCounterclockwise: () => void
      restart: () => void
    }
  }

  type Props = {
    keyboardControls?: Record<string, string>
    children: (params: TetrisRenderParams) => React.ReactElement
  }

  export default function Tetris(props: Props): React.ReactElement
}
