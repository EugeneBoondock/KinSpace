export interface UserProfile {
  id: string; // e.g., a UUID
  username: string;
  pseudonym: string | null; // for anonymous users
  isAnonymous: boolean;
  conditions: string[]; // array of strings, e.g., ["Lupus", "Fibromyalgia"]
  comorbidities?: string[]; // optional
  medications?: string[]; // optional
  status: string | null; // e.g., "newly diagnosed", "stable", "flaring", "recovering", or null if not specified
  createdAt: string | Date;
  updatedAt: string | Date;
  profileImageUrl?: string;
  coverImageUrl?: string;
  bio?: string;
  interests?: string[];
  pronouns?: string;
  location?: string;
  followers?: number;
  following?: number;
  postsCount?: number;
  // TODO: Add moodCharts, painCharts, selfCareSchedule, gamification, etc.
}
