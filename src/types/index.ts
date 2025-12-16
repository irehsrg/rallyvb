// TypeScript types for the Volleyball Pickup Manager

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
}

export interface Session {
  id: string;
  date: string;
  status: 'setup' | 'active' | 'completed';
  court_count: number;
  created_by: string;
  created_at: string;
  completed_at: string | null;
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
