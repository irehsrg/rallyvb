import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Player, Session, Venue, PendingAction, CachedData } from '../types';

interface RallyDB extends DBSchema {
  players: {
    key: string;
    value: CachedData<Player>;
    indexes: { 'by-name': string };
  };
  sessions: {
    key: string;
    value: CachedData<Session>;
    indexes: { 'by-date': string };
  };
  venues: {
    key: string;
    value: CachedData<Venue>;
    indexes: { 'by-name': string };
  };
  pendingActions: {
    key: string;
    value: PendingAction;
    indexes: { 'by-created': number };
  };
  metadata: {
    key: string;
    value: { lastSync: number; version: number };
  };
}

const DB_NAME = 'rally-offline';
const DB_VERSION = 1;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let dbInstance: IDBPDatabase<RallyDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<RallyDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<RallyDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Players store
      if (!db.objectStoreNames.contains('players')) {
        const playerStore = db.createObjectStore('players', { keyPath: 'data.id' });
        playerStore.createIndex('by-name', 'data.name');
      }

      // Sessions store
      if (!db.objectStoreNames.contains('sessions')) {
        const sessionStore = db.createObjectStore('sessions', { keyPath: 'data.id' });
        sessionStore.createIndex('by-date', 'data.date');
      }

      // Venues store
      if (!db.objectStoreNames.contains('venues')) {
        const venueStore = db.createObjectStore('venues', { keyPath: 'data.id' });
        venueStore.createIndex('by-name', 'data.name');
      }

      // Pending actions store
      if (!db.objectStoreNames.contains('pendingActions')) {
        const actionsStore = db.createObjectStore('pendingActions', { keyPath: 'id' });
        actionsStore.createIndex('by-created', 'createdAt');
      }

      // Metadata store
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata');
      }
    },
  });

  return dbInstance;
}

// Cache helpers
function wrapWithCache<T>(data: T, ttlMs: number = CACHE_TTL): CachedData<T> {
  const now = Date.now();
  return {
    data,
    cachedAt: now,
    expiresAt: now + ttlMs,
  };
}

function isExpired<T>(cached: CachedData<T>): boolean {
  return Date.now() > cached.expiresAt;
}

// Players
export async function cachePlayer(player: Player): Promise<void> {
  const db = await getDB();
  await db.put('players', wrapWithCache(player));
}

export async function cachePlayers(players: Player[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('players', 'readwrite');
  await Promise.all([
    ...players.map(p => tx.store.put(wrapWithCache(p))),
    tx.done,
  ]);
}

export async function getCachedPlayer(id: string): Promise<Player | null> {
  const db = await getDB();
  const cached = await db.get('players', id);
  if (!cached || isExpired(cached)) return null;
  return cached.data;
}

export async function getAllCachedPlayers(): Promise<Player[]> {
  const db = await getDB();
  const all = await db.getAll('players');
  return all.filter(c => !isExpired(c)).map(c => c.data);
}

// Sessions
export async function cacheSession(session: Session): Promise<void> {
  const db = await getDB();
  await db.put('sessions', wrapWithCache(session));
}

export async function getCachedSession(id: string): Promise<Session | null> {
  const db = await getDB();
  const cached = await db.get('sessions', id);
  if (!cached || isExpired(cached)) return null;
  return cached.data;
}

export async function getActiveCachedSessions(): Promise<Session[]> {
  const db = await getDB();
  const all = await db.getAll('sessions');
  return all
    .filter(c => !isExpired(c))
    .filter(c => c.data.status === 'setup' || c.data.status === 'active')
    .map(c => c.data);
}

// Venues
export async function cacheVenue(venue: Venue): Promise<void> {
  const db = await getDB();
  await db.put('venues', wrapWithCache(venue));
}

export async function cacheVenues(venues: Venue[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('venues', 'readwrite');
  await Promise.all([
    ...venues.map(v => tx.store.put(wrapWithCache(v))),
    tx.done,
  ]);
}

export async function getAllCachedVenues(): Promise<Venue[]> {
  const db = await getDB();
  const all = await db.getAll('venues');
  return all.filter(c => !isExpired(c)).map(c => c.data);
}

// Pending Actions
export async function addPendingAction(action: Omit<PendingAction, 'id' | 'createdAt' | 'retryCount'>): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  const pendingAction: PendingAction = {
    ...action,
    id,
    createdAt: Date.now(),
    retryCount: 0,
  };
  await db.add('pendingActions', pendingAction);
  return id;
}

export async function getPendingActions(): Promise<PendingAction[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('pendingActions', 'by-created');
  return all;
}

export async function getPendingActionCount(): Promise<number> {
  const db = await getDB();
  return db.count('pendingActions');
}

export async function removePendingAction(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pendingActions', id);
}

export async function updatePendingAction(action: PendingAction): Promise<void> {
  const db = await getDB();
  await db.put('pendingActions', action);
}

export async function clearAllPendingActions(): Promise<void> {
  const db = await getDB();
  await db.clear('pendingActions');
}

// Metadata
export async function getLastSyncTime(): Promise<number | null> {
  const db = await getDB();
  const metadata = await db.get('metadata', 'sync');
  return metadata?.lastSync || null;
}

export async function setLastSyncTime(time: number): Promise<void> {
  const db = await getDB();
  await db.put('metadata', { lastSync: time, version: DB_VERSION }, 'sync');
}

// Clear all cached data
export async function clearCache(): Promise<void> {
  const db = await getDB();
  await Promise.all([
    db.clear('players'),
    db.clear('sessions'),
    db.clear('venues'),
  ]);
}
