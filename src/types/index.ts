// TypeScript types for the Volleyball Pickup Manager

export type PlayerPosition = 'setter' | 'outside' | 'middle' | 'opposite' | 'libero' | 'any';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type AdminRole = 'super_admin' | 'location_admin' | 'scorekeeper';

export interface Player {
  id: string;
  name: string;
  rating: number;
  games_played: number;
  wins: number;
  losses: number;
  win_streak: number;
  best_win_streak: number;
  is_admin: boolean;
  created_at: string;
  last_played_at: string | null;
  // New fields
  position?: PlayerPosition;
  skill_level?: SkillLevel;
  bio?: string;
  profile_photo_url?: string;
  highest_rating?: number;
  admin_role?: AdminRole;
  is_banned?: boolean;
  ban_reason?: string;
  ban_until?: string | null;
  is_guest?: boolean; // TRUE for temporary guest players
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  google_maps_url?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface Session {
  id: string;
  date: string;
  status: 'setup' | 'active' | 'completed' | 'cancelled';
  court_count: number;
  created_by: string;
  created_at: string;
  completed_at: string | null;
  location?: string;
  location_name?: string;
  venue_id?: string; // Reference to managed venue
  venue?: Venue; // Joined venue data
  // New fields
  max_players?: number;
  checkin_deadline?: string;
  notes?: string;
  is_recurring?: boolean;
  recurrence_pattern?: string; // 'weekly', 'biweekly', 'monthly'
  recurrence_day?: number; // 0-6 for day of week
  template_name?: string;
  cancelled_at?: string | null;
  cancellation_reason?: string;
}

export interface SessionCheckin {
  id: string;
  session_id: string;
  player_id: string;
  checked_in_at: string;
  player?: Player; // Joined data
}

export interface Game {
  id: string;
  session_id: string;
  court_number: number;
  score_a: number | null;
  score_b: number | null;
  winner: 'A' | 'B' | null;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  completed_at: string | null;
  team_a?: Player[]; // Joined data
  team_b?: Player[]; // Joined data
}

export interface GamePlayer {
  id: string;
  game_id: string;
  player_id: string;
  team: 'A' | 'B';
  rating_before: number;
  rating_after: number | null;
  rating_change: number | null;
}

export interface RatingHistory {
  id: string;
  player_id: string;
  game_id: string;
  previous_rating: number;
  new_rating: number;
  change: number;
  created_at: string;
}

// Utility types
export interface TeamAssignment {
  courtNumber: number;
  teamA: Player[];
  teamB: Player[];
}

export interface BalanceScore {
  avgA: number;
  avgB: number;
  difference: number;
  fairnessPercent: number;
}

// New tables/types
export interface Achievement {
  id: string;
  player_id: string;
  achievement_type: string; // 'first_game', 'games_10', 'games_50', 'win_streak_5', 'win_streak_10', 'top_10', 'rating_1600', etc.
  unlocked_at: string;
  progress?: number;
}

export interface Endorsement {
  id: string;
  from_player_id: string;
  to_player_id: string;
  endorsement_type: string; // 'great_teammate', 'amazing_setter', 'clutch_player', etc.
  message?: string;
  created_at: string;
}

export interface PlayerRelationship {
  id: string;
  player_id: string;
  related_player_id: string;
  relationship_type: 'favorite' | 'avoid';
  created_at: string;
}

export interface Waitlist {
  id: string;
  session_id: string;
  player_id: string;
  position: number;
  created_at: string;
  notified: boolean;
}

export interface AdminActivityLog {
  id: string;
  admin_id: string;
  action: string;
  entity_type: string; // 'session', 'player', 'game', etc.
  entity_id: string;
  details?: any; // JSON object with specifics
  created_at: string;
}

export interface SessionTemplate {
  id: string;
  admin_id: string;
  name: string;
  court_count: number;
  location_name?: string;
  max_players?: number;
  notes?: string;
  created_at: string;
}

export interface DisputeReport {
  id: string;
  reporter_id: string;
  game_id: string;
  reason: string;
  details: string;
  status: 'pending' | 'resolved' | 'rejected';
  resolved_by?: string;
  resolution_notes?: string;
  created_at: string;
  resolved_at?: string;
}

export interface FeedbackReport {
  id: string;
  player_id: string;
  category: 'bug' | 'feature' | 'issue' | 'other';
  title: string;
  description: string;
  status: 'new' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
}

export interface PlayerGroup {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PlayerGroupMember {
  id: string;
  group_id: string;
  player_id: string;
  created_at: string;
  player?: Player; // Joined data
}

export interface SessionGroupRequest {
  id: string;
  session_id: string;
  group_id: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string;
  group?: PlayerGroup; // Joined data
  members?: PlayerGroupMember[]; // Joined data
}
