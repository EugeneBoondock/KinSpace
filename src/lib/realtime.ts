
'use client'

import { supabase, type Database } from './supabase';
import { 
  RealtimeChannel, 
  type RealtimePostgresChangesPayload, 
  type RealtimePresenceState 
} from '@supabase/supabase-js';

// Define types based on the database schema
type Game = Database['public']['Tables']['games']['Row'];
type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];

// Define payload types for realtime events
type GameUpdatePayload = RealtimePostgresChangesPayload<Game>;
type ChatMessagePayload = RealtimePostgresChangesPayload<ChatMessage>;

export class RealtimeService {
  private static channels: Map<string, RealtimeChannel> = new Map()

    static subscribeToGame(gameId: string, onGameUpdate: (payload: GameUpdatePayload) => void) {
    const channelName = `game:${gameId}`
    
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`
        },
        onGameUpdate
      )
      .subscribe()

    this.channels.set(channelName, channel)
    return channel
  }

    static subscribeToChat(roomId: string, onNewMessage: (payload: ChatMessagePayload) => void) {
    const channelName = `chat:${roomId}`
    
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`
        },
        onNewMessage
      )
      .subscribe()

    this.channels.set(channelName, channel)
    return channel
  }

    static subscribeToGameLobby(onGameUpdate: (payload: GameUpdatePayload) => void) {
    if (this.channels.has('game-lobby')) {
      return this.channels.get('game-lobby')!
    }

    const channel = supabase
      .channel('game-lobby')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games'
        },
        onGameUpdate
      )
      .subscribe()

    this.channels.set('game-lobby', channel)
    return channel
  }

    static subscribeToUserPresence(userId: string, onPresenceUpdate: (event: string, state: RealtimePresenceState) => void) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const channelName = `presence:${userId}`;

    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    const channel = supabase.channel(channelName);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        onPresenceUpdate('sync', state);
      })
      .on('presence', { event: 'join' }, () => {
        // For join, you might want to handle the specific new presences
        // For simplicity, we'll just sync the whole state
        const state = channel.presenceState();
        onPresenceUpdate('join', state);
      })
      .on('presence', { event: 'leave' }, () => {
        // For leave, you might want to handle the specific left presences
        // For simplicity, we'll just sync the whole state
        const state = channel.presenceState();
        onPresenceUpdate('leave', state);
      })
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  static unsubscribe(channelName: string) {
    const channel = this.channels.get(channelName)
    if (channel) {
      supabase.removeChannel(channel)
      this.channels.delete(channelName)
    }
  }

  static unsubscribeAll() {
    this.channels.forEach((channel, channelName) => {
      supabase.removeChannel(channel)
    })
    this.channels.clear()
  }

  static async broadcastGameMove(gameId: string, move: unknown, userId: string) {
    const channel = this.channels.get(`game:${gameId}`)
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'game-move',
        payload: { move, userId, timestamp: new Date().toISOString() }
      })
    }
  }

  static async updateUserPresence(channelName: string, presence: unknown) {
    const channel = this.channels.get(channelName)
    if (channel) {
      await channel.track(presence)
    }
  }
}
