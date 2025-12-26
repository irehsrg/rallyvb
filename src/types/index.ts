// TypeScript types for the Volleyball Pickup Manager

export type PlayerPosition = 'setter' | 'outside' | 'middle' | 'opposite' | 'libero' | 'any';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type AdminRole = 'super_admin' | 'location_admin' | 'scorekeeper' | 'team_manager' | 'host';

export interface NotificationPreferences {
  session_created: boolean;
  session_reminder: boolean;
  waitlist_update: boolean;
  game_results: boolean;
}

export interface PushSubscription {
  id: string;
  player_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  user_agent?: string;
  created_at: string;
  last_used_at: string;
}

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
  // Push notification fields
  push_notifications_enabled?: boolean;
  notification_preferences?: NotificationPreferences;
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

// ============================================================================
// TEAMS & TOURNAMENTS TYPES
// ============================================================================

export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin';
export type TournamentStatus = 'setup' | 'active' | 'completed' | 'cancelled';
export type TeamMemberRole = 'manager' | 'member';
export type TournamentTeamStatus = 'active' | 'eliminated' | 'champion' | 'runner_up';
export type MatchRound = 'round_of_32' | 'round_of_16' | 'quarterfinals' | 'semifinals' | 'finals' | 'third_place' | string;

export interface Team {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  wins: number;
  losses: number;
  tournaments_played: number;
  // Joined data
  members?: TeamMember[];
  managers?: Player[];
}

export interface TeamMember {
  id: string;
  team_id: string;
  player_id: string;
  role: TeamMemberRole;
  joined_at: string;
  is_active: boolean;
  // Joined data
  player?: Player;
  team?: Team;
}

export interface Tournament {
  id: string;
  name: string;
  description?: string;
  format: TournamentFormat;
  best_of: 1 | 3 | 5 | 7;
  status: TournamentStatus;
  start_date: string;
  end_date?: string;
  venue_id?: string;
  created_by?: string;
  created_at: string;
  completed_at?: string;
  max_teams?: number;
  points_to_win: number;
  deciding_set_points: number;
  min_point_difference: number;
  // Joined data
  venue?: Venue;
  teams?: TournamentTeam[];
}

export interface TournamentTeam {
  id: string;
  tournament_id: string;
  team_id: string;
  seed?: number;
  status: TournamentTeamStatus;
  wins: number;
  losses: number;
  created_at: string;
  // Joined data
  team?: Team;
  tournament?: Tournament;
}

export interface SetScore {
  team_a: number;
  team_b: number;
}

// Extended Game interface for tournament support
export interface TournamentGame extends Game {
  tournament_id: string;
  match_round?: MatchRound;
  set_number: number;
  set_scores?: SetScore[];
  match_winner?: 'A' | 'B';
  team_a_id?: string;
  team_b_id?: string;
  // Joined tournament data
  team_a_entity?: Team;
  team_b_entity?: Team;
}

export interface TeamStatistics {
  team_id: string;
  team_name: string;
  active_members: number;
  tournaments_entered: number;
  total_match_wins: number;
  total_matches_played: number;
  win_percentage: number;
}

// ============================================================================
// HOST ROLE & OPEN SESSIONS (EVENT FEED) TYPES
// ============================================================================

export type EventSkillLevel = 'all_levels' | 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type OpenSessionStatus = 'draft' | 'upcoming' | 'active' | 'completed' | 'cancelled';
export type RSVPStatus = 'going' | 'maybe' | 'not_going';
export type TournamentRegistrationMode = 'team_only' | 'individuals_allowed' | 'individuals_only';

export interface OpenSession {
  id: string;
  host_id: string;
  title: string;
  description?: string;
  // Location
  venue_id?: string;
  custom_location?: string;
  custom_address?: string;
  google_maps_url?: string;
  // Timing
  event_date: string;
  start_time: string;
  end_time?: string;
  // Capacity & Requirements
  max_players?: number;
  min_players: number;
  skill_level: EventSkillLevel;
  // Settings
  is_public: boolean;
  allow_comments: boolean;
  rsvp_deadline?: string;
  // Status
  status: OpenSessionStatus;
  cancelled_at?: string;
  cancellation_reason?: string;
  // Metadata
  created_at: string;
  updated_at: string;
  // Joined data
  host?: Player;
  venue?: Venue;
  rsvps?: OpenSessionRSVP[];
  comments?: OpenSessionComment[];
  rsvp_counts?: {
    going: number;
    maybe: number;
    not_going: number;
  };
}

export interface OpenSessionRSVP {
  id: string;
  session_id: string;
  player_id: string;
  status: RSVPStatus;
  created_at: string;
  updated_at: string;
  // Joined data
  player?: Player;
}

export interface OpenSessionComment {
  id: string;
  session_id: string;
  player_id: string;
  parent_id?: string;
  content: string;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  player?: Player;
  replies?: OpenSessionComment[];
}

// ============================================================================
// TOURNAMENT REGISTRATION TYPES
// ============================================================================

export interface TournamentIndividualRegistration {
  id: string;
  tournament_id: string;
  player_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'assigned_to_team';
  assigned_team_id?: string;
  notes?: string;
  created_at: string;
  // Joined data
  player?: Player;
  assigned_team?: Team;
  tournament?: Tournament;
}

export interface TournamentTeamRegistration {
  id: string;
  tournament_id: string;
  team_id: string;
  registered_by: string;
  status: 'pending' | 'approved' | 'rejected';
  roster_snapshot?: TeamMember[];
  notes?: string;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  // Joined data
  team?: Team;
  tournament?: Tournament;
  registrant?: Player;
  reviewer?: Player;
}

// Extended Tournament fields for registration
export interface TournamentRegistrationSettings {
  registration_mode: TournamentRegistrationMode;
  allow_self_registration: boolean;
  registration_deadline?: string;
  min_team_size: number;
  max_team_size: number;
}

// ============================================================================
// MULTI-VENUE SUPPORT TYPES
// ============================================================================

export type VenueFollowType = 'explicit' | 'auto';

export interface PlayerVenueFollow {
  id: string;
  player_id: string;
  venue_id: string;
  follow_type: VenueFollowType;
  created_at: string;
  // Joined data
  venue?: Venue;
  player?: Player;
}

export interface AdminVenueAssignment {
  id: string;
  admin_id: string;
  venue_id: string;
  assigned_by?: string;
  created_at: string;
  // Joined data
  venue?: Venue;
  admin?: Player;
  assigner?: Player;
}

// ============================================================================
// STATISTICS TYPES
// ============================================================================

export interface GlobalStatistics {
  totalPlayers: number;
  totalGames: number;
  avgPointDifferential: number;
  closeGamePercentage: number;
  avgTotalPoints: number;
}

export interface RatingBucket {
  bucket: number; // e.g., 1200, 1300, 1400
  count: number;
}

export interface PlayerActivity {
  playerId: string;
  playerName: string;
  profilePhotoUrl?: string;
  gamesLastMonth: number;
  ratingChange: number;
  currentRating: number;
}

export interface RatingTrend {
  date: string;
  avgRating: number;
  gamesPlayed: number;
}

export interface HeadToHeadStats {
  player1: Player;
  player2: Player;
  player1Wins: number;
  player2Wins: number;
  totalGames: number;
  lastPlayed?: string;
  recentGames: HeadToHeadGame[];
}

export interface HeadToHeadGame {
  gameId: string;
  date: string;
  winnerId: string;
  scoreA: number;
  scoreB: number;
  player1Team: 'A' | 'B';
}

export interface GameOutcomeDistribution {
  close: number;      // 0-3 point difference
  moderate: number;   // 4-7 point difference
  blowout: number;    // 8+ point difference
}

// ============================================================================
// OFFLINE SUPPORT TYPES
// ============================================================================

export type PendingActionType =
  | 'checkin'
  | 'checkout'
  | 'record_score'
  | 'update_profile'
  | 'follow_venue'
  | 'unfollow_venue';

export interface PendingAction {
  id: string;
  action: PendingActionType;
  payload: Record<string, any>;
  createdAt: number;
  retryCount: number;
}

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  lastSync: number | null;
  isSyncing: boolean;
}

export interface CachedData<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
}
