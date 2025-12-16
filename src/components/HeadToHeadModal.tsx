import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Player } from '../types';

interface HeadToHeadStats {
  wins: number;
  losses: number;
  totalGames: number;
}

interface HeadToHeadModalProps {
  currentPlayer: Player;
  opponent: Player;
  onClose: () => void;
}

export default function HeadToHeadModal({ currentPlayer, opponent, onClose }: HeadToHeadModalProps) {
  const [stats, setStats] = useState<HeadToHeadStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHeadToHeadStats();
  }, [currentPlayer.id, opponent.id]);

  const fetchHeadToHeadStats = async () => {
    try {
      // Fetch all games where both players participated
      const { data: currentPlayerGames, error: error1 } = await supabase
        .from('game_players')
        .select('game_id, team')
        .eq('player_id', currentPlayer.id);

      const { data: opponentGames, error: error2 } = await supabase
        .from('game_players')
        .select('game_id, team')
        .eq('player_id', opponent.id);

      if (error1 || error2) throw error1 || error2;

      // Find games where both played
      const currentGameMap = new Map(currentPlayerGames?.map(g => [g.game_id, g.team]) || []);
      const commonGames = opponentGames?.filter(g => currentGameMap.has(g.game_id)) || [];

      // Fetch game results for common games
      const gameIds = commonGames.map(g => g.game_id);

      if (gameIds.length === 0) {
        setStats({ wins: 0, losses: 0, totalGames: 0 });
        setLoading(false);
        return;
      }

      const { data: games, error: error3 } = await supabase
        .from('games')
        .select('id, winner')
        .in('id', gameIds)
        .eq('status', 'completed');

      if (error3) throw error3;

      // Calculate wins/losses
      let wins = 0;
      let losses = 0;

      games?.forEach(game => {
        const currentTeam = currentGameMap.get(game.id);
        const opponentTeam = opponentGames?.find(g => g.game_id === game.id)?.team;

        // If on same team, skip
        if (currentTeam === opponentTeam) return;

        // If on different teams, check winner
        if (game.winner === currentTeam) {
          wins++;
        } else if (game.winner === opponentTeam) {
          losses++;
        }
      });

      setStats({ wins, losses, totalGames: wins + losses });
    } catch (error) {
      console.error('Error fetching head-to-head stats:', error);
      setStats({ wins: 0, losses: 0, totalGames: 0 });
    } finally {
      setLoading(false);
    }
  };

  const winRate = stats && stats.totalGames > 0
    ? ((stats.wins / stats.totalGames) * 100).toFixed(0)
    : '0';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card-glass max-w-md w-full p-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-100">Head-to-Head</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-rally-dark/50 hover:bg-rally-dark flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Players */}
        <div className="flex items-center justify-between mb-6">
          {/* Current Player */}
          <div className="flex flex-col items-center flex-1">
            <div className="w-16 h-16 rounded-2xl bg-gradient-rally flex items-center justify-center mb-2">
              <span className="text-2xl font-bold text-white">
                {currentPlayer.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="text-sm font-semibold text-gray-100 text-center">{currentPlayer.name}</div>
            <div className="text-xs text-gray-500">{currentPlayer.rating}</div>
          </div>

          {/* VS */}
          <div className="px-6">
            <div className="text-2xl font-bold text-gray-500">VS</div>
          </div>

          {/* Opponent */}
          <div className="flex flex-col items-center flex-1">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center mb-2">
              <span className="text-2xl font-bold text-white">
                {opponent.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="text-sm font-semibold text-gray-100 text-center">{opponent.name}</div>
            <div className="text-xs text-gray-500">{opponent.rating}</div>
          </div>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading stats...</div>
        ) : stats ? (
          <div className="space-y-4">
            {/* Record */}
            <div className="bg-rally-dark/50 rounded-xl p-4 text-center">
              <div className="text-sm text-gray-400 mb-2">Record</div>
              <div className="text-3xl font-bold text-gray-100">
                {stats.wins} - {stats.losses}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-rally-dark/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-green-400">{stats.wins}</div>
                <div className="text-xs text-gray-500 mt-1">Wins</div>
              </div>
              <div className="bg-rally-dark/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-gray-100">{stats.totalGames}</div>
                <div className="text-xs text-gray-500 mt-1">Games</div>
              </div>
              <div className="bg-rally-dark/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-red-400">{stats.losses}</div>
                <div className="text-xs text-gray-500 mt-1">Losses</div>
              </div>
            </div>

            {/* Win Rate */}
            {stats.totalGames > 0 && (
              <div className="bg-rally-dark/50 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Your Win Rate</span>
                  <span className="font-semibold text-gray-100">{winRate}%</span>
                </div>
                <div className="h-3 bg-rally-dark rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-rally transition-all duration-500"
                    style={{ width: `${winRate}%` }}
                  ></div>
                </div>
              </div>
            )}

            {stats.totalGames === 0 && (
              <div className="text-center py-8 text-gray-500">
                You haven't played against {opponent.name} yet!
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">No data available</div>
        )}
      </div>
    </div>
  );
}
