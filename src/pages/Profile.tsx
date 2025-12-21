import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { RatingHistory, Game, Achievement, Player, Endorsement } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { compressImage, validateImageFile } from '../utils/imageUtils';

interface GameWithDetails extends Game {
  session?: {
    date: string;
  };
  myTeam?: 'A' | 'B';
  isWinner?: boolean;
  ratingChange?: number;
}

export default function Profile() {
  const { player, refreshPlayer } = useAuth();
  const [ratingHistory, setRatingHistory] = useState<RatingHistory[]>([]);
  const [gameHistory, setGameHistory] = useState<GameWithDetails[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    position: player?.position || 'any',
    skill_level: player?.skill_level || 'intermediate',
    bio: player?.bio || '',
    profile_photo_url: player?.profile_photo_url || '',
  });
  const [pushEnabled, setPushEnabled] = useState(player?.push_notifications_enabled || false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [favorites, setFavorites] = useState<Player[]>([]);
  const [avoidList, setAvoidList] = useState<Player[]>([]);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [relationshipType, setRelationshipType] = useState<'favorite' | 'avoid'>('favorite');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [receivedEndorsements, setReceivedEndorsements] = useState<(Endorsement & { from_player?: Player })[]>([]);
  const [showEndorseModal, setShowEndorseModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (player) {
      Promise.all([fetchRatingHistory(), fetchGameHistory(), fetchAchievements(), fetchRelationships(), fetchEndorsements()]);
      setPushEnabled(player.push_notifications_enabled || false);
    }
  }, [player]);

  useEffect(() => {
    // Check if push notifications are supported
    setPushSupported('serviceWorker' in navigator && 'PushManager' in window);
  }, []);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchPlayers();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const fetchRatingHistory = async () => {
    if (!player) return;

    try {
      const { data, error } = await supabase
        .from('rating_history')
        .select('*')
        .eq('player_id', player.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setRatingHistory(data || []);
    } catch (error) {
      console.error('Error fetching rating history:', error);
    }
  };

  const fetchGameHistory = async () => {
    if (!player) return;

    try {
      // Fetch games where player participated
      const { data: gamePlayers, error } = await supabase
        .from('game_players')
        .select(`
          team,
          rating_change,
          game:games (
            id,
            score_a,
            score_b,
            winner,
            status,
            court_number,
            created_at,
            session:sessions (
              date
            )
          )
        `)
        .eq('player_id', player.id)
        .limit(50);

      if (error) {
        console.error('Error fetching game history:', error);
        throw error;
      }

      const games: GameWithDetails[] = gamePlayers?.map((gp: any) => ({
        ...gp.game,
        myTeam: gp.team,
        isWinner: gp.game.winner === gp.team,
        ratingChange: gp.rating_change,
        session: gp.game.session,
      })) || [];

      // Sort by game created_at after mapping
      games.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      console.log('Fetched game history:', games);
      setGameHistory(games.slice(0, 10)); // Take top 10 most recent
    } catch (error) {
      console.error('Error fetching game history:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAchievements = async () => {
    if (!player) return;

    try {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .eq('player_id', player.id)
        .order('unlocked_at', { ascending: false });

      if (error) throw error;
      setAchievements(data || []);
    } catch (error) {
      console.error('Error fetching achievements:', error);
    }
  };

  const fetchRelationships = async () => {
    if (!player) return;

    try {
      const { data, error } = await supabase
        .from('player_relationships')
        .select('related_player_id, relationship_type, players!player_relationships_related_player_id_fkey(*)')
        .eq('player_id', player.id);

      if (error) throw error;

      const favs: Player[] = [];
      const avoid: Player[] = [];

      data?.forEach((rel: any) => {
        if (rel.relationship_type === 'favorite' && rel.players) {
          favs.push(rel.players);
        } else if (rel.relationship_type === 'avoid' && rel.players) {
          avoid.push(rel.players);
        }
      });

      setFavorites(favs);
      setAvoidList(avoid);
    } catch (error) {
      console.error('Error fetching relationships:', error);
    }
  };

  const searchPlayers = async () => {
    if (!player) return;

    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .neq('id', player.id)
        .ilike('name', `%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching players:', error);
    }
  };

  const addRelationship = async (relatedPlayerId: string, type: 'favorite' | 'avoid') => {
    if (!player) return;

    try {
      const { error } = await supabase
        .from('player_relationships')
        .insert({
          player_id: player.id,
          related_player_id: relatedPlayerId,
          relationship_type: type,
        });

      if (error) throw error;

      await fetchRelationships();
      setSearchQuery('');
      setShowAddPlayerModal(false);
    } catch (error: any) {
      console.error('Error adding relationship:', error);
      if (error.code === '23505') {
        alert('You already have this relationship with this player');
      } else {
        alert('Failed to add relationship');
      }
    }
  };

  const removeRelationship = async (relatedPlayerId: string, type: 'favorite' | 'avoid') => {
    if (!player) return;

    try {
      const { error } = await supabase
        .from('player_relationships')
        .delete()
        .eq('player_id', player.id)
        .eq('related_player_id', relatedPlayerId)
        .eq('relationship_type', type);

      if (error) throw error;

      await fetchRelationships();
    } catch (error) {
      console.error('Error removing relationship:', error);
      alert('Failed to remove relationship');
    }
  };

  const fetchEndorsements = async () => {
    if (!player) return;

    try {
      const { data, error } = await supabase
        .from('endorsements')
        .select('*, from_player:players!from_player_id(*)')
        .eq('to_player_id', player.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching endorsements:', error);
        throw error;
      }

      console.log('Fetched endorsements:', data);
      setReceivedEndorsements((data as any) || []);
    } catch (error) {
      console.error('Error fetching endorsements:', error);
    }
  };

  const giveEndorsement = async (endorsementType: string, message: string) => {
    if (!player) return;

    try {
      const { data: searchData } = await supabase
        .from('players')
        .select('*')
        .neq('id', player.id)
        .ilike('name', `%${searchQuery}%`)
        .limit(1)
        .single();

      if (!searchData) {
        alert('Player not found');
        return;
      }

      const { error } = await supabase
        .from('endorsements')
        .insert({
          from_player_id: player.id,
          to_player_id: searchData.id,
          endorsement_type: endorsementType,
          message: message || null,
        });

      if (error) throw error;

      setShowEndorseModal(false);
      setSearchQuery('');
      alert('Endorsement sent successfully!');
    } catch (error) {
      console.error('Error giving endorsement:', error);
      alert('Failed to give endorsement');
    }
  };

  const handleSaveProfile = async () => {
    if (!player) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('players')
        .update({
          position: editForm.position,
          skill_level: editForm.skill_level,
          bio: editForm.bio,
          profile_photo_url: editForm.profile_photo_url || null,
        })
        .eq('id', player.id);

      if (error) throw error;

      // Refresh player data
      await refreshPlayer();
      setShowEditModal(false);
      setPhotoPreview(null);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !player) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setUploadingPhoto(true);
    try {
      // Compress the image
      const compressedBlob = await compressImage(file, 400, 400, 0.85);

      // Create a preview
      const previewUrl = URL.createObjectURL(compressedBlob);
      setPhotoPreview(previewUrl);

      // Upload to Supabase Storage
      const fileName = `${player.id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, compressedBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

      // Update the form with the new URL
      setEditForm({ ...editForm, profile_photo_url: urlData.publicUrl });
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Failed to upload photo. Please try again.');
      setPhotoPreview(null);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = () => {
    setEditForm({ ...editForm, profile_photo_url: '' });
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const togglePushNotifications = async () => {
    if (!player || !pushSupported) return;

    setPushLoading(true);
    try {
      if (!pushEnabled) {
        // Request permission and subscribe
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          alert('Please allow notifications in your browser settings to receive updates.');
          setPushLoading(false);
          return;
        }

        // Get service worker registration
        const registration = await navigator.serviceWorker.ready;

        // Subscribe to push notifications
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
        });

        const subscriptionJson = subscription.toJSON();

        // Save subscription to database
        const { error: subError } = await supabase
          .from('push_subscriptions')
          .upsert({
            player_id: player.id,
            endpoint: subscriptionJson.endpoint,
            p256dh_key: subscriptionJson.keys?.p256dh,
            auth_key: subscriptionJson.keys?.auth,
            user_agent: navigator.userAgent,
          }, {
            onConflict: 'player_id,endpoint',
          });

        if (subError) throw subError;

        // Update player preference
        const { error } = await supabase
          .from('players')
          .update({ push_notifications_enabled: true })
          .eq('id', player.id);

        if (error) throw error;

        setPushEnabled(true);
        await refreshPlayer();
      } else {
        // Unsubscribe
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await subscription.unsubscribe();

          // Remove from database
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('player_id', player.id)
            .eq('endpoint', subscription.endpoint);
        }

        // Update player preference
        const { error } = await supabase
          .from('players')
          .update({ push_notifications_enabled: false })
          .eq('id', player.id);

        if (error) throw error;

        setPushEnabled(false);
        await refreshPlayer();
      }
    } catch (error) {
      console.error('Error toggling push notifications:', error);
      alert('Failed to update notification settings. Please try again.');
    } finally {
      setPushLoading(false);
    }
  };

  if (!player) {
    return (
      <div className="min-h-screen bg-rally-darker flex items-center justify-center">
        <div className="text-gray-400">Please sign in to view your profile</div>
      </div>
    );
  }

  const winRate = player.games_played > 0
    ? ((player.wins / player.games_played) * 100).toFixed(1)
    : '0.0';

  // Achievement definitions
  const achievementDefs: Record<string, { name: string; description: string; icon: string; color: string }> = {
    first_game: { name: 'First Game', description: 'Played your first game', icon: '🏐', color: 'bg-blue-500/20 border-blue-500/30 text-blue-400' },
    games_10: { name: 'Getting Started', description: 'Played 10 games', icon: '🎯', color: 'bg-green-500/20 border-green-500/30 text-green-400' },
    games_50: { name: 'Regular Player', description: 'Played 50 games', icon: '⭐', color: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400' },
    games_100: { name: 'Veteran', description: 'Played 100 games', icon: '🏆', color: 'bg-orange-500/20 border-orange-500/30 text-orange-400' },
    win_streak_5: { name: 'Hot Streak', description: 'Won 5 games in a row', icon: '🔥', color: 'bg-red-500/20 border-red-500/30 text-red-400' },
    win_streak_10: { name: 'Unstoppable', description: 'Won 10 games in a row', icon: '💪', color: 'bg-purple-500/20 border-purple-500/30 text-purple-400' },
    rating_1600: { name: 'Rising Star', description: 'Reached 1600 rating', icon: '🌟', color: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400' },
    rating_1800: { name: 'Elite Player', description: 'Reached 1800 rating', icon: '👑', color: 'bg-pink-500/20 border-pink-500/30 text-pink-400' },
  };

  // Check which achievements are unlocked
  const unlockedAchievements = new Set(achievements.map(a => a.achievement_type));

  // Define all achievements with locked/unlocked status
  const allAchievements = [
    { type: 'first_game', requirement: player.games_played >= 1, progress: Math.min(player.games_played, 1) },
    { type: 'games_10', requirement: player.games_played >= 10, progress: Math.min(player.games_played, 10) / 10 },
    { type: 'games_50', requirement: player.games_played >= 50, progress: Math.min(player.games_played, 50) / 50 },
    { type: 'games_100', requirement: player.games_played >= 100, progress: Math.min(player.games_played, 100) / 100 },
    { type: 'win_streak_5', requirement: player.win_streak >= 5 || player.best_win_streak >= 5, progress: Math.min(Math.max(player.win_streak, player.best_win_streak), 5) / 5 },
    { type: 'win_streak_10', requirement: player.win_streak >= 10 || player.best_win_streak >= 10, progress: Math.min(Math.max(player.win_streak, player.best_win_streak), 10) / 10 },
    { type: 'rating_1600', requirement: (player.highest_rating || player.rating) >= 1600, progress: Math.min((player.highest_rating || player.rating), 1600) / 1600 },
    { type: 'rating_1800', requirement: (player.highest_rating || player.rating) >= 1800, progress: Math.min((player.highest_rating || player.rating), 1800) / 1800 },
  ];

  return (
    <div className="min-h-screen bg-rally-darker">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="card-glass p-8 mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-100">My Profile</h2>
            <button
              onClick={() => {
                setEditForm({
                  position: player.position || 'any',
                  skill_level: player.skill_level || 'intermediate',
                  bio: player.bio || '',
                  profile_photo_url: player.profile_photo_url || '',
                });
                setShowEditModal(true);
              }}
              className="btn-secondary flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Profile
            </button>
          </div>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 rounded-3xl bg-gradient-rally flex items-center justify-center shadow-2xl shadow-rally-coral/50 overflow-hidden">
                {player.profile_photo_url ? (
                  <img
                    src={player.profile_photo_url}
                    alt={player.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-5xl font-bold text-white">
                    {player.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              {player.is_admin && (
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-rally-dark rounded-xl border-2 border-rally-coral flex items-center justify-center">
                  <svg className="w-5 h-5 text-rally-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Player Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-4xl font-bold text-gray-100 mb-2">{player.name}</h1>
              <p className="text-gray-400 mb-4">
                Member since {new Date(player.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>

              {/* Bio */}
              {player.bio && (
                <p className="text-gray-300 mb-4 max-w-2xl">
                  {player.bio}
                </p>
              )}

              {/* Badges Row */}
              <div className="flex flex-wrap gap-2 mb-4 justify-center md:justify-start">
                {player.is_admin && (
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-rally-coral/20 text-rally-coral rounded-xl border border-rally-coral/30">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span className="font-semibold">Administrator</span>
                  </span>
                )}

                {/* Position Badge */}
                {player.position && (
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="font-semibold">
                      {player.position === 'any' ? 'All Positions' : player.position.charAt(0).toUpperCase() + player.position.slice(1)}
                    </span>
                  </span>
                )}

                {/* Skill Level Badge */}
                {player.skill_level && (
                  <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${
                    player.skill_level === 'expert' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                    player.skill_level === 'advanced' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                    player.skill_level === 'intermediate' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                    'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="font-semibold">
                      {player.skill_level.charAt(0).toUpperCase() + player.skill_level.slice(1)}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Current Rating Badge */}
            <div className="card-glass px-8 py-6 text-center">
              <div className="text-sm text-gray-400 mb-2">Current Rating</div>
              <div className="text-5xl font-bold text-gradient-rally">
                {player.rating}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-slide-up">
          <div className="stat-card">
            <div className="text-4xl font-bold text-gray-100">{player.games_played}</div>
            <div className="text-sm text-gray-400 mt-2">Games Played</div>
          </div>

          <div className="stat-card">
            <div className="text-4xl font-bold text-gray-100">
              {player.wins}-{player.losses}
            </div>
            <div className="text-sm text-gray-400 mt-2">Win-Loss</div>
          </div>

          <div className="stat-card">
            <div className={`text-4xl font-bold ${parseFloat(winRate) >= 50 ? 'text-green-400' : 'text-red-400'}`}>
              {winRate}%
            </div>
            <div className="text-sm text-gray-400 mt-2">Win Rate</div>
          </div>

          <div className="stat-card">
            <div className="text-4xl font-bold text-orange-400">
              {player.win_streak > 0 ? `🔥 ${player.win_streak}` : '-'}
            </div>
            <div className="text-sm text-gray-400 mt-2">Current Streak</div>
          </div>
        </div>

        {/* Achievements */}
        <div className="card-glass p-6 mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-100">Achievements</h3>
            <span className="text-sm text-gray-400">
              {achievements.length} / {allAchievements.length} Unlocked
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {allAchievements.map((achievement) => {
              const def = achievementDefs[achievement.type];
              const isUnlocked = unlockedAchievements.has(achievement.type);

              return (
                <div
                  key={achievement.type}
                  className={`relative p-4 rounded-xl border transition-all ${
                    isUnlocked
                      ? def.color + ' hover:scale-105 cursor-pointer'
                      : 'bg-gray-800/50 border-gray-700/50 text-gray-600 opacity-60'
                  }`}
                  title={isUnlocked ? `Unlocked ${achievements.find(a => a.achievement_type === achievement.type)?.unlocked_at ? new Date(achievements.find(a => a.achievement_type === achievement.type)!.unlocked_at).toLocaleDateString() : ''}` : 'Locked'}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`text-3xl ${!isUnlocked && 'grayscale opacity-50'}`}>
                      {def.icon}
                    </div>
                    <div className="flex-1">
                      <div className={`font-bold text-sm mb-1 ${!isUnlocked && 'text-gray-500'}`}>
                        {def.name}
                      </div>
                      <div className={`text-xs ${isUnlocked ? 'opacity-80' : 'text-gray-600'}`}>
                        {def.description}
                      </div>
                    </div>
                  </div>

                  {!isUnlocked && achievement.progress < 1 && (
                    <div className="mt-3">
                      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gray-500 rounded-full transition-all duration-500"
                          style={{ width: `${achievement.progress * 100}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 text-right">
                        {Math.round(achievement.progress * 100)}%
                      </div>
                    </div>
                  )}

                  {isUnlocked && (
                    <div className="absolute top-2 right-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Favorites & Avoid List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 animate-slide-up" style={{ animationDelay: '0.15s' }}>
          {/* Favorites */}
          <div className="card-glass p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
                Favorites ({favorites.length})
              </h3>
              <button
                onClick={() => {
                  setRelationshipType('favorite');
                  setShowAddPlayerModal(true);
                }}
                className="text-sm px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-all"
              >
                + Add
              </button>
            </div>
            {favorites.length > 0 ? (
              <div className="space-y-2">
                {favorites.map((fav) => (
                  <div key={fav.id} className="flex items-center justify-between p-3 bg-rally-dark/50 rounded-xl hover:bg-rally-dark/70 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-rally flex items-center justify-center text-white font-bold">
                        {fav.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-100">{fav.name}</div>
                        <div className="text-xs text-gray-500">{fav.rating} rating</div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeRelationship(fav.id, 'favorite')}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
                <p className="text-sm">No favorite players yet</p>
              </div>
            )}
          </div>

          {/* Avoid List */}
          <div className="card-glass p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Avoid List ({avoidList.length})
              </h3>
              <button
                onClick={() => {
                  setRelationshipType('avoid');
                  setShowAddPlayerModal(true);
                }}
                className="text-sm px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all"
              >
                + Add
              </button>
            </div>
            {avoidList.length > 0 ? (
              <div className="space-y-2">
                {avoidList.map((avoid) => (
                  <div key={avoid.id} className="flex items-center justify-between p-3 bg-rally-dark/50 rounded-xl hover:bg-rally-dark/70 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-bold">
                        {avoid.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-100">{avoid.name}</div>
                        <div className="text-xs text-gray-500">{avoid.rating} rating</div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeRelationship(avoid.id, 'avoid')}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <p className="text-sm">No avoided players</p>
              </div>
            )}
          </div>
        </div>

        {/* Endorsements */}
        <div className="card-glass p-6 mb-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
              <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Endorsements ({receivedEndorsements.length})
            </h3>
            <button
              onClick={() => setShowEndorseModal(true)}
              className="text-sm px-4 py-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/30 transition-all font-medium"
            >
              Give Endorsement
            </button>
          </div>

          {receivedEndorsements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {receivedEndorsements.map((endorsement) => (
                <div key={endorsement.id} className="p-4 bg-rally-dark/50 rounded-xl border border-yellow-500/20 hover:border-yellow-500/40 transition-all">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-rally flex items-center justify-center text-white font-bold flex-shrink-0">
                      {endorsement.from_player?.name.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-100 mb-1">
                        {endorsement.from_player?.name || 'Unknown'}
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg text-xs font-medium border border-yellow-500/30">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        {endorsement.endorsement_type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </div>
                    </div>
                  </div>
                  {endorsement.message && (
                    <p className="text-sm text-gray-400 mt-2 italic pl-13">
                      "{endorsement.message}"
                    </p>
                  )}
                  <div className="text-xs text-gray-600 mt-2 pl-13">
                    {new Date(endorsement.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <h4 className="text-lg font-semibold text-gray-300 mb-2">No endorsements yet</h4>
              <p className="text-gray-500">When other players endorse you, they'll appear here!</p>
            </div>
          )}
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="card-glass p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Career Highlights</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-rally-dark/50 rounded-xl">
                <span className="text-gray-400">Highest Rating</span>
                <span className="text-xl font-bold text-rally-coral">{player.highest_rating || player.rating}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-rally-dark/50 rounded-xl">
                <span className="text-gray-400">Best Win Streak</span>
                <span className="text-xl font-bold text-gray-100">{player.best_win_streak}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-rally-dark/50 rounded-xl">
                <span className="text-gray-400">Total Wins</span>
                <span className="text-xl font-bold text-green-400">{player.wins}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-rally-dark/50 rounded-xl">
                <span className="text-gray-400">Last Played</span>
                <span className="text-sm font-medium text-gray-300">
                  {player.last_played_at
                    ? new Date(player.last_played_at).toLocaleDateString()
                    : 'Never'}
                </span>
              </div>
            </div>
          </div>

          <div className="card-glass p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Performance</h3>
            <div className="space-y-4">
              {/* Win Rate Bar */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Win Rate</span>
                  <span className="font-semibold text-gray-100">{winRate}%</span>
                </div>
                <div className="h-3 bg-rally-dark rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500 rounded-full"
                    style={{ width: `${winRate}%` }}
                  ></div>
                </div>
              </div>

              {/* Games Distribution */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Win/Loss Distribution</span>
                </div>
                <div className="flex h-3 bg-rally-dark rounded-full overflow-hidden">
                  <div
                    className="bg-green-500"
                    style={{ width: `${winRate}%` }}
                  ></div>
                  <div
                    className="bg-red-500"
                    style={{ width: `${100 - parseFloat(winRate)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-green-400">{player.wins} W</span>
                  <span className="text-red-400">{player.losses} L</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Game History */}
        <div className="card-glass p-6 mb-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h3 className="text-xl font-semibold text-gray-100 mb-6">Recent Games</h3>

          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : gameHistory.length > 0 ? (
            <div className="space-y-3">
              {gameHistory.map((game, index) => (
                <div
                  key={game.id}
                  className="flex items-center justify-between p-4 bg-rally-dark/50 rounded-xl hover:bg-rally-dark/70 transition-colors"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${
                      game.isWinner
                        ? 'bg-green-500/20 border border-green-500/30'
                        : 'bg-red-500/20 border border-red-500/30'
                    } flex items-center justify-center`}>
                      <span className={`text-xl font-bold ${game.isWinner ? 'text-green-400' : 'text-red-400'}`}>
                        {game.isWinner ? 'W' : 'L'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-100">
                          Team {game.myTeam}
                        </span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-sm text-gray-400">
                          Court {game.court_number}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {game.session?.date && new Date(game.session.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-100 mb-1">
                      {game.score_a} - {game.score_b}
                    </div>
                    {game.ratingChange !== null && game.ratingChange !== undefined && (
                      <span className={`text-sm font-bold ${
                        game.ratingChange > 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {game.ratingChange > 0 ? '+' : ''}
                        {game.ratingChange}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4 className="text-lg font-semibold text-gray-300 mb-2">No games yet</h4>
              <p className="text-gray-500">Your game history will appear here!</p>
            </div>
          )}
        </div>

        {/* Rating History */}
        <div className="card-glass p-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <h3 className="text-xl font-semibold text-gray-100 mb-6">Rating History</h3>

          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : ratingHistory.length > 0 ? (
            <>
              {/* Chart */}
              <div className="mb-6" style={{ height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[...ratingHistory].reverse().map((h, i) => ({
                      index: i,
                      rating: h.new_rating,
                      date: new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="date"
                      stroke="#9CA3AF"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis
                      stroke="#9CA3AF"
                      style={{ fontSize: '12px' }}
                      domain={['dataMin - 50', 'dataMax + 50']}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '12px',
                        color: '#F3F4F6',
                      }}
                      labelStyle={{ color: '#9CA3AF' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rating"
                      stroke="#E07C7C"
                      strokeWidth={3}
                      dot={{ fill: '#E07C7C', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Recent Changes List */}
              <div>
                <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Recent Changes
                </h4>
                <div className="space-y-2">
                  {ratingHistory.slice(0, 5).map((history, index) => (
                    <div
                      key={history.id}
                      className="flex items-center justify-between p-3 bg-rally-dark/50 rounded-xl"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${
                          history.change > 0
                            ? 'bg-green-500/20 border border-green-500/30'
                            : 'bg-red-500/20 border border-red-500/30'
                        } flex items-center justify-center`}>
                          <span className={`text-sm ${history.change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {history.change > 0 ? '↑' : '↓'}
                          </span>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">
                            {new Date(history.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-sm font-medium text-gray-300">
                            {history.previous_rating} → {history.new_rating}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-lg font-bold ${
                          history.change > 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {history.change > 0 ? '+' : ''}
                        {history.change}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h4 className="text-lg font-semibold text-gray-300 mb-2">No rating history yet</h4>
              <p className="text-gray-500">Play some games to see your rating changes!</p>
            </div>
          )}
        </div>

        {/* Push Notifications */}
        <div className="card-glass p-6 mt-8 animate-slide-up" style={{ animationDelay: '0.35s' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-rally-coral/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-rally-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-100">Push Notifications</h3>
                <p className="text-sm text-gray-400">
                  {pushSupported
                    ? 'Get notified about new sessions, reminders, and updates'
                    : 'Not supported in this browser'}
                </p>
              </div>
            </div>

            <button
              onClick={togglePushNotifications}
              disabled={!pushSupported || pushLoading}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-rally-coral focus:ring-offset-2 focus:ring-offset-rally-darker ${
                pushEnabled ? 'bg-rally-coral' : 'bg-gray-600'
              } ${(!pushSupported || pushLoading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  pushEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
              {pushLoading && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </span>
              )}
            </button>
          </div>

          {pushEnabled && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-sm text-green-400 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Notifications enabled! You'll receive alerts for new sessions, reminders, and waitlist updates.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="card-glass p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-100">Edit Profile</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-100 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Position */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Position
                </label>
                <select
                  value={editForm.position}
                  onChange={(e) => setEditForm({ ...editForm, position: e.target.value as any })}
                  className="input-modern w-full"
                >
                  <option value="any">All Positions</option>
                  <option value="setter">Setter</option>
                  <option value="outside">Outside Hitter</option>
                  <option value="middle">Middle Blocker</option>
                  <option value="opposite">Opposite Hitter</option>
                  <option value="libero">Libero</option>
                </select>
              </div>

              {/* Skill Level */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Skill Level
                </label>
                <select
                  value={editForm.skill_level}
                  onChange={(e) => setEditForm({ ...editForm, skill_level: e.target.value as any })}
                  className="input-modern w-full"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bio
                </label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="input-modern w-full"
                  rows={4}
                  placeholder="Tell us about yourself..."
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {editForm.bio.length} / 500 characters
                </p>
              </div>

              {/* Profile Photo */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Profile Photo
                </label>

                {/* Current/Preview Photo */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative">
                    {(photoPreview || editForm.profile_photo_url) ? (
                      <img
                        src={photoPreview || editForm.profile_photo_url}
                        alt="Profile"
                        className="w-24 h-24 rounded-2xl object-cover border-2 border-rally-coral"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-rally-dark border-2 border-dashed border-gray-600 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                    {uploadingPhoto && (
                      <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                        <svg className="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      id="photo-upload"
                    />
                    <label
                      htmlFor="photo-upload"
                      className="btn-secondary text-sm cursor-pointer inline-flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                    </label>
                    {(photoPreview || editForm.profile_photo_url) && (
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="text-sm text-red-400 hover:text-red-300 transition-colors"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  Upload a JPG, PNG, or WebP image. Large photos will be automatically resized.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="btn-secondary flex-1"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  className="btn-primary flex-1"
                  disabled={saving}
                >
                  {saving ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Player Modal */}
      {showAddPlayerModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="card-glass p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                {relationshipType === 'favorite' ? (
                  <>
                    <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                    </svg>
                    Add to Favorites
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    Add to Avoid List
                  </>
                )}
              </h3>
              <button
                onClick={() => {
                  setShowAddPlayerModal(false);
                  setSearchQuery('');
                }}
                className="text-gray-400 hover:text-gray-100 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search for a player
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-modern w-full"
                placeholder="Type player name..."
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Type at least 2 characters to search
              </p>
            </div>

            {/* Search Results */}
            <div>
              {searchQuery.length < 2 ? (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-sm">Start typing to search for players</p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-400 mb-3">
                    {searchResults.length} player{searchResults.length !== 1 ? 's' : ''} found
                  </p>
                  {searchResults.map((result) => (
                    <div key={result.id} className="flex items-center justify-between p-3 bg-rally-dark/50 rounded-xl hover:bg-rally-dark/70 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                          relationshipType === 'favorite' ? 'bg-gradient-rally' : 'bg-gray-600'
                        }`}>
                          {result.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-100">{result.name}</div>
                          <div className="text-xs text-gray-500">{result.rating} rating</div>
                        </div>
                      </div>
                      <button
                        onClick={() => addRelationship(result.id, relationshipType)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          relationshipType === 'favorite'
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                        }`}
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm">No players found matching "{searchQuery}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Give Endorsement Modal */}
      {showEndorseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="card-glass p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Give Endorsement
              </h3>
              <button
                onClick={() => {
                  setShowEndorseModal(false);
                  setSearchQuery('');
                }}
                className="text-gray-400 hover:text-gray-100 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search for a player
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-modern w-full"
                placeholder="Type player name..."
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Type at least 2 characters to search
              </p>
            </div>

            {/* Endorsement Type Selection */}
            {searchQuery.length >= 2 && searchResults.length > 0 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Select endorsement type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'great_teammate', label: 'Great Teammate', icon: '🤝' },
                    { value: 'skilled_player', label: 'Skilled Player', icon: '⭐' },
                    { value: 'positive_attitude', label: 'Positive Attitude', icon: '😊' },
                    { value: 'clutch_player', label: 'Clutch Player', icon: '🔥' },
                    { value: 'great_setter', label: 'Great Setter', icon: '🏐' },
                    { value: 'strong_hitter', label: 'Strong Hitter', icon: '💪' },
                    { value: 'solid_defense', label: 'Solid Defense', icon: '🛡️' },
                    { value: 'team_leader', label: 'Team Leader', icon: '👑' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => {
                        const message = prompt(`Add an optional message for this endorsement (or click Cancel to skip):`);
                        giveEndorsement(type.value, message || '');
                      }}
                      className="p-3 bg-rally-dark/50 hover:bg-yellow-500/20 border border-gray-700 hover:border-yellow-500/40 rounded-xl transition-all text-left group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{type.icon}</span>
                        <span className="text-sm font-medium text-gray-100 group-hover:text-yellow-400">
                          {type.label}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Results / Instructions */}
            <div>
              {searchQuery.length < 2 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="text-sm">Start typing to search for a player to endorse</p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="bg-rally-dark/30 border border-yellow-500/30 rounded-xl p-4">
                  <p className="text-sm text-yellow-400 font-medium mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Found: {searchResults[0].name}
                  </p>
                  <p className="text-xs text-gray-400">
                    Select an endorsement type above to endorse this player
                  </p>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm">No players found matching "{searchQuery}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
