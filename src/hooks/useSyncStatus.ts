import { useState, useEffect, useCallback } from 'react';
import { SyncStatus } from '../types';
import { getPendingActionCount, getLastSyncTime } from '../lib/offlineStorage';
import { syncPendingActions, refreshCache, isOnline, setupAutoSync, SyncResult } from '../lib/syncManager';

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: 0,
    lastSync: null,
    isSyncing: false,
  });

  // Update online status
  useEffect(() => {
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update pending count periodically
  useEffect(() => {
    const updatePendingCount = async () => {
      try {
        const count = await getPendingActionCount();
        const lastSync = await getLastSyncTime();
        setStatus(prev => ({
          ...prev,
          pendingCount: count,
          lastSync,
        }));
      } catch (error) {
        console.error('Error getting pending count:', error);
      }
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Setup auto-sync when coming online
  useEffect(() => {
    const handleSync = (result: SyncResult) => {
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        pendingCount: prev.pendingCount - result.synced,
        lastSync: Date.now(),
      }));
    };

    const cleanup = setupAutoSync(handleSync);
    return cleanup;
  }, []);

  // Manual sync function
  const sync = useCallback(async (): Promise<SyncResult> => {
    if (!isOnline()) {
      return { success: false, synced: 0, failed: 0, errors: ['Device is offline'] };
    }

    setStatus(prev => ({ ...prev, isSyncing: true }));

    try {
      const result = await syncPendingActions();
      await refreshCache();

      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        pendingCount: 0,
        lastSync: Date.now(),
      }));

      return result;
    } catch (error) {
      setStatus(prev => ({ ...prev, isSyncing: false }));
      return { success: false, synced: 0, failed: 0, errors: ['Sync failed'] };
    }
  }, []);

  return {
    ...status,
    sync,
    isOffline: !status.isOnline,
    hasPendingActions: status.pendingCount > 0,
  };
}
