'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const WORDS = [
  'REACT', 'SPACE', 'HEART', 'BRAVE', 'CLOUD', 'DREAM', 'LIGHT', 'PEACE', 
  'SMILE', 'MAGIC', 'SWEET', 'HAPPY', 'TRUST', 'GRACE', 'DANCE', 'SHINE'
]

type LetterState = 'correct' | 'present' | 'absent' | 'empty'

interface Letter {
  char: string
  state: LetterState
}

export default function WordlePage() {
  const [targetWord, setTargetWord] = useState('')
  const [guesses, setGuesses] = useState<Letter[][]>(
    Array(6).fill(null).map(() => Array(5).fill({ char: '', state: 'empty' }))
  )
  const [currentGuess, setCurrentGuess] = useState('')
  const [currentRow, setCurrentRow] = useState(0)
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing')
  const [usedLetters, setUsedLetters] = useState<Map<string, LetterState>>(new Map())

  const keyboard = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE']
  ]

  useEffect(() => {
    const randomWord = WORDS[Math.floor(Math.random() * WORDS.length)]
    setTargetWord(randomWord)
  }, [])

  const checkGuess = (guess: string): Letter[] => {
    const result: Letter[] = []
    const targetLetters = targetWord.split('')
    const guessLetters = guess.split('')
    
    // First pass: mark correct positions
    for (let i = 0; i < 5; i++) {
      if (guessLetters[i] === targetLetters[i]) {
        result[i] = { char: guessLetters[i], state: 'correct' }
        targetLetters[i] = '*' // Mark as used
      } else {
        result[i] = { char: guessLetters[i], state: 'absent' }
      }
    }
    
    // Second pass: mark present letters
    for (let i = 0; i < 5; i++) {
      if (result[i].state === 'absent') {
        const index = targetLetters.findIndex(letter => letter === guessLetters[i])
        if (index !== -1) {
          result[i].state = 'present'
          targetLetters[index] = '*' // Mark as used
        }
      }
    }
    
    return result
  }

  const submitGuess = () => {
    if (currentGuess.length !== 5) return
    if (gameStatus !== 'playing') return
    
    const guessResult = checkGuess(currentGuess.toUpperCase())
    const newGuesses = [...guesses]
    newGuesses[currentRow] = guessResult
    setGuesses(newGuesses)
    
    // Update used letters
    const newUsedLetters = new Map(usedLetters)
    guessResult.forEach(letter => {
      const currentState = newUsedLetters.get(letter.char)
      if (!currentState || 
          (currentState === 'absent' && letter.state !== 'absent') ||
          (currentState === 'present' && letter.state === 'correct')) {
        newUsedLetters.set(letter.char, letter.state)
      }
    })
    setUsedLetters(newUsedLetters)
    
    // Check win condition
    if (currentGuess.toUpperCase() === targetWord) {
      setGameStatus('won')
    } else if (currentRow === 5) {
      setGameStatus('lost')
    } else {
      setCurrentRow(currentRow + 1)
      setCurrentGuess('')
    }
  }

  const handleKeyPress = (key: string) => {
    if (gameStatus !== 'playing') return
    
    if (key === 'ENTER') {
      submitGuess()
    } else if (key === 'BACKSPACE') {
      setCurrentGuess(prev => prev.slice(0, -1))
    } else if (key.length === 1 && currentGuess.length < 5) {
      setCurrentGuess(prev => prev + key)
    }
  }

  const resetGame = () => {
    const randomWord = WORDS[Math.floor(Math.random() * WORDS.length)]
    setTargetWord(randomWord)
    setGuesses(Array(6).fill(null).map(() => Array(5).fill({ char: '', state: 'empty' })))
    setCurrentGuess('')
    setCurrentRow(0)
    setGameStatus('playing')
    setUsedLetters(new Map())
  }

  const getLetterStyle = (state: LetterState) => {
    switch (state) {
      case 'correct':
        return 'bg-green-500 text-white border-green-500'
      case 'present':
        return 'bg-yellow-500 text-white border-yellow-500'
      case 'absent':
        return 'bg-gray-400 text-white border-gray-400'
      default:
        return 'bg-white text-gray-900 border-gray-300'
    }
  }

  const getKeyboardKeyStyle = (key: string) => {
    const state = usedLetters.get(key)
    const baseStyle = 'px-2 py-3 rounded text-sm font-medium !rounded-button transition-colors'
    
    if (key === 'ENTER' || key === 'BACKSPACE') {
      return `${baseStyle} bg-gray-300 text-gray-700 hover:bg-gray-400 text-xs px-1`
    }
    
    switch (state) {
      case 'correct':
        return `${baseStyle} bg-green-500 text-white`
      case 'present':
        return `${baseStyle} bg-yellow-500 text-white`
      case 'absent':
        return `${baseStyle} bg-gray-400 text-white`
      default:
        return `${baseStyle} bg-gray-200 text-gray-900 hover:bg-gray-300`
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
      <div className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md z-50 px-4 py-3 border-b border-green-100">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <Link href="/games" className="w-8 h-8 flex items-center justify-center">
            <i className="ri-arrow-left-line text-xl text-gray-700"></i>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">Wordle</h1>
          <button onClick={resetGame} className="w-8 h-8 flex items-center justify-center">
            <i className="ri-refresh-line text-xl text-gray-700"></i>
          </button>
        </div>
      </div>

      <div className="pt-16 pb-4 px-4">
        <div className="max-w-sm mx-auto space-y-4">
          {gameStatus === 'won' && (
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl p-4 shadow-sm">
              <div className="text-center">
                <div className="text-2xl mb-2">🎉</div>
                <h3 className="font-bold text-lg">Congratulations!</h3>
                <p className="text-green-100">You found the word in {currentRow} tries</p>
              </div>
            </div>
          )}

          {gameStatus === 'lost' && (
            <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl p-4 shadow-sm">
              <div className="text-center">
                <div className="text-2xl mb-2">😔</div>
                <h3 className="font-bold text-lg">Game Over</h3>
                <p className="text-red-100">The word was: <strong>{targetWord}</strong></p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl p-4 shadow-sm border border-green-100">
            <div className="space-y-2">
              {guesses.map((guess, rowIndex) => (
                <div key={rowIndex} className="flex gap-2 justify-center">
                  {guess.map((letter, colIndex) => {
                    const isCurrentRow = rowIndex === currentRow && gameStatus === 'playing'
                    const currentChar = isCurrentRow && colIndex < currentGuess.length 
                      ? currentGuess[colIndex].toUpperCase() 
                      : letter.char
                    
                    return (
                      <div
                        key={colIndex}
                        className={`
                          w-12 h-12 border-2 rounded flex items-center justify-center font-bold text-lg
                          ${isCurrentRow && colIndex < currentGuess.length ? 'border-blue-400 bg-blue-50' : ''}
                          ${letter.char ? getLetterStyle(letter.state) : 'bg-white border-gray-300'}
                        `}
                      >
                        {currentChar}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
            
            <div className="mt-4 text-center text-sm text-gray-600">
              Guess {currentRow + 1} of 6 • Find the 5-letter word
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-green-100">
            <div className="space-y-2">
              {keyboard.map((row, rowIndex) => (
                <div key={rowIndex} className="flex gap-1 justify-center">
                  {row.map((key) => (
                    <button
                      key={key}
                      onClick={() => handleKeyPress(key)}
                      className={getKeyboardKeyStyle(key)}
                      style={{ 
                        minWidth: key === 'ENTER' || key === 'BACKSPACE' ? '60px' : '32px',
                        fontSize: key === 'ENTER' || key === 'BACKSPACE' ? '10px' : '14px'
                      }}
                    >
                      {key === 'BACKSPACE' ? '←' : key}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold text-gray-900 mb-2">How to Play</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center text-white text-xs font-bold">W</div>
                <span>Green = Correct letter in right position</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-yellow-500 rounded flex items-center justify-center text-white text-xs font-bold">O</div>
                <span>Yellow = Letter in word, wrong position</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gray-400 rounded flex items-center justify-center text-white text-xs font-bold">X</div>
                <span>Gray = Letter not in word</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={resetGame}
              className="flex-1 py-3 px-4 bg-green-500 text-white rounded-lg font-medium !rounded-button"
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