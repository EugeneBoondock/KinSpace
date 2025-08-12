'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type CardColor = 'red' | 'blue' | 'green' | 'yellow' | 'black'
type CardType = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4'

interface Card {
  id: string
  color: CardColor
  type: CardType
  value?: number
}

const createDeck = (): Card[] => {
  const deck: Card[] = []
  const colors: CardColor[] = ['red', 'blue', 'green', 'yellow']
  
  // Number cards (0-9, 1-9 twice)
  colors.forEach(color => {
    for (let num = 0; num <= 9; num++) {
      deck.push({ id: `${color}-${num}-1`, color, type: 'number', value: num })
      if (num > 0) {
        deck.push({ id: `${color}-${num}-2`, color, type: 'number', value: num })
      }
    }
    
    // Action cards (2 of each)
    for (let i = 0; i < 2; i++) {
      deck.push({ id: `${color}-skip-${i}`, color, type: 'skip' })
      deck.push({ id: `${color}-reverse-${i}`, color, type: 'reverse' })
      deck.push({ id: `${color}-draw2-${i}`, color, type: 'draw2' })
    }
  })
  
  // Wild cards
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `wild-${i}`, color: 'black', type: 'wild' })
    deck.push({ id: `wild4-${i}`, color: 'black', type: 'wild4' })
  }
  
  return deck
}

const shuffleDeck = (deck: Card[]): Card[] => {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export default function UnoPage() {
  const [deck, setDeck] = useState<Card[]>([])
  const [playerHand, setPlayerHand] = useState<Card[]>([])
  const [aiHands, setAiHands] = useState<Card[][]>([])
  const [topCard, setTopCard] = useState<Card | null>(null)
  const [currentPlayer, setCurrentPlayer] = useState(0) // 0 = human, 1-3 = AI
  const [gameStatus, setGameStatus] = useState<'playing' | 'won' | 'lost'>('playing')
  const [direction, setDirection] = useState(1) // 1 = clockwise, -1 = counterclockwise
  const [drawCount, setDrawCount] = useState(0)
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)

  const players = [
    { name: 'You', avatar: '👤', isHuman: true },
    { name: 'Emma', avatar: 'ET', isHuman: false },
    { name: 'Mike', avatar: 'MC', isHuman: false },
    { name: 'Sara', avatar: 'SW', isHuman: false }
  ]

  useEffect(() => {
    initializeGame()
  }, [])

  const initializeGame = () => {
    const newDeck = shuffleDeck(createDeck())
    
    // Deal 7 cards to each player
    const newPlayerHand = newDeck.splice(0, 7)
    const newAiHands = [
      newDeck.splice(0, 7),
      newDeck.splice(0, 7),
      newDeck.splice(0, 7)
    ]
    
    // Set top card (make sure it's not a wild card)
    let topCardIndex = 0
    while (newDeck[topCardIndex].type === 'wild' || newDeck[topCardIndex].type === 'wild4') {
      topCardIndex++
    }
    const newTopCard = newDeck.splice(topCardIndex, 1)[0]
    
    setDeck(newDeck)
    setPlayerHand(newPlayerHand)
    setAiHands(newAiHands)
    setTopCard(newTopCard)
    setCurrentPlayer(0)
    setGameStatus('playing')
    setDirection(1)
    setDrawCount(0)
  }

  const canPlayCard = (card: Card, topCard: Card): boolean => {
    if (card.type === 'wild' || card.type === 'wild4') return true
    if (card.color === topCard.color) return true
    if (card.type === topCard.type && card.type !== 'number') return true
    if (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) return true
    return false
  }





  const handlePlayerCardClick = (card: Card) => {
    if (currentPlayer !== 0 || gameStatus !== 'playing') return
    if (!topCard || !canPlayCard(card, topCard)) return
    
    if (card.type === 'wild' || card.type === 'wild4') {
      setSelectedCard(card)
      setShowColorPicker(true)
    } else {
      // Inline playCard logic
      // Remove card from current player's hand
      setPlayerHand(prev => prev.filter(c => c.id !== card.id))
      
      // Set new top card
      const newTopCard = { ...card }
      setTopCard(newTopCard)
      
      // Handle special cards
      let nextPlayer = (currentPlayer + direction + 4) % 4
      
      switch (card.type) {
        case 'skip':
          nextPlayer = (nextPlayer + direction + 4) % 4
          break
        case 'reverse':
          setDirection(-direction)
          if (players.length === 2) {
            nextPlayer = (nextPlayer + direction + 4) % 4
          }
          break
        case 'draw2':
          setDrawCount(2)
          break
        case 'wild4':
          setDrawCount(4)
          break
      }
      
      // Check for win
      const handSize = playerHand.length - 1
      if (handSize === 0) {
        setGameStatus('won')
        return
      }
      
      setCurrentPlayer(nextPlayer)
    }
  }

  const handleColorChoice = (color: CardColor) => {
    if (selectedCard) {
      // Inline playCard logic
      // Remove card from current player's hand
      setPlayerHand(prev => prev.filter(c => c.id !== selectedCard.id))
      
      // Set new top card
      const newTopCard = { ...selectedCard, color }
      setTopCard(newTopCard)
      
      // Handle special cards
      let nextPlayer = (currentPlayer + direction + 4) % 4
      
      switch (selectedCard.type) {
        case 'skip':
          nextPlayer = (nextPlayer + direction + 4) % 4
          break
        case 'reverse':
          setDirection(-direction)
          if (players.length === 2) {
            nextPlayer = (nextPlayer + direction + 4) % 4
          }
          break
        case 'draw2':
          setDrawCount(2)
          break
        case 'wild4':
          setDrawCount(4)
          break
      }
      
      // Check for win
      const handSize = playerHand.length - 1
      if (handSize === 0) {
        setGameStatus('won')
        return
      }
      
      setCurrentPlayer(nextPlayer)
      setSelectedCard(null)
    }
    setShowColorPicker(false)
  }

  const handleDrawCard = () => {
    if (currentPlayer !== 0 || gameStatus !== 'playing') return
    
    if (drawCount > 0) {
      // Draw penalty cards
      for (let i = 0; i < drawCount; i++) {
        if (deck.length > 0) {
          const newDeck = [...deck]
          const drawnCard = newDeck.pop()!
          setDeck(newDeck)
          setPlayerHand(prev => [...prev, drawnCard])
        }
      }
      setDrawCount(0)
      setCurrentPlayer((currentPlayer + direction + 4) % 4)
    } else {
      // Draw one card
      if (deck.length > 0) {
        const newDeck = [...deck]
        const drawnCard = newDeck.pop()!
        setDeck(newDeck)
        setPlayerHand(prev => [...prev, drawnCard])
      }
    }
  }

  // AI turn logic
  useEffect(() => {
    if (currentPlayer !== 0 && gameStatus === 'playing') {
      const timer = setTimeout(() => {
        const aiHand = aiHands[currentPlayer - 1]
        const playableCards = aiHand.filter(card => topCard && canPlayCard(card, topCard))
        
        if (playableCards.length > 0) {
          const cardToPlay = playableCards[0]
          const chosenColor = cardToPlay.type === 'wild' || cardToPlay.type === 'wild4' 
            ? ['red', 'blue', 'green', 'yellow'][Math.floor(Math.random() * 4)] as CardColor
            : undefined
          
          // Inline playCard logic
          if (!topCard || !canPlayCard(cardToPlay, topCard)) return
          
          // Remove card from current player's hand
          const newAiHands = [...aiHands]
          newAiHands[currentPlayer - 1] = newAiHands[currentPlayer - 1].filter(c => c.id !== cardToPlay.id)
          setAiHands(newAiHands)
          
          // Set new top card
          const newTopCard = { ...cardToPlay }
          if (chosenColor && (cardToPlay.type === 'wild' || cardToPlay.type === 'wild4')) {
            newTopCard.color = chosenColor
          }
          setTopCard(newTopCard)
          
          // Handle special cards
          let nextPlayer = (currentPlayer + direction + 4) % 4
          
          switch (cardToPlay.type) {
            case 'skip':
              nextPlayer = (nextPlayer + direction + 4) % 4
              break
            case 'reverse':
              setDirection(-direction)
              if (players.length === 2) {
                nextPlayer = (nextPlayer + direction + 4) % 4
              }
              break
            case 'draw2':
              setDrawCount(2)
              break
            case 'wild4':
              setDrawCount(4)
              break
          }
          
          // Check for win
          const handSize = newAiHands[currentPlayer - 1].length - 1
          if (handSize === 0) {
            setGameStatus('lost')
            return
          }
          
          setCurrentPlayer(nextPlayer)
        } else {
          // AI draws card
          if (drawCount > 0) {
            const newAiHands = [...aiHands]
            for (let i = 0; i < drawCount; i++) {
              // Inline drawCard logic
              if (deck.length === 0) continue
              const newDeck = [...deck]
              const drawnCard = newDeck.pop()!
              setDeck(newDeck)
              newAiHands[currentPlayer - 1].push(drawnCard)
            }
            setAiHands(newAiHands)
            setDrawCount(0)
          } else {
            // Inline drawCard logic
            if (deck.length > 0) {
              const newDeck = [...deck]
              const drawnCard = newDeck.pop()!
              setDeck(newDeck)
              const newAiHands = [...aiHands]
              newAiHands[currentPlayer - 1].push(drawnCard)
              setAiHands(newAiHands)
            }
          }
          
          setCurrentPlayer((currentPlayer + direction + 4) % 4)
        }
      }, 1500)
      
      return () => clearTimeout(timer)
    }
  }, [currentPlayer, gameStatus, aiHands, direction, drawCount, topCard, deck, players.length])

  const getCardColor = (card: Card) => {
    switch (card.color) {
      case 'red': return 'bg-red-500'
      case 'blue': return 'bg-blue-500'
      case 'green': return 'bg-green-500'
      case 'yellow': return 'bg-yellow-500'
      default: return 'bg-gray-800'
    }
  }

  const getCardSymbol = (card: Card) => {
    switch (card.type) {
      case 'number': return card.value?.toString()
      case 'skip': return '🚫'
      case 'reverse': return '🔄'
      case 'draw2': return '+2'
      case 'wild': return '🌈'
      case 'wild4': return '+4'
      default: return '?'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-yellow-50 to-blue-50">
      <div className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md z-50 px-4 py-3 border-b border-red-100">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <Link href="/games" className="w-8 h-8 flex items-center justify-center">
            <i className="ri-arrow-left-line text-xl text-gray-700"></i>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">UNO</h1>
          <button onClick={initializeGame} className="w-8 h-8 flex items-center justify-center">
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
                <h3 className="font-bold text-lg">You Won!</h3>
                <p className="text-green-100">Congratulations on your UNO victory!</p>
              </div>
            </div>
          )}

          {gameStatus === 'lost' && (
            <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl p-4 shadow-sm">
              <div className="text-center">
                <div className="text-2xl mb-2">😔</div>
                <h3 className="font-bold text-lg">Game Over</h3>
                <p className="text-red-100">{players.find((_, index) => index === currentPlayer)?.name} won this time!</p>
              </div>
            </div>
          )}

          {/* AI Players */}
          <div className="grid grid-cols-3 gap-2">
            {players.slice(1).map((player, index) => (
              <div key={index} className={`bg-white rounded-lg p-3 shadow-sm border ${
                currentPlayer === index + 1 ? 'border-blue-400 bg-blue-50' : 'border-gray-100'
              }`}>
                <div className="text-center">
                  <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center text-white font-semibold text-xs mx-auto mb-1">
                    {player.avatar}
                  </div>
                  <div className="text-xs font-medium text-gray-900">{player.name}</div>
                  <div className="text-xs text-gray-500">{aiHands[index]?.length || 0} cards</div>
                </div>
              </div>
            ))}
          </div>

          {/* Game Area */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-center gap-4 mb-4">
              {/* Deck */}
              <div className="text-center">
                <div className="w-16 h-24 bg-gray-800 rounded-lg flex items-center justify-center text-white font-bold border-2 border-gray-600 mb-2">
                  UNO
                </div>
                <button
                  onClick={handleDrawCard}
                  disabled={currentPlayer !== 0}
                  className="text-xs px-2 py-1 bg-blue-500 text-white rounded !rounded-button disabled:bg-gray-300"
                >
                  Draw
                </button>
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center">
                <div className={`text-2xl ${direction === 1 ? 'rotate-90' : '-rotate-90'} transition-transform`}>
                  ➤
                </div>
                {drawCount > 0 && (
                  <div className="text-xs font-bold text-red-500">+{drawCount}</div>
                )}
              </div>

              {/* Top Card */}
              <div className="text-center">
                {topCard && (
                  <div className={`w-16 h-24 ${getCardColor(topCard)} rounded-lg flex items-center justify-center text-white font-bold border-2 border-gray-300`}>
                    {getCardSymbol(topCard)}
                  </div>
                )}
              </div>
            </div>

            <div className="text-center text-sm text-gray-600">
              {currentPlayer === 0 ? "Your turn" : `${players[currentPlayer].name}'s turn`}
            </div>
          </div>

          {/* Player Hand */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Your Cards ({playerHand.length})</h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {playerHand.map((card) => (
                <button
                  key={card.id}
                  onClick={() => handlePlayerCardClick(card)}
                  disabled={currentPlayer !== 0 || !topCard || !canPlayCard(card, topCard)}
                  className={`
                    flex-shrink-0 w-12 h-18 ${getCardColor(card)} rounded-lg flex items-center justify-center 
                    text-white font-bold text-xs border-2 transition-all
                    ${currentPlayer === 0 && topCard && canPlayCard(card, topCard) 
                      ? 'border-green-400 hover:scale-105 cursor-pointer' 
                      : 'border-gray-300 opacity-60'
                    }
                  `}
                  style={{ minWidth: '48px', height: '72px' }}
                >
                  {getCardSymbol(card)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={initializeGame}
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

      {/* Color Picker Modal */}
      {showColorPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 mx-4 max-w-xs w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Choose Color</h3>
            <div className="grid grid-cols-2 gap-3">
              {(['red', 'blue', 'green', 'yellow'] as CardColor[]).map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorChoice(color)}
                  className={`py-3 px-4 rounded-lg text-white font-medium !rounded-button capitalize ${
                    color === 'red' ? 'bg-red-500' :
                    color === 'blue' ? 'bg-blue-500' :
                    color === 'green' ? 'bg-green-500' :
                    'bg-yellow-500'
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}