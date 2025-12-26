import { useSyncStatus } from '../hooks/useSyncStatus';

export default function OfflineIndicator() {
  const { isOffline, pendingCount, isSyncing, sync, lastSync } = useSyncStatus();

  // Don't show anything if online and no pending actions
  if (!isOffline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  const formatLastSync = () => {
    if (!lastSync) return 'Never';
    const diff = Date.now() - lastSync;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  return (
    <div
      className={`fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-40 rounded-xl p-4 shadow-lg transition-all ${
        isOffline
          ? 'bg-orange-500/90 border border-orange-400'
          : pendingCount > 0
          ? 'bg-blue-500/90 border border-blue-400'
          : 'bg-green-500/90 border border-green-400'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Status Icon */}
        <div className="flex-shrink-0">
          {isOffline ? (
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
            </svg>
          ) : isSyncing ? (
            <svg className="w-6 h-6 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : pendingCount > 0 ? (
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm">
            {isOffline
              ? 'You are offline'
              : isSyncing
              ? 'Syncing...'
              : pendingCount > 0
              ? `${pendingCount} pending ${pendingCount === 1 ? 'action' : 'actions'}`
              : 'Synced'}
          </div>
          <div className="text-xs text-white/80">
            {isOffline
              ? 'Changes will sync when back online'
              : isSyncing
              ? 'Please wait...'
              : `Last sync: ${formatLastSync()}`}
          </div>
        </div>

        {/* Sync Button */}
        {!isOffline && pendingCount > 0 && !isSyncing && (
          <button
            onClick={sync}
            className="flex-shrink-0 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-all"
          >
            Sync Now
          </button>
        )}
      </div>

      {/* Pending Actions Count Badge */}
      {isOffline && pendingCount > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-white/90">
          <span className="px-2 py-0.5 bg-white/20 rounded-full font-medium">
            {pendingCount} queued
          </span>
          <span>Will sync automatically when back online</span>
        </div>
      )}
    </div>
  );
}
