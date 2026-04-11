export interface UserProfile {
  id: string
  email: string
  username: string
  full_name: string
  pseudonym?: string | null
  is_anonymous: boolean
  conditions: string[]
  comorbidities?: string[]
  medications?: string[]
  status: string | null
  age?: number | null
  bio?: string | null
  interests?: string[]
  pronouns?: string | null
  location?: string | null
  avatar_url?: string | null
  cover_image_url?: string | null
  followers?: number
  following?: number
  postsCount?: number
  emergency_contact?: string | null
  emergency_phone?: string | null
  mental_health_goals?: string[]
  preferred_communication?: string
  timezone?: string | null
  created_at?: unknown
  updated_at?: unknown
}

export interface Angel {
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
  profile?: Partial<UserProfile> | null
}

export interface Mentor {
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
  profile?: Partial<UserProfile> | null
}

export interface Game {
  id: string
  host_id: string
  game_type: string
  game_state: unknown
  status: string
  max_players: number
  current_players: number
  is_private: boolean
  room_code: string | null
}

export interface CommunityPost {
  id: string
  user_id: string
  content: string
  type: string
  tags: string[]
  likes_count: number
  comments_count: number
  is_anonymous: boolean
  profile?: Partial<UserProfile> | null
  created_at?: unknown
}

export interface ChatMessage {
  id: string
  sender_id: string
  receiver_id: string | null
  room_id: string | null
  message: string
  message_type: string
  is_ai: boolean
  created_at?: unknown
}

export interface SupportGroup {
  id: string
  name: string
  description: string
  category: string
  members_count: number
  type: 'virtual' | 'in-person'
  next_meeting?: string
  location?: string
  image_url?: string
}
