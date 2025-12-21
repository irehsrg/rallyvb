import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Player, Achievement, Endorsement, RatingHistory } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function PlayerProfile() {
  const { playerId } = useParams<{ playerId: string }>();
  const { player: currentPlayer } = useAuth();
  const [player, setPlayer] = useState<Player | null>(null);
  const [ratingHistory, setRatingHistory] = useState<RatingHistory[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [endorsements, setEndorsements] = useState<(Endorsement & { from_player?: Player })[]>([]);
  const [favorites, setFavorites] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEndorseModal, setShowEndorseModal] = useState(false);
  const [endorsementNote, setEndorsementNote] = useState('');
  const [endorsementType, setEndorsementType] = useState<string>('great_teammate');
  const [submittingEndorsement, setSubmittingEndorsement] = useState(false);

  useEffect(() => {
    if (playerId) {
      fetchPlayerData();
    }
  }, [playerId]);

  const fetchPlayerData = async () => {
    setLoading(true);
    try {
      // Fetch player
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single();

      if (playerError) throw playerError;
      setPlayer(playerData);

      // Fetch all related data in parallel
      await Promise.all([
        fetchRatingHistory(),
        fetchAchievements(),
        fetchEndorsements(),
        fetchFavorites(),
      ]);
    } catch (error) {
      console.error('Error fetching player:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRatingHistory = async () => {
    const { data } = await supabase
      .from('rating_history')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(20);
    setRatingHistory(data || []);
  };

  const fetchAchievements = async () => {
    const { data } = await supabase
      .from('achievements')
      .select('*')
      .eq('player_id', playerId)
      .order('unlocked_at', { ascending: false });
    setAchievements(data || []);
  };

  const fetchEndorsements = async () => {
    const { data } = await supabase
      .from('endorsements')
      .select(`
        *,
        from_player:from_player_id (id, name, profile_photo_url)
      `)
      .eq('to_player_id', playerId)
      .order('created_at', { ascending: false });
    setEndorsements(data || []);
  };

  const fetchFavorites = async () => {
    const { data } = await supabase
      .from('player_relationships')
      .select(`
        target_player:target_player_id (id, name, rating, profile_photo_url)
      `)
      .eq('player_id', playerId)
      .eq('relationship_type', 'favorite');

    if (data) {
      setFavorites(data.map((r: any) => r.target_player).filter(Boolean));
    }
  };

  const handleEndorse = async () => {
    if (!currentPlayer || !playerId) return;

    setSubmittingEndorsement(true);
    try {
      const { error } = await supabase
        .from('endorsements')
        .insert({
          from_player_id: currentPlayer.id,
          to_player_id: playerId,
          endorsement_type: endorsementType,
          message: endorsementNote || null,
        });

      if (error) throw error;

      await fetchEndorsements();
      setShowEndorseModal(false);
      setEndorsementNote('');
    } catch (error: any) {
      if (error.code === '23505') {
        alert('You have already endorsed this player with this type.');
      } else {
        alert('Failed to submit endorsement. Please try again.');
      }
    } finally {
      setSubmittingEndorsement(false);
    }
  };

  const getEndorsementLabel = (type: string) => {
    const labels: Record<string, string> = {
      great_teammate: 'Great Teammate',
      skilled_player: 'Skilled Player',
      good_sport: 'Good Sport',
      reliable: 'Reliable',
      great_setter: 'Great Setter',
      powerful_hitter: 'Powerful Hitter',
      solid_defense: 'Solid Defense',
      great_server: 'Great Server',
    };
    return labels[type] || type;
  };

  const getAchievementIcon = (type: string) => {
    switch (type) {
      case 'first_game':
        return '🎮';
      case 'win_streak_3':
        return '🔥';
      case 'win_streak_5':
        return '🔥🔥';
      case 'games_10':
        return '🏐';
      case 'games_50':
        return '🏆';
      case 'rating_1200':
        return '⭐';
      case 'rating_1500':
        return '🌟';
      default:
        return '🎖️';
    }
  };

  const isOwnProfile = currentPlayer?.id === playerId;
  const canEndorse = currentPlayer && !isOwnProfile;
  const hasEndorsed = endorsements.some(e => e.from_player_id === currentPlayer?.id);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="text-gray-400">Loading player...</div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="card-glass p-8 text-center">
          <h2 className="text-xl font-bold text-gray-100 mb-2">Player Not Found</h2>
          <p className="text-gray-400 mb-4">This player doesn't exist or has been removed.</p>
          <Link to="/leaderboard" className="btn-primary">
            View Leaderboard
          </Link>
        </div>
      </div>
    );
  }

  const chartData = [...ratingHistory].reverse().map((h) => ({
    date: new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    rating: h.new_rating,
  }));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Profile Header */}
      <div className="card-glass p-8 mb-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Profile Photo */}
          <div className="w-28 h-28 rounded-2xl bg-gradient-rally flex items-center justify-center text-white text-4xl font-bold overflow-hidden flex-shrink-0">
            {player.profile_photo_url ? (
              <img
                src={player.profile_photo_url}
                alt={player.name}
                className="w-full h-full object-cover"
              />
            ) : (
              player.name.charAt(0).toUpperCase()
            )}
          </div>

          {/* Player Info */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-3xl font-bold text-gray-100 mb-2">{player.name}</h1>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mb-4">
              <span className="px-3 py-1 bg-rally-coral/20 text-rally-coral rounded-lg text-sm font-medium capitalize">
                {player.position || 'Any Position'}
              </span>
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium capitalize">
                {player.skill_level || 'Intermediate'}
              </span>
            </div>
            {player.bio && (
              <p className="text-gray-400 text-sm">{player.bio}</p>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-6 sm:gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-rally-coral">{player.rating}</div>
              <div className="text-sm text-gray-400">Rating</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-100">{player.games_played}</div>
              <div className="text-sm text-gray-400">Games</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400">{player.wins}</div>
              <div className="text-sm text-gray-400">Wins</div>
            </div>
          </div>
        </div>

        {/* Endorse Button */}
        {canEndorse && (
          <div className="mt-6 pt-6 border-t border-gray-700">
            <button
              onClick={() => setShowEndorseModal(true)}
              className={`btn-primary ${hasEndorsed ? 'opacity-75' : ''}`}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
              {hasEndorsed ? 'Endorse Again' : 'Endorse Player'}
            </button>
          </div>
        )}
      </div>

      {/* Rating History Chart */}
      {chartData.length > 1 && (
        <div className="card-glass p-6 mb-8 animate-slide-up">
          <h3 className="text-xl font-bold text-gray-100 mb-4">Rating History</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} domain={['dataMin - 50', 'dataMax + 50']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#9CA3AF' }}
                  itemStyle={{ color: '#F97316' }}
                />
                <Line
                  type="monotone"
                  dataKey="rating"
                  stroke="#F97316"
                  strokeWidth={2}
                  dot={{ fill: '#F97316', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Endorsements */}
      {endorsements.length > 0 && (
        <div className="card-glass p-6 mb-8 animate-slide-up">
          <h3 className="text-xl font-bold text-gray-100 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Endorsements ({endorsements.length})
          </h3>
          <div className="grid gap-4">
            {endorsements.map((endorsement) => (
              <div key={endorsement.id} className="bg-rally-dark/50 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Link
                    to={`/player/${endorsement.from_player?.id}`}
                    className="w-10 h-10 rounded-full bg-gradient-rally flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0"
                  >
                    {endorsement.from_player?.profile_photo_url ? (
                      <img
                        src={endorsement.from_player.profile_photo_url}
                        alt={endorsement.from_player.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      endorsement.from_player?.name?.charAt(0).toUpperCase()
                    )}
                  </Link>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Link
                        to={`/player/${endorsement.from_player?.id}`}
                        className="font-medium text-gray-100 hover:text-rally-coral transition-colors"
                      >
                        {endorsement.from_player?.name}
                      </Link>
                      <span className="px-2 py-0.5 bg-rally-coral/20 text-rally-coral rounded text-xs font-medium">
                        {getEndorsementLabel(endorsement.endorsement_type)}
                      </span>
                    </div>
                    {endorsement.message && (
                      <p className="text-sm text-gray-400">"{endorsement.message}"</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Achievements */}
      {achievements.length > 0 && (
        <div className="card-glass p-6 mb-8 animate-slide-up">
          <h3 className="text-xl font-bold text-gray-100 mb-4">Achievements</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className="bg-rally-dark/50 rounded-xl p-4 text-center"
              >
                <div className="text-3xl mb-2">{getAchievementIcon(achievement.achievement_type)}</div>
                <div className="text-sm font-medium text-gray-100 capitalize">
                  {achievement.achievement_type.replace(/_/g, ' ')}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(achievement.unlocked_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Favorite Players */}
      {favorites.length > 0 && (
        <div className="card-glass p-6 animate-slide-up">
          <h3 className="text-xl font-bold text-gray-100 mb-4">Favorite Players</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {favorites.map((fav) => (
              <Link
                key={fav.id}
                to={`/player/${fav.id}`}
                className="bg-rally-dark/50 rounded-xl p-4 flex items-center gap-3 hover:bg-rally-dark transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-rally flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0">
                  {fav.profile_photo_url ? (
                    <img
                      src={fav.profile_photo_url}
                      alt={fav.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    fav.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="font-medium text-gray-100">{fav.name}</div>
                  <div className="text-xs text-rally-coral">{fav.rating} rating</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Endorse Modal */}
      {showEndorseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="card-glass p-8 max-w-md w-full animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-100">Endorse {player.name}</h3>
              <button
                onClick={() => setShowEndorseModal(false)}
                className="text-gray-400 hover:text-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Endorsement Type
                </label>
                <select
                  value={endorsementType}
                  onChange={(e) => setEndorsementType(e.target.value)}
                  className="input-modern w-full"
                >
                  <option value="great_teammate">Great Teammate</option>
                  <option value="skilled_player">Skilled Player</option>
                  <option value="good_sport">Good Sport</option>
                  <option value="reliable">Reliable</option>
                  <option value="great_setter">Great Setter</option>
                  <option value="powerful_hitter">Powerful Hitter</option>
                  <option value="solid_defense">Solid Defense</option>
                  <option value="great_server">Great Server</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Note (optional)
                </label>
                <textarea
                  value={endorsementNote}
                  onChange={(e) => setEndorsementNote(e.target.value)}
                  className="input-modern w-full"
                  rows={3}
                  placeholder="Add a personal note..."
                  maxLength={200}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowEndorseModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEndorse}
                  disabled={submittingEndorsement}
                  className="btn-primary flex-1"
                >
                  {submittingEndorsement ? 'Submitting...' : 'Endorse'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
