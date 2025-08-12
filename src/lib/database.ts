
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
import { supabase, type Database } from './supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];

export class DatabaseService {
  // Profile operations
  static async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) throw error
    return data
  }

      static async updateProfile(userId: string, updates: Partial<Profile>) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Angels operations
  static async getAvailableAngels(excludeUserId: string) {
    const { data, error } = await supabase
      .from('angels')
      .select(`
        *,
        profiles (username, full_name, avatar_url)
      `)
      .eq('is_available', true)
      .lt('current_souls', supabase.rpc('get_max_souls'))
      .neq('user_id', excludeUserId)

    if (error) throw error
    return data
  }

  static async getUserAngels(soulId: string) {
    const { data, error } = await supabase
      .from('angel_soul_relationships')
      .select(`
        *,
        angels (
          *,
          profiles (username, full_name, avatar_url)
        )
      `)
      .eq('soul_id', soulId)
      .eq('relationship_status', 'active')

    if (error) throw error
    return data
  }

  static async chooseAngel(soulId: string, angelId: string) {
    const { data, error } = await supabase
      .from('angel_soul_relationships')
      .insert({
        soul_id: soulId,
        angel_id: angelId,
        relationship_status: 'active'
      })

    if (error) throw error

    await supabase
      .from('angels')
      .update({
        current_souls: supabase.rpc('increment_souls', { angel_id: angelId })
      })
      .eq('id', angelId)

    return data
  }

  // Games operations
  static async createGame(hostId: string, gameType: string, maxPlayers: number, isPrivate = false) {
    const roomCode = isPrivate ? Math.random().toString(36).substring(2, 8).toUpperCase() : null

    const { data, error } = await supabase
      .from('games')
      .insert({
        host_id: hostId,
        game_type: gameType,
        max_players: maxPlayers,
        is_private: isPrivate,
        room_code: roomCode,
        status: 'waiting',
        game_state: this.getInitialGameState(gameType)
      })
      .select()
      .single()

    if (error) throw error

    await supabase
      .from('game_players')
      .insert({
        game_id: data.id,
        user_id: hostId,
        player_order: 1
      })

    return data
  }

  static async joinGame(gameId: string, userId: string) {
    const { data: game } = await supabase
      .from('games')
      .select('current_players, max_players')
      .eq('id', gameId)
      .single()

    if (!game || game.current_players >= game.max_players) {
      throw new Error('Game is full')
    }

    const { data, error } = await supabase
      .from('game_players')
      .insert({
        game_id: gameId,
        user_id: userId,
        player_order: game.current_players + 1
      })

    if (error) throw error

    await supabase
      .from('games')
      .update({
        current_players: game.current_players + 1,
        status: game.current_players + 1 >= game.max_players ? 'active' : 'waiting'
      })
      .eq('id', gameId)

    return data
  }

  static async getActiveGames(gameType?: string) {
    let query = supabase
      .from('games')
      .select(`
        *,
        profiles (username, full_name, avatar_url),
        game_players (
          user_id,
          profiles (username, full_name, avatar_url)
        )
      `)
      .eq('status', 'waiting')
      .eq('is_private', false)

    if (gameType) {
      query = query.eq('game_type', gameType)
    }

    const { data, error } = await query

    if (error) throw error
    return data
  }

      static async updateGameState(gameId: string, gameState: Json) {
    const { data, error } = await supabase
      .from('games')
      .update({
        game_state: gameState,
        updated_at: new Date().toISOString()
      })
      .eq('id', gameId)

    if (error) throw error
    return data
  }

  // Community posts
  static async getCommunityPosts(limit = 20, offset = 0) {
    const { data, error } = await supabase
      .from('community_posts')
      .select(`
        *,
        profiles (username, full_name, avatar_url)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return data
  }

  static async createPost(userId: string, content: string, type: string, tags?: string[], isAnonymous = false) {
    const { data, error } = await supabase
      .from('community_posts')
      .insert({
        user_id: userId,
        content,
        type,
        tags,
        is_anonymous: isAnonymous
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Chat messages
  static async sendMessage(senderId: string, receiverId: string | null, roomId: string | null, message: string, isAI = false) {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        room_id: roomId,
        message,
        is_ai: isAI,
        message_type: 'text'
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async getMessages(roomId: string, limit = 50) {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        *,
        profiles (username, full_name, avatar_url)
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) throw error
    return data
  }

  // Helper function for initial game states
  private static getInitialGameState(gameType: string) {
    switch (gameType) {
      case 'chess':
        return {
          board: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          turn: 'white',
          moves: []
        }
      case 'checkers':
        return {
          board: Array(8).fill(null).map((_, row) => 
            Array(8).fill(null).map((_, col) => {
              if ((row + col) % 2 === 1) {
                if (row < 3) return 'red'
                if (row > 4) return 'black'
              }
              return null
            })
          ),
          turn: 'red'
        }
      case 'tictactoe':
        return {
          board: Array(9).fill(null),
          turn: 'X'
        }
      case 'wordle':
        return {
          word: 'REACT',
          guesses: [],
          currentGuess: '',
          gameOver: false
        }
      default:
        return {}
    }
  }
}
