export interface UserProfile {
  id: string; // e.g., a UUID
  username: string;
  pseudonym: string | null; // for anonymous users
  isAnonymous: boolean;
  conditions: string[]; // array of strings, e.g., ["Lupus", "Fibromyalgia"]
  comorbidities?: string[]; // optional
  medications?: string[]; // optional
  status: string | null; // e.g., "newly diagnosed", "stable", "flaring", "recovering", or null if not specified
  createdAt: Date;
  updatedAt: Date;
  // TODO: Add moodCharts, painCharts, selfCareSchedule, gamification, etc.
}
