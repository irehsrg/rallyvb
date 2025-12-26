import { Player, AdminRole } from '../types';
import { supabase } from '../lib/supabase';

// Cache for admin venue assignments
let venueAssignmentsCache: Map<string, string[]> = new Map();
let cacheTimestamp: number = 0;
const CACHE_TTL = 60000; // 1 minute

export interface AdminPermissions {
  // Session management
  canCreateSession: boolean;
  canCancelSession: boolean;
  canManageCheckins: boolean;
  canGenerateTeams: boolean;

  // Game management
  canRecordScores: boolean;
  canEditTeams: boolean;
  canDeleteGames: boolean;

  // Venue management
  canManageVenues: boolean;

  // Player management
  canAdjustRatings: boolean;
  canManageAdmins: boolean;
  canBanPlayers: boolean;

  // Settings
  canCreateTemplates: boolean;
  canCreateRecurringSessions: boolean;
  canViewActivityLog: boolean;

  // Team & Tournament management
  canCreateTeams: boolean;
  canManageOwnTeams: boolean;
  canManageAllTeams: boolean;
  canCreateTournaments: boolean;
  canManageTournaments: boolean;
  canRegisterTeamsForTournaments: boolean;

  // Host / Open Sessions (Event Feed)
  canCreateOpenSessions: boolean;
  canManageOwnOpenSessions: boolean;
  canManageAllOpenSessions: boolean;
}

export function getAdminPermissions(player: Player | null): AdminPermissions {
  if (!player?.is_admin) {
    return {
      canCreateSession: false,
      canCancelSession: false,
      canManageCheckins: false,
      canGenerateTeams: false,
      canRecordScores: false,
      canEditTeams: false,
      canDeleteGames: false,
      canManageVenues: false,
      canAdjustRatings: false,
      canManageAdmins: false,
      canBanPlayers: false,
      canCreateTemplates: false,
      canCreateRecurringSessions: false,
      canViewActivityLog: false,
      canCreateTeams: false,
      canManageOwnTeams: false,
      canManageAllTeams: false,
      canCreateTournaments: false,
      canManageTournaments: false,
      canRegisterTeamsForTournaments: false,
      canCreateOpenSessions: false,
      canManageOwnOpenSessions: false,
      canManageAllOpenSessions: false,
    };
  }

  const role = player.admin_role || 'scorekeeper'; // Default to most restricted

  switch (role) {
    case 'super_admin':
      // Super admin can do everything
      return {
        canCreateSession: true,
        canCancelSession: true,
        canManageCheckins: true,
        canGenerateTeams: true,
        canRecordScores: true,
        canEditTeams: true,
        canDeleteGames: true,
        canManageVenues: true,
        canAdjustRatings: true,
        canManageAdmins: true,
        canBanPlayers: true,
        canCreateTemplates: true,
        canCreateRecurringSessions: true,
        canViewActivityLog: true,
        canCreateTeams: true,
        canManageOwnTeams: true,
        canManageAllTeams: true,
        canCreateTournaments: true,
        canManageTournaments: true,
        canRegisterTeamsForTournaments: true,
        canCreateOpenSessions: true,
        canManageOwnOpenSessions: true,
        canManageAllOpenSessions: true,
      };

    case 'location_admin':
      // Can manage active sessions and games, but not create new sessions or manage settings
      return {
        canCreateSession: false,
        canCancelSession: false,
        canManageCheckins: true,
        canGenerateTeams: true,
        canRecordScores: true,
        canEditTeams: true,
        canDeleteGames: true,
        canManageVenues: false,
        canAdjustRatings: false,
        canManageAdmins: false,
        canBanPlayers: false,
        canCreateTemplates: false,
        canCreateRecurringSessions: false,
        canViewActivityLog: false,
        canCreateTeams: false,
        canManageOwnTeams: false,
        canManageAllTeams: false,
        canCreateTournaments: false,
        canManageTournaments: false,
        canRegisterTeamsForTournaments: false,
        canCreateOpenSessions: false,
        canManageOwnOpenSessions: false,
        canManageAllOpenSessions: false,
      };

    case 'scorekeeper':
      // Can only record scores and manage check-ins
      return {
        canCreateSession: false,
        canCancelSession: false,
        canManageCheckins: true,
        canGenerateTeams: false,
        canRecordScores: true,
        canEditTeams: false,
        canDeleteGames: false,
        canManageVenues: false,
        canAdjustRatings: false,
        canManageAdmins: false,
        canBanPlayers: false,
        canCreateTemplates: false,
        canCreateRecurringSessions: false,
        canViewActivityLog: false,
        canCreateTeams: false,
        canManageOwnTeams: false,
        canManageAllTeams: false,
        canCreateTournaments: false,
        canManageTournaments: false,
        canRegisterTeamsForTournaments: false,
        canCreateOpenSessions: false,
        canManageOwnOpenSessions: false,
        canManageAllOpenSessions: false,
      };

    case 'team_manager':
      // Can create and manage their own teams, register for tournaments
      return {
        canCreateSession: false,
        canCancelSession: false,
        canManageCheckins: false,
        canGenerateTeams: false,
        canRecordScores: false,
        canEditTeams: false,
        canDeleteGames: false,
        canManageVenues: false,
        canAdjustRatings: false,
        canManageAdmins: false,
        canBanPlayers: false,
        canCreateTemplates: false,
        canCreateRecurringSessions: false,
        canViewActivityLog: false,
        canCreateTeams: true,
        canManageOwnTeams: true,
        canManageAllTeams: false,
        canCreateTournaments: false,
        canManageTournaments: false,
        canRegisterTeamsForTournaments: true,
        canCreateOpenSessions: false,
        canManageOwnOpenSessions: false,
        canManageAllOpenSessions: false,
      };

    case 'host':
      // Can create and manage open sessions (events) for the public feed
      return {
        canCreateSession: false,
        canCancelSession: false,
        canManageCheckins: false,
        canGenerateTeams: false,
        canRecordScores: false,
        canEditTeams: false,
        canDeleteGames: false,
        canManageVenues: false,
        canAdjustRatings: false,
        canManageAdmins: false,
        canBanPlayers: false,
        canCreateTemplates: false,
        canCreateRecurringSessions: false,
        canViewActivityLog: false,
        canCreateTeams: false,
        canManageOwnTeams: false,
        canManageAllTeams: false,
        canCreateTournaments: false,
        canManageTournaments: false,
        canRegisterTeamsForTournaments: false,
        canCreateOpenSessions: true,
        canManageOwnOpenSessions: true,
        canManageAllOpenSessions: false,
      };

    default:
      // Unknown role, default to scorekeeper
      return getAdminPermissions({ ...player, admin_role: 'scorekeeper' });
  }
}

export function getAdminRoleDisplayName(role?: AdminRole): string {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'location_admin':
      return 'Location Admin';
    case 'scorekeeper':
      return 'Scorekeeper';
    case 'team_manager':
      return 'Team Manager';
    case 'host':
      return 'Host';
    default:
      return 'Admin';
  }
}

export function getAdminRoleDescription(role: AdminRole): string {
  switch (role) {
    case 'super_admin':
      return 'Full access to all admin features including settings, venues, and user management';
    case 'location_admin':
      return 'Can manage active sessions, teams, and game results at assigned venues';
    case 'scorekeeper':
      return 'Can manage check-ins and record game scores';
    case 'team_manager':
      return 'Can create and manage teams, add/remove players, and register for tournaments';
    case 'host':
      return 'Can create and manage public events/open sessions for the community feed';
    default:
      return '';
  }
}

// ============================================
// VENUE SCOPING FUNCTIONS
// ============================================

/**
 * Get the venue IDs assigned to an admin.
 * Super admins get all venues, others get only assigned venues.
 */
export async function getAssignedVenueIds(player: Player | null): Promise<string[]> {
  if (!player?.is_admin) {
    return [];
  }

  // Super admins can access all venues
  if (player.admin_role === 'super_admin') {
    const { data } = await supabase
      .from('venues')
      .select('id')
      .eq('is_active', true);
    return data?.map(v => v.id) || [];
  }

  // Check cache first
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL && venueAssignmentsCache.has(player.id)) {
    return venueAssignmentsCache.get(player.id) || [];
  }

  // Fetch assignments from database
  const { data, error } = await supabase
    .from('admin_venue_assignments')
    .select('venue_id')
    .eq('admin_id', player.id);

  if (error) {
    console.error('Error fetching venue assignments:', error);
    return [];
  }

  const venueIds = data?.map(a => a.venue_id) || [];

  // Update cache
  venueAssignmentsCache.set(player.id, venueIds);
  cacheTimestamp = now;

  return venueIds;
}

/**
 * Check if an admin can access a specific venue.
 * Super admins can access all, others only their assigned venues.
 */
export async function canAccessVenue(player: Player | null, venueId: string): Promise<boolean> {
  if (!player?.is_admin) {
    return false;
  }

  // Super admins can access all venues
  if (player.admin_role === 'super_admin') {
    return true;
  }

  const assignedVenues = await getAssignedVenueIds(player);
  return assignedVenues.includes(venueId);
}

/**
 * Check if admin can access a session based on venue.
 * Returns true if session has no venue or admin has access to the venue.
 */
export async function canAccessSession(
  player: Player | null,
  sessionVenueId: string | null | undefined
): Promise<boolean> {
  if (!player?.is_admin) {
    return false;
  }

  // Super admins can access all sessions
  if (player.admin_role === 'super_admin') {
    return true;
  }

  // Sessions without venues can be accessed by any admin
  if (!sessionVenueId) {
    return true;
  }

  return canAccessVenue(player, sessionVenueId);
}

/**
 * Clear the venue assignments cache.
 * Call this after assignments are updated.
 */
export function clearVenueAssignmentsCache(): void {
  venueAssignmentsCache.clear();
  cacheTimestamp = 0;
}

/**
 * Check if admin is venue-scoped (not super_admin).
 */
export function isVenueScoped(player: Player | null): boolean {
  if (!player?.is_admin) {
    return false;
  }
  return player.admin_role !== 'super_admin';
}
