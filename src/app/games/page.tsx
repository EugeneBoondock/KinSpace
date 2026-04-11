
'use client'

import { useState } from 'react'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'

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
    <div className="min-h-screen bg-brand-primary text-brand-background">
      <div className="fixed top-0 left-0 right-0 bg-brand-primary/95 backdrop-blur-md z-50 px-4 py-3 border-b border-[#eedfc8]/20">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <Link href="/explore" className="w-8 h-8 flex items-center justify-center">
            <i className="ri-arrow-left-line text-xl text-brand-background"></i>
          </Link>
          <h1 className="text-lg font-semibold text-brand-background">Play Together</h1>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#eedfc8] text-[#2A4A42]"
          >
            <i className="ri-add-line text-lg"></i>
          </button>
        </div>
      </div>

      <div className="pt-16 pb-20 px-4">
        <div className="max-w-sm mx-auto space-y-6">
          <div className="bg-[#2A4A42]/60 rounded-xl p-6 text-brand-background border border-brand-background/20">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">Game Zone</h2>
                <p className="text-brand-background/80 text-sm">Connect through play</p>
              </div>
              <div className="w-12 h-12 bg-brand-background/10 rounded-full flex items-center justify-center">
                <i className="ri-gamepad-line text-2xl text-brand-background"></i>
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <div>
                <div className="font-semibold">24</div>
                <div className="text-brand-background/70">Active Games</div>
              </div>
              <div>
                <div className="font-semibold">156</div>
                <div className="text-brand-background/70">Players Online</div>
              </div>
            </div>
          </div>

          <div className="flex bg-brand-background/10 rounded-full p-1 border border-brand-background/20">
            <button
              onClick={() => setSelectedTab('browse')}
              className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
                selectedTab === 'browse' 
                  ? 'bg-brand-background text-brand-primary shadow-sm' 
                  : 'text-brand-background/70'
              }`}
            >
              Browse Games
            </button>
            <button
              onClick={() => setSelectedTab('active')}
              className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
                selectedTab === 'active' 
                  ? 'bg-brand-background text-brand-primary shadow-sm' 
                  : 'text-brand-background/70'
              }`}
            >
              Join Game
            </button>
          </div>

          {selectedTab === 'browse' && (
            <div className="space-y-3">
              <h3 className="font-semibold text-brand-background">Choose Your Game</h3>
              {gameTypes.map((game) => (
                <div key={game.id} className="bg-[#2A4A42]/50 rounded-xl p-4 shadow-sm border border-brand-background/20">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-brand-background/10 rounded-xl flex items-center justify-center text-2xl text-brand-primary">
                      {game.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-brand-background">{game.name}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full border border-brand-background/30 ${
                          game.difficulty === 'Easy' ? 'bg-brand-background/15 text-brand-primary' :
                          game.difficulty === 'Medium' ? 'bg-brand-accent2/25 text-brand-background' :
                          game.difficulty === 'Advanced' ? 'bg-brand-accent1/30 text-brand-background' :
                          'bg-brand-background/15 text-brand-background'
                        }`}>
                          {game.difficulty}
                        </span>
                      </div>
                      <p className="text-sm text-brand-background/80 mb-3">{game.description}</p>
                      <div className="flex items-center gap-4 text-xs text-brand-background/70 mb-3">
                        <span className="flex items-center gap-1">
                          <i className="ri-user-line"></i>
                          {game.players}
                        </span>
                        <span className="flex items-center gap-1">
                          <i className="ri-time-line"></i>
                          {game.duration}
                        </span>
                        {game.aiAvailable && (
                          <span className="flex items-center gap-1 text-brand-background">
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
                          className="flex-1 py-2 px-3 bg-brand-background text-brand-primary rounded-lg text-sm font-semibold rounded-lg border border-brand-primary/40 hover:bg-brand-background/90"
                        >
                          Multiplayer
                        </button>
                        {game.aiAvailable && (
                          <button 
                            onClick={() => handlePlayWithAI(game.id)}
                            className="flex-1 py-2 px-3 bg-[#2A4A42] text-brand-background rounded-lg text-sm font-semibold rounded-lg border border-brand-background/30 hover:bg-[#2A4A42]/80"
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
              <h3 className="font-semibold text-brand-background">Join Active Games</h3>
              {activeGames.map((game) => {
                const gameInfo = gameTypes.find(g => g.id === game.type)
                return (
                  <div key={game.id} className="bg-[#2A4A42]/50 rounded-xl p-4 shadow-sm border border-brand-background/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-brand-background/10 rounded-lg flex items-center justify-center text-lg text-brand-primary">
                        {gameInfo?.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-brand-background">{gameInfo?.name}</h4>
                          <span className={`text-xs px-2 py-1 rounded-full border border-brand-background/30 ${
                            game.status === 'waiting' ? 'bg-brand-background/15 text-brand-primary' : 'bg-brand-accent1/30 text-brand-background'
                          }`}>
                            {game.status === 'waiting' ? 'Waiting' : 'In Progress'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-brand-background/80">
                            Host: {game.host} • {game.timeAgo}
                          </div>
                          <div className="text-brand-background font-medium">
                            {game.players}/{game.maxPlayers} players
                          </div>
                        </div>
                      </div>
                    </div>
                    <button 
                      disabled={game.status === 'active' && game.players >= game.maxPlayers}
                      className="w-full mt-3 py-2 px-4 bg-brand-background text-brand-primary hover:bg-brand-background/90 disabled:bg-[#2A4A42]/50 disabled:text-brand-background/60 disabled:cursor-not-allowed rounded-lg text-sm font-semibold rounded-lg transition-colors"
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
          <div className="bg-brand-primary rounded-t-xl w-full max-h-[80vh] overflow-y-auto text-brand-background border border-brand-background/20">
            <div className="sticky top-0 bg-brand-primary/95 border-b border-brand-background/20 px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-brand-background">
                  {gameMode === 'ai' ? 'Play vs AI' : 'Create Game Room'}
                </h3>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="w-8 h-8 flex items-center justify-center text-brand-background/70"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-brand-background mb-2">Game Type</label>
                <select className="w-full p-3 border border-brand-background/20 rounded-lg bg-[#2A4A42] text-brand-background">
                  {gameTypes.map((game) => (
                    <option key={game.id} value={game.id} selected={selectedGame === game.id}>
                      {game.name} - {game.players}
                    </option>
                  ))}
                </select>
              </div>

              {gameMode === 'multiplayer' && (
                <div>
                  <label className="block text-sm font-medium text-brand-background mb-2">Room Settings</label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-brand-background/80">Private Room</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-11 h-6 bg-[#2A4A42] border border-brand-background/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-brand-background after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-background"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-brand-background/80">Allow Spectators</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-[#2A4A42] border border-brand-background/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-brand-background after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-background"></div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {gameMode === 'ai' && (
                <div>
                  <label className="block text-sm font-medium text-brand-background mb-2">AI Difficulty</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['easy', 'medium', 'hard'].map((difficulty) => (
                      <button
                        key={difficulty}
                        onClick={() => setAiDifficulty(difficulty as 'easy' | 'medium' | 'hard')}
                        className={`py-2 px-3 rounded-lg text-sm font-medium rounded-lg transition-colors ${
                          aiDifficulty === difficulty
                            ? 'bg-brand-background text-brand-primary'
                            : 'bg-[#2A4A42]/60 text-brand-background hover:bg-[#2A4A42]/50'
                        }`}
                      >
                        {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 p-3 bg-brand-background/10 rounded-lg">
                    <div className="flex items-start gap-2 text-brand-background">
                      <i className="ri-robot-line mt-0.5"></i>
                      <div className="text-sm">
                        <div className="font-medium text-brand-background">AI Opponent</div>
                        <div className="text-brand-background/80">
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
                  className="flex-1 py-3 px-4 border border-brand-background/30 text-brand-background rounded-lg font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  className={`flex-1 py-3 px-4 text-white rounded-lg font-medium rounded-lg ${
                    gameMode === 'ai' 
                      ? 'bg-brand-background text-brand-primary'
                      : 'bg-[#2A4A42] text-brand-background border border-brand-background/30'
                  }`}
                >
                  {gameMode === 'ai' ? 'Start AI Game' : 'Create Room'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
