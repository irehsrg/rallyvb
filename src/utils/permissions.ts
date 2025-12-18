import { Player, AdminRole } from '../types';

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
    default:
      return 'Admin';
  }
}

export function getAdminRoleDescription(role: AdminRole): string {
  switch (role) {
    case 'super_admin':
      return 'Full access to all admin features including settings, venues, and user management';
    case 'location_admin':
      return 'Can manage active sessions, teams, and game results';
    case 'scorekeeper':
      return 'Can manage check-ins and record game scores';
    default:
      return '';
  }
}
