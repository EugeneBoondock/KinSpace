export interface UserProfile {
  id: string; // e.g., a UUID
  username: string;
  pseudonym: string | null; // for anonymous users
  isAnonymous: boolean;
  conditions: string[]; // array of strings, e.g., ["Lupus", "Fibromyalgia"]
  status: string | null; // e.g., "newly diagnosed", "stable", "flaring", "recovering", or null if not specified
  createdAt: Date;
  updatedAt: Date;
}
