
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          username: string
          full_name: string
          avatar_url: string | null
          bio: string | null
          location: string | null
          phone: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          mental_health_goals: string[] | null
          preferred_communication: string
          timezone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          username: string
          full_name: string
          avatar_url?: string | null
          bio?: string | null
          location?: string | null
          phone?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          mental_health_goals?: string[] | null
          preferred_communication?: string
          timezone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          username?: string
          full_name?: string
          avatar_url?: string | null
          bio?: string | null
          location?: string | null
          phone?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          mental_health_goals?: string[] | null
          preferred_communication?: string
          timezone?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      angels: {
        Row: {
          id: string
          user_id: string
          specialty: string
          experience_years: number
          max_souls: number
          current_souls: number
          response_time: string
          rating: number
          total_reviews: number
          is_available: boolean
          support_style: string
          bio: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          specialty: string
          experience_years: number
          max_souls?: number
          current_souls?: number
          response_time: string
          rating?: number
          total_reviews?: number
          is_available?: boolean
          support_style: string
          bio: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          specialty?: string
          experience_years?: number
          max_souls?: number
          current_souls?: number
          response_time?: string
          rating?: number
          total_reviews?: number
          is_available?: boolean
          support_style?: string
          bio?: string
          created_at?: string
          updated_at?: string
        }
      }
      angel_soul_relationships: {
        Row: {
          id: string
          soul_id: string
          angel_id: string
          started_at: string
          last_checkin: string | null
          next_checkin: string | null
          relationship_status: string
          created_at: string
        }
        Insert: {
          id?: string
          soul_id: string
          angel_id: string
          started_at?: string
          last_checkin?: string | null
          next_checkin?: string | null
          relationship_status?: string
          created_at?: string
        }
        Update: {
          id?: string
          soul_id?: string
          angel_id?: string
          started_at?: string
          last_checkin?: string | null
          next_checkin?: string | null
          relationship_status?: string
          created_at?: string
        }
      }
      mentors: {
        Row: {
          id: string
          user_id: string
          expertise: string[]
          experience_years: number
          sessions_completed: number
          rating: number
          total_reviews: number
          is_available: boolean
          session_price: number
          bio: string
          credentials: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          expertise: string[]
          experience_years: number
          sessions_completed?: number
          rating?: number
          total_reviews?: number
          is_available?: boolean
          session_price: number
          bio: string
          credentials?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          expertise?: string[]
          experience_years?: number
          sessions_completed?: number
          rating?: number
          total_reviews?: number
          is_available?: boolean
          session_price?: number
          bio?: string
          credentials?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      games: {
        Row: {
          id: string
          host_id: string
          game_type: string
          game_state: unknown
          status: string
          max_players: number
          current_players: number
          is_private: boolean
          room_code: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          host_id: string
          game_type: string
          game_state?: unknown
          status?: string
          max_players: number
          current_players?: number
          is_private?: boolean
          room_code?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          host_id?: string
          game_type?: string
          game_state?: unknown
          status?: string
          max_players?: number
          current_players?: number
          is_private?: boolean
          room_code?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      game_players: {
        Row: {
          id: string
          game_id: string
          user_id: string
          player_order: number
          joined_at: string
        }
        Insert: {
          id?: string
          game_id: string
          user_id: string
          player_order: number
          joined_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          user_id?: string
          player_order?: number
          joined_at?: string
        }
      }
      community_posts: {
        Row: {
          id: string
          user_id: string
          content: string
          type: string
          tags: string[] | null
          likes_count: number
          comments_count: number
          is_anonymous: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          content: string
          type: string
          tags?: string[] | null
          likes_count?: number
          comments_count?: number
          is_anonymous?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          content?: string
          type?: string
          tags?: string[] | null
          likes_count?: number
          comments_count?: number
          is_anonymous?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      group_activities: {
        Row: {
          id: string
          title: string
          description: string
          host_id: string
          activity_type: string
          location: string | null
          max_participants: number
          current_participants: number
          scheduled_at: string
          duration_minutes: number
          is_virtual: boolean
          meeting_link: string | null
          tags: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          host_id: string
          activity_type: string
          location?: string | null
          max_participants: number
          current_participants?: number
          scheduled_at: string
          duration_minutes: number
          is_virtual?: boolean
          meeting_link?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          host_id?: string
          activity_type?: string
          location?: string | null
          max_participants?: number
          current_participants?: number
          scheduled_at?: string
          duration_minutes?: number
          is_virtual?: boolean
          meeting_link?: string | null
          tags?: string[] | null
          created_at?: string
          updated_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string | null
          room_id: string | null
          message: string
          message_type: string
          is_ai: boolean
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          sender_id: string
          receiver_id?: string | null
          room_id?: string | null
          message: string
          message_type?: string
          is_ai?: boolean
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          sender_id?: string
          receiver_id?: string | null
          room_id?: string | null
          message?: string
          message_type?: string
          is_ai?: boolean
          read_at?: string | null
          created_at?: string
        }
      }
    }
  }
}
