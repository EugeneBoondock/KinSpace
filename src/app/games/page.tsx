
'use client'

import { useState } from 'react'
import Link from 'next/link'

const gameTypes = [
  {
    id: 'chess',
    name: 'Chess',
    icon: '♛',
    players: '2 players',
    duration: '15-60 min',
    difficulty: 'Advanced',
    description: 'Strategic board game with pieces having unique movements',
    aiAvailable: true
  },
  {
    id: 'checkers',
    name: 'Checkers',
    icon: '⚫',
    players: '2 players',
    duration: '10-30 min',
    difficulty: 'Medium',
    description: 'Classic strategy game with diagonal moves and captures',
    aiAvailable: true
  },
  {
    id: 'tictactoe',
    name: 'Tic Tac Toe',
    icon: '⭕',
    players: '2 players',
    duration: '2-5 min',
    difficulty: 'Easy',
    description: 'Simple game to get three in a row',
    aiAvailable: true
  },
  {
    id: 'wordle',
    name: 'Wordle',
    icon: '🔤',
    players: '1-4 players',
    duration: '5-15 min',
    difficulty: 'Medium',
    description: 'Guess the 5-letter word in 6 tries',
    aiAvailable: false
  },
  {
    id: 'uno',
    name: 'UNO Cards',
    icon: '🎴',
    players: '2-6 players',
    duration: '15-45 min',
    difficulty: 'Easy',
    description: 'Match colors and numbers, use special cards',
    aiAvailable: true
  },
  {
    id: 'drawing',
    name: 'Guess Drawing',
    icon: '🎨',
    players: '3-8 players',
    duration: '10-20 min',
    difficulty: 'Fun',
    description: 'Draw and guess what others are sketching',
    aiAvailable: false
  }
]

const activeGames = [
  {
    id: '1',
    type: 'chess',
    host: 'Emma Thompson',
    players: 1,
    maxPlayers: 2,
    status: 'waiting',
    timeAgo: '2 min ago'
  },
  {
    id: '2',
    type: 'wordle',
    host: 'Michael Chen',
    players: 2,
    maxPlayers: 4,
    status: 'waiting',
    timeAgo: '5 min ago'
  },
  {
    id: '3',
    type: 'drawing',
    host: 'Sarah Wilson',
    players: 4,
    maxPlayers: 6,
    status: 'active',
    timeAgo: '1 min ago'
  },
  {
    id: '4',
    type: 'uno',
    host: 'David Park',
    players: 3,
    maxPlayers: 6,
    status: 'waiting',
    timeAgo: '8 min ago'
  }
]

export default function GamesPage() {
  const [selectedTab, setSelectedTab] = useState('browse')
  const [selectedGame, setSelectedGame] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [gameMode, setGameMode] = useState<'multiplayer' | 'ai'>('multiplayer')
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')

  const handlePlayWithAI = (gameId: string) => {
    // Navigate to AI game based on game type
    if (gameId === 'chess') {
      window.location.href = '/games/chess?mode=ai&difficulty=' + aiDifficulty
    } else if (gameId === 'tictactoe') {
      window.location.href = '/games/tictactoe?mode=ai&difficulty=' + aiDifficulty
    } else {
      setSelectedGame(gameId)
      setGameMode('ai')
      setShowCreateModal(true)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <div className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md z-50 px-4 py-3 border-b border-purple-100">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <Link href="/explore" className="w-8 h-8 flex items-center justify-center">
            <i className="ri-arrow-left-line text-xl text-gray-700"></i>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">Play Together</h1>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="w-8 h-8 flex items-center justify-center !rounded-button bg-purple-500 text-white"
          >
            <i className="ri-add-line text-lg"></i>
          </button>
        </div>
      </div>

      <div className="pt-16 pb-20 px-4">
        <div className="max-w-sm mx-auto space-y-6">
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">Game Zone</h2>
                <p className="text-purple-100 text-sm">Connect through play</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <i className="ri-gamepad-line text-2xl"></i>
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <div>
                <div className="font-semibold">24</div>
                <div className="text-purple-100">Active Games</div>
              </div>
              <div>
                <div className="font-semibold">156</div>
                <div className="text-purple-100">Players Online</div>
              </div>
            </div>
          </div>

          <div className="flex bg-gray-100 rounded-full p-1">
            <button
              onClick={() => setSelectedTab('browse')}
              className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
                selectedTab === 'browse' 
                  ? 'bg-white text-purple-600 shadow-sm' 
                  : 'text-gray-600'
              }`}
            >
              Browse Games
            </button>
            <button
              onClick={() => setSelectedTab('active')}
              className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
                selectedTab === 'active' 
                  ? 'bg-white text-purple-600 shadow-sm' 
                  : 'text-gray-600'
              }`}
            >
              Join Game
            </button>
          </div>

          {selectedTab === 'browse' && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Choose Your Game</h3>
              {gameTypes.map((game) => (
                <div key={game.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl flex items-center justify-center text-2xl">
                      {game.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{game.name}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          game.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                          game.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                          game.difficulty === 'Advanced' ? 'bg-red-100 text-red-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {game.difficulty}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{game.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                        <span className="flex items-center gap-1">
                          <i className="ri-user-line"></i>
                          {game.players}
                        </span>
                        <span className="flex items-center gap-1">
                          <i className="ri-time-line"></i>
                          {game.duration}
                        </span>
                        {game.aiAvailable && (
                          <span className="flex items-center gap-1 text-blue-600">
                            <i className="ri-robot-line"></i>
                            AI Available
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setSelectedGame(game.id)
                            setGameMode('multiplayer')
                            setShowCreateModal(true)
                          }}
                          className="flex-1 py-2 px-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium !rounded-button"
                        >
                          Multiplayer
                        </button>
                        {game.aiAvailable && (
                          <button 
                            onClick={() => handlePlayWithAI(game.id)}
                            className="flex-1 py-2 px-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg text-sm font-medium !rounded-button"
                          >
                            vs AI
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedTab === 'active' && (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">Join Active Games</h3>
              {activeGames.map((game) => {
                const gameInfo = gameTypes.find(g => g.id === game.type)
                return (
                  <div key={game.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center text-lg">
                        {gameInfo?.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-gray-900">{gameInfo?.name}</h4>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            game.status === 'waiting' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {game.status === 'waiting' ? 'Waiting' : 'In Progress'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-gray-600">
                            Host: {game.host} • {game.timeAgo}
                          </div>
                          <div className="text-purple-600 font-medium">
                            {game.players}/{game.maxPlayers} players
                          </div>
                        </div>
                      </div>
                    </div>
                    <button 
                      disabled={game.status === 'active' && game.players >= game.maxPlayers}
                      className="w-full mt-3 py-2 px-4 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium !rounded-button transition-colors"
                    >
                      {game.status === 'waiting' ? 'Join Game' : 'Watch Game'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t-xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">
                  {gameMode === 'ai' ? 'Play vs AI' : 'Create Game Room'}
                </h3>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="w-8 h-8 flex items-center justify-center text-gray-500"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Game Type</label>
                <select className="w-full p-3 border border-gray-200 rounded-lg">
                  {gameTypes.map((game) => (
                    <option key={game.id} value={game.id} selected={selectedGame === game.id}>
                      {game.name} - {game.players}
                    </option>
                  ))}
                </select>
              </div>

              {gameMode === 'multiplayer' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Room Settings</label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Private Room</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Allow Spectators</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {gameMode === 'ai' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">AI Difficulty</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['easy', 'medium', 'hard'].map((difficulty) => (
                      <button
                        key={difficulty}
                        onClick={() => setAiDifficulty(difficulty as 'easy' | 'medium' | 'hard')}
                        className={`py-2 px-3 rounded-lg text-sm font-medium !rounded-button transition-colors ${
                          aiDifficulty === difficulty
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <i className="ri-robot-line text-blue-500 mt-0.5"></i>
                      <div className="text-sm">
                        <div className="font-medium text-blue-900">AI Opponent</div>
                        <div className="text-blue-700">
                          {aiDifficulty === 'easy' && 'Perfect for beginners, makes some mistakes'}
                          {aiDifficulty === 'medium' && 'Balanced gameplay, challenging but fair'}
                          {aiDifficulty === 'hard' && 'Expert level AI, very challenging'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-lg font-medium !rounded-button"
                >
                  Cancel
                </button>
                <button 
                  className={`flex-1 py-3 px-4 text-white rounded-lg font-medium !rounded-button ${
                    gameMode === 'ai' 
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                      : 'bg-gradient-to-r from-purple-500 to-pink-500'
                  }`}
                >
                  {gameMode === 'ai' ? 'Start AI Game' : 'Create Room'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
        <div className="grid grid-cols-5 gap-1 max-w-sm mx-auto">
          <Link href="/explore" className="flex flex-col items-center justify-center py-2 text-gray-500">
            <i className="ri-compass-3-line text-lg mb-1"></i>
            <span className="text-xs">Explore</span>
          </Link>
          <Link href="/community" className="flex flex-col items-center justify-center py-2 text-gray-500">
            <i className="ri-chat-3-line text-lg mb-1"></i>
            <span className="text-xs">Community</span>
          </Link>
          <Link href="/games" className="flex flex-col items-center justify-center py-2 text-purple-600">
            <i className="ri-gamepad-line text-lg mb-1"></i>
            <span className="text-xs">Games</span>
          </Link>
          <Link href="/therapy" className="flex flex-col items-center justify-center py-2 text-gray-500">
            <i className="ri-heart-line text-lg mb-1"></i>
            <span className="text-xs">Support</span>
          </Link>
          <Link href="/profile" className="flex flex-col items-center justify-center py-2 text-gray-500">
            <i className="ri-user-line text-lg mb-1"></i>
            <span className="text-xs">Profile</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
