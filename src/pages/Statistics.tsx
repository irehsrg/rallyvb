import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import VenueSelector from '../components/VenueSelector';
import {
  fetchGlobalStatistics,
  fetchRatingDistribution,
  fetchActivePlayerLeaderboard,
  fetchGameOutcomeDistribution,
  fetchHeadToHead,
  searchPlayers,
} from '../utils/statistics';
import {
  GlobalStatistics,
  RatingBucket,
  PlayerActivity,
  GameOutcomeDistribution,
  HeadToHeadStats,
} from '../types';

const OUTCOME_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

export default function Statistics() {
  const [loading, setLoading] = useState(true);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

  // Stats data
  const [globalStats, setGlobalStats] = useState<GlobalStatistics | null>(null);
  const [ratingDistribution, setRatingDistribution] = useState<RatingBucket[]>([]);
  const [activePlayers, setActivePlayers] = useState<PlayerActivity[]>([]);
  const [outcomeDistribution, setOutcomeDistribution] = useState<GameOutcomeDistribution | null>(null);

  // Head-to-head lookup
  const [h2hPlayer1, setH2hPlayer1] = useState<{ id: string; name: string } | null>(null);
  const [h2hPlayer2, setH2hPlayer2] = useState<{ id: string; name: string } | null>(null);
  const [h2hSearch1, setH2hSearch1] = useState('');
  const [h2hSearch2, setH2hSearch2] = useState('');
  const [h2hResults1, setH2hResults1] = useState<{ id: string; name: string; rating: number; profile_photo_url?: string }[]>([]);
  const [h2hResults2, setH2hResults2] = useState<{ id: string; name: string; rating: number; profile_photo_url?: string }[]>([]);
  const [h2hStats, setH2hStats] = useState<HeadToHeadStats | null>(null);
  const [h2hLoading, setH2hLoading] = useState(false);

  // Fetch statistics when venue changes
  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const [global, ratings, active, outcomes] = await Promise.all([
          fetchGlobalStatistics(selectedVenueId || undefined),
          fetchRatingDistribution(selectedVenueId || undefined),
          fetchActivePlayerLeaderboard(selectedVenueId || undefined),
          fetchGameOutcomeDistribution(selectedVenueId || undefined),
        ]);

        setGlobalStats(global);
        setRatingDistribution(ratings);
        setActivePlayers(active);
        setOutcomeDistribution(outcomes);
      } catch (error) {
        console.error('Error loading statistics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [selectedVenueId]);

  // Search for players in H2H
  useEffect(() => {
    const search = async () => {
      if (h2hSearch1.length < 2) {
        setH2hResults1([]);
        return;
      }
      const results = await searchPlayers(h2hSearch1, h2hPlayer2 ? [h2hPlayer2.id] : []);
      setH2hResults1(results);
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [h2hSearch1, h2hPlayer2]);

  useEffect(() => {
    const search = async () => {
      if (h2hSearch2.length < 2) {
        setH2hResults2([]);
        return;
      }
      const results = await searchPlayers(h2hSearch2, h2hPlayer1 ? [h2hPlayer1.id] : []);
      setH2hResults2(results);
    };
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [h2hSearch2, h2hPlayer1]);

  // Fetch H2H when both players selected
  useEffect(() => {
    const loadH2H = async () => {
      if (!h2hPlayer1 || !h2hPlayer2) {
        setH2hStats(null);
        return;
      }
      setH2hLoading(true);
      try {
        const stats = await fetchHeadToHead(h2hPlayer1.id, h2hPlayer2.id);
        setH2hStats(stats);
      } catch (error) {
        console.error('Error loading H2H:', error);
      } finally {
        setH2hLoading(false);
      }
    };
    loadH2H();
  }, [h2hPlayer1, h2hPlayer2]);

  const outcomeData = outcomeDistribution
    ? [
        { name: 'Close (0-3 pts)', value: outcomeDistribution.close },
        { name: 'Moderate (4-7 pts)', value: outcomeDistribution.moderate },
        { name: 'Blowout (8+ pts)', value: outcomeDistribution.blowout },
      ]
    : [];

  const totalOutcomes = outcomeData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">Statistics</h1>
          <p className="text-gray-400 mt-1">Analytics and insights from your volleyball sessions</p>
        </div>
        <VenueSelector
          selectedVenueId={selectedVenueId}
          onVenueChange={setSelectedVenueId}
          showAllOption
          compact
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-rally-coral"></div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Global Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="card-glass p-4 text-center">
              <div className="text-3xl font-bold text-rally-coral">{globalStats?.totalPlayers || 0}</div>
              <div className="text-sm text-gray-400">Total Players</div>
            </div>
            <div className="card-glass p-4 text-center">
              <div className="text-3xl font-bold text-blue-400">{globalStats?.totalGames || 0}</div>
              <div className="text-sm text-gray-400">Games Played</div>
            </div>
            <div className="card-glass p-4 text-center">
              <div className="text-3xl font-bold text-green-400">{globalStats?.avgPointDifferential || 0}</div>
              <div className="text-sm text-gray-400">Avg Point Diff</div>
            </div>
            <div className="card-glass p-4 text-center">
              <div className="text-3xl font-bold text-yellow-400">{globalStats?.closeGamePercentage || 0}%</div>
              <div className="text-sm text-gray-400">Close Games</div>
            </div>
            <div className="card-glass p-4 text-center">
              <div className="text-3xl font-bold text-purple-400">{globalStats?.avgTotalPoints || 0}</div>
              <div className="text-sm text-gray-400">Avg Total Points</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Rating Distribution */}
            <div className="card-glass p-6">
              <h2 className="text-xl font-bold text-gray-100 mb-4">Rating Distribution</h2>
              {ratingDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ratingDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="bucket"
                      stroke="#9ca3af"
                      tickFormatter={(v) => `${v}-${v + 99}`}
                      fontSize={12}
                    />
                    <YAxis stroke="#9ca3af" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                      }}
                      labelFormatter={(v) => `Rating: ${v}-${Number(v) + 99}`}
                    />
                    <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-500">
                  No rating data available
                </div>
              )}
            </div>

            {/* Game Outcome Distribution */}
            <div className="card-glass p-6">
              <h2 className="text-xl font-bold text-gray-100 mb-4">Game Outcomes</h2>
              {totalOutcomes > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={outcomeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${String(name || '').split(' ')[0]} ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {outcomeData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={OUTCOME_COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-500">
                  No game data available
                </div>
              )}
            </div>
          </div>

          {/* Most Active Players */}
          <div className="card-glass p-6">
            <h2 className="text-xl font-bold text-gray-100 mb-4">Most Active Players (Last 30 Days)</h2>
            {activePlayers.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {activePlayers.map((player, index) => (
                  <Link
                    key={player.playerId}
                    to={`/player/${player.playerId}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-rally-dark/50 hover:bg-rally-light/50 transition-colors"
                  >
                    <div className="flex-shrink-0 text-lg font-bold text-gray-500 w-6 text-center">
                      {index + 1}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-gradient-rally flex items-center justify-center overflow-hidden">
                      {player.profilePhotoUrl ? (
                        <img
                          src={player.profilePhotoUrl}
                          alt={player.playerName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold text-white">
                          {player.playerName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-200 truncate">{player.playerName}</div>
                      <div className="text-xs text-gray-400">
                        {player.gamesLastMonth} games
                        <span className={`ml-2 ${player.ratingChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {player.ratingChange >= 0 ? '+' : ''}{player.ratingChange}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No recent activity data available
              </div>
            )}
          </div>

          {/* Head-to-Head Lookup */}
          <div className="card-glass p-6">
            <h2 className="text-xl font-bold text-gray-100 mb-4">Head-to-Head Lookup</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Player 1 Search */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Player 1</label>
                {h2hPlayer1 ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-rally-dark border border-rally-coral/50">
                    <div className="w-10 h-10 rounded-full bg-gradient-rally flex items-center justify-center">
                      <span className="text-sm font-bold text-white">{h2hPlayer1.name.charAt(0)}</span>
                    </div>
                    <span className="flex-1 font-medium text-gray-200">{h2hPlayer1.name}</span>
                    <button
                      onClick={() => {
                        setH2hPlayer1(null);
                        setH2hSearch1('');
                      }}
                      className="text-gray-400 hover:text-gray-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={h2hSearch1}
                      onChange={(e) => setH2hSearch1(e.target.value)}
                      placeholder="Search for a player..."
                      className="input-modern w-full"
                    />
                    {h2hResults1.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-rally-dark border border-gray-700 rounded-xl shadow-lg max-h-48 overflow-auto">
                        {h2hResults1.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setH2hPlayer1({ id: p.id, name: p.name });
                              setH2hSearch1('');
                              setH2hResults1([]);
                            }}
                            className="w-full flex items-center gap-3 p-3 hover:bg-rally-light/50 transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-gradient-rally flex items-center justify-center overflow-hidden">
                              {p.profile_photo_url ? (
                                <img src={p.profile_photo_url} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-bold text-white">{p.name.charAt(0)}</span>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="text-gray-200 font-medium">{p.name}</div>
                              <div className="text-xs text-gray-400">Rating: {p.rating}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Player 2 Search */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Player 2</label>
                {h2hPlayer2 ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-rally-dark border border-blue-500/50">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center">
                      <span className="text-sm font-bold text-white">{h2hPlayer2.name.charAt(0)}</span>
                    </div>
                    <span className="flex-1 font-medium text-gray-200">{h2hPlayer2.name}</span>
                    <button
                      onClick={() => {
                        setH2hPlayer2(null);
                        setH2hSearch2('');
                      }}
                      className="text-gray-400 hover:text-gray-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={h2hSearch2}
                      onChange={(e) => setH2hSearch2(e.target.value)}
                      placeholder="Search for a player..."
                      className="input-modern w-full"
                    />
                    {h2hResults2.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-rally-dark border border-gray-700 rounded-xl shadow-lg max-h-48 overflow-auto">
                        {h2hResults2.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setH2hPlayer2({ id: p.id, name: p.name });
                              setH2hSearch2('');
                              setH2hResults2([]);
                            }}
                            className="w-full flex items-center gap-3 p-3 hover:bg-rally-light/50 transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center overflow-hidden">
                              {p.profile_photo_url ? (
                                <img src={p.profile_photo_url} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-bold text-white">{p.name.charAt(0)}</span>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="text-gray-200 font-medium">{p.name}</div>
                              <div className="text-xs text-gray-400">Rating: {p.rating}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* H2H Results */}
            {h2hLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-rally-coral"></div>
              </div>
            ) : h2hStats ? (
              <div className="mt-6">
                <div className="flex items-center justify-center gap-8 py-6">
                  {/* Player 1 */}
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-gradient-rally flex items-center justify-center overflow-hidden mb-2">
                      {h2hStats.player1.profile_photo_url ? (
                        <img src={h2hStats.player1.profile_photo_url} alt={h2hStats.player1.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-white">{h2hStats.player1.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="font-medium text-gray-200">{h2hStats.player1.name}</div>
                    <div className="text-3xl font-bold text-rally-coral mt-1">{h2hStats.player1Wins}</div>
                    <div className="text-xs text-gray-400">wins</div>
                  </div>

                  {/* VS */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-500">VS</div>
                    <div className="text-sm text-gray-400 mt-2">{h2hStats.totalGames} games</div>
                    {h2hStats.lastPlayed && (
                      <div className="text-xs text-gray-500 mt-1">
                        Last: {new Date(h2hStats.lastPlayed).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {/* Player 2 */}
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center overflow-hidden mb-2">
                      {h2hStats.player2.profile_photo_url ? (
                        <img src={h2hStats.player2.profile_photo_url} alt={h2hStats.player2.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-white">{h2hStats.player2.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="font-medium text-gray-200">{h2hStats.player2.name}</div>
                    <div className="text-3xl font-bold text-blue-400 mt-1">{h2hStats.player2Wins}</div>
                    <div className="text-xs text-gray-400">wins</div>
                  </div>
                </div>

                {/* Recent Games */}
                {h2hStats.recentGames.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Matchups</h3>
                    <div className="space-y-2">
                      {h2hStats.recentGames.slice(0, 5).map((game) => (
                        <div
                          key={game.gameId}
                          className="flex items-center justify-between p-3 rounded-lg bg-rally-dark/50"
                        >
                          <div className="text-xs text-gray-400">
                            {new Date(game.date).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={game.winnerId === h2hStats.player1.id ? 'text-rally-coral font-bold' : 'text-gray-400'}>
                              {game.player1Team === 'A' ? game.scoreA : game.scoreB}
                            </span>
                            <span className="text-gray-500">-</span>
                            <span className={game.winnerId === h2hStats.player2.id ? 'text-blue-400 font-bold' : 'text-gray-400'}>
                              {game.player1Team === 'A' ? game.scoreB : game.scoreA}
                            </span>
                          </div>
                          <div className={`text-xs font-medium ${game.winnerId === h2hStats.player1.id ? 'text-rally-coral' : 'text-blue-400'}`}>
                            {game.winnerId === h2hStats.player1.id ? h2hStats.player1.name : h2hStats.player2.name} won
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : h2hPlayer1 && h2hPlayer2 ? (
              <div className="text-center py-8 text-gray-500">
                No games found between these players
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Select two players to see their head-to-head record
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
