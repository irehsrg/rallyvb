import { supabase } from './supabase';
import {
  getPendingActions,
  removePendingAction,
  updatePendingAction,
  setLastSyncTime,
  cachePlayers,
  cacheVenues,
  cacheSession,
} from './offlineStorage';
import { PendingAction, PendingActionType } from '../types';

const MAX_RETRIES = 3;

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

// Process a single pending action
async function processAction(action: PendingAction): Promise<boolean> {
  try {
    switch (action.action) {
      case 'checkin':
        const { error: checkinError } = await supabase
          .from('session_checkins')
          .insert({
            session_id: action.payload.sessionId,
            player_id: action.payload.playerId,
          });
        if (checkinError) throw checkinError;
        break;

      case 'checkout':
        const { error: checkoutError } = await supabase
          .from('session_checkins')
          .delete()
          .eq('session_id', action.payload.sessionId)
          .eq('player_id', action.payload.playerId);
        if (checkoutError) throw checkoutError;
        break;

      case 'record_score':
        const { error: scoreError } = await supabase
          .from('games')
          .update({
            score_a: action.payload.scoreA,
            score_b: action.payload.scoreB,
            winner: action.payload.winner,
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', action.payload.gameId);
        if (scoreError) throw scoreError;
        break;

      case 'update_profile':
        const { error: profileError } = await supabase
          .from('players')
          .update(action.payload.updates)
          .eq('id', action.payload.playerId);
        if (profileError) throw profileError;
        break;

      case 'follow_venue':
        const { error: followError } = await supabase
          .from('player_venue_follows')
          .insert({
            player_id: action.payload.playerId,
            venue_id: action.payload.venueId,
            follow_type: 'explicit',
          });
        if (followError && followError.code !== '23505') throw followError; // Ignore duplicate
        break;

      case 'unfollow_venue':
        const { error: unfollowError } = await supabase
          .from('player_venue_follows')
          .delete()
          .eq('player_id', action.payload.playerId)
          .eq('venue_id', action.payload.venueId)
          .eq('follow_type', 'explicit');
        if (unfollowError) throw unfollowError;
        break;

      default:
        console.warn(`Unknown action type: ${action.action}`);
        return false;
    }

    return true;
  } catch (error) {
    console.error(`Error processing action ${action.id}:`, error);
    return false;
  }
}

// Sync all pending actions
export async function syncPendingActions(): Promise<SyncResult> {
  const actions = await getPendingActions();
  const result: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    errors: [],
  };

  for (const action of actions) {
    const success = await processAction(action);

    if (success) {
      await removePendingAction(action.id);
      result.synced++;
    } else {
      const newRetryCount = action.retryCount + 1;

      if (newRetryCount >= MAX_RETRIES) {
        // Max retries reached, remove action and log error
        await removePendingAction(action.id);
        result.failed++;
        result.errors.push(`Action ${action.action} failed after ${MAX_RETRIES} retries`);
      } else {
        // Update retry count
        await updatePendingAction({
          ...action,
          retryCount: newRetryCount,
        });
      }
    }
  }

  if (result.failed > 0) {
    result.success = false;
  }

  await setLastSyncTime(Date.now());
  return result;
}

// Refresh cache with latest data from server
export async function refreshCache(): Promise<void> {
  try {
    // Fetch and cache players
    const { data: players } = await supabase
      .from('players')
      .select('*')
      .eq('is_guest', false)
      .order('rating', { ascending: false });

    if (players) {
      await cachePlayers(players);
    }

    // Fetch and cache venues
    const { data: venues } = await supabase
      .from('venues')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (venues) {
      await cacheVenues(venues);
    }

    // Fetch and cache active session
    const { data: session } = await supabase
      .from('sessions')
      .select('*, venue:venues(*)')
      .in('status', ['setup', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (session) {
      await cacheSession(session);
    }

    await setLastSyncTime(Date.now());
  } catch (error) {
    console.error('Error refreshing cache:', error);
    throw error;
  }
}

// Queue an action for later sync
export async function queueAction(
  action: PendingActionType,
  payload: Record<string, any>
): Promise<string> {
  const { addPendingAction } = await import('./offlineStorage');
  return addPendingAction({ action, payload });
}

// Check if we're online
export function isOnline(): boolean {
  return navigator.onLine;
}

// Auto-sync when coming back online
export function setupAutoSync(onSync?: (result: SyncResult) => void): () => void {
  const handleOnline = async () => {
    console.log('Back online, syncing pending actions...');
    const result = await syncPendingActions();
    onSync?.(result);
    await refreshCache();
  };

  window.addEventListener('online', handleOnline);

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
