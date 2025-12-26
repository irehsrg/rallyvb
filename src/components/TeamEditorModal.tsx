import { useState } from 'react';
import { Player } from '../types';
import { supabase } from '../lib/supabase';

interface GameData {
  id: string;
  court_number: number;
  team_a: Player[];
  team_b: Player[];
}

interface TeamEditorModalProps {
  games: GameData[];
  onClose: () => void;
  onSave: () => void;
}

export default function TeamEditorModal({ games: initialGames, onClose, onSave }: TeamEditorModalProps) {
  const [games, setGames] = useState<GameData[]>(initialGames);
  const [selectedPlayer, setSelectedPlayer] = useState<{
    gameId: string;
    team: 'A' | 'B';
    playerId: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const calculateTeamRating = (players: Player[]) => {
    if (players.length === 0) return 0;
    return Math.round(players.reduce((sum, p) => sum + p.rating, 0) / players.length);
  };

  // Handle player selection for swapping
  const handlePlayerClick = (gameId: string, team: 'A' | 'B', playerId: string) => {
    if (!selectedPlayer) {
      // First selection
      setSelectedPlayer({ gameId, team, playerId });
    } else if (selectedPlayer.playerId === playerId && selectedPlayer.gameId === gameId) {
      // Clicking same player deselects
      setSelectedPlayer(null);
    } else {
      // Second selection - perform swap
      performSwap(
        selectedPlayer.gameId,
        selectedPlayer.team,
        selectedPlayer.playerId,
        gameId,
        team,
        playerId
      );
      setSelectedPlayer(null);
    }
  };

  // Move player to other team (within same game)
  const moveToOtherTeam = (gameId: string, fromTeam: 'A' | 'B', playerId: string) => {
    setGames(prevGames => {
      return prevGames.map(game => {
        if (game.id !== gameId) return game;

        const fromKey = fromTeam === 'A' ? 'team_a' : 'team_b';
        const toKey = fromTeam === 'A' ? 'team_b' : 'team_a';

        const playerIndex = game[fromKey].findIndex(p => p.id === playerId);
        if (playerIndex === -1) return game;

        const newFromTeam = [...game[fromKey]];
        const [movedPlayer] = newFromTeam.splice(playerIndex, 1);
        const newToTeam = [...game[toKey], movedPlayer];

        return {
          ...game,
          [fromKey]: newFromTeam,
          [toKey]: newToTeam,
        };
      });
    });
    setSelectedPlayer(null);
  };

  // Swap two players
  const performSwap = (
    gameId1: string,
    team1: 'A' | 'B',
    playerId1: string,
    gameId2: string,
    team2: 'A' | 'B',
    playerId2: string
  ) => {
    setGames(prevGames => {
      const newGames = prevGames.map(game => ({ ...game, team_a: [...game.team_a], team_b: [...game.team_b] }));

      const game1 = newGames.find(g => g.id === gameId1);
      const game2 = newGames.find(g => g.id === gameId2);
      if (!game1 || !game2) return prevGames;

      const team1Key = team1 === 'A' ? 'team_a' : 'team_b';
      const team2Key = team2 === 'A' ? 'team_a' : 'team_b';

      const player1Index = game1[team1Key].findIndex(p => p.id === playerId1);
      const player2Index = game2[team2Key].findIndex(p => p.id === playerId2);

      if (player1Index === -1 || player2Index === -1) return prevGames;

      // Swap the players
      const player1 = game1[team1Key][player1Index];
      const player2 = game2[team2Key][player2Index];

      game1[team1Key][player1Index] = player2;
      game2[team2Key][player2Index] = player1;

      return newGames;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const gameIds = games.map(g => g.id);
      await supabase
        .from('game_players')
        .delete()
        .in('game_id', gameIds);

      const gamePlayersToInsert = games.flatMap(game => [
        ...game.team_a.map(player => ({
          game_id: game.id,
          player_id: player.id,
          team: 'A' as const,
          rating_before: player.rating,
        })),
        ...game.team_b.map(player => ({
          game_id: game.id,
          player_id: player.id,
          team: 'B' as const,
          rating_before: player.rating,
        })),
      ]);

      const { error } = await supabase
        .from('game_players')
        .insert(gamePlayersToInsert);

      if (error) throw error;

      onSave();
    } catch (error) {
      console.error('Error saving teams:', error);
      alert('Failed to save teams. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isSelected = (gameId: string, team: 'A' | 'B', playerId: string) => {
    return selectedPlayer?.gameId === gameId &&
           selectedPlayer?.team === team &&
           selectedPlayer?.playerId === playerId;
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card-glass max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header - Fixed */}
        <div className="flex-shrink-0 p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-gray-100">Edit Teams</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200 p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-gray-400 text-sm">
            {selectedPlayer
              ? 'Click another player to swap positions, or click the same player to deselect'
              : 'Click a player to select them, then click another to swap. Use arrows to move between teams.'}
          </p>
          {selectedPlayer && (
            <div className="mt-2 px-3 py-1.5 bg-rally-coral/20 border border-rally-coral/50 rounded-lg inline-flex items-center gap-2">
              <span className="text-rally-coral text-sm font-medium">
                Selected: {games.flatMap(g => [...g.team_a, ...g.team_b]).find(p => p.id === selectedPlayer.playerId)?.name}
              </span>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="text-rally-coral hover:text-rally-accent"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {games.map(game => {
            const teamARating = calculateTeamRating(game.team_a);
            const teamBRating = calculateTeamRating(game.team_b);
            const ratingDiff = Math.abs(teamARating - teamBRating);

            return (
              <div key={game.id} className="bg-rally-dark/50 rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-100">
                    Court {game.court_number}
                  </h3>
                  <div className={`text-sm font-medium px-3 py-1 rounded-lg ${
                    ratingDiff > 100 ? 'bg-red-500/20 text-red-400' :
                    ratingDiff > 50 ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    Diff: {ratingDiff}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Team A */}
                  <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/30">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-blue-400">Team A</h4>
                      <span className="text-sm text-gray-400">
                        Avg: <span className="text-white font-medium">{teamARating}</span>
                      </span>
                    </div>
                    <div className="space-y-2">
                      {game.team_a.map(player => (
                        <PlayerCard
                          key={player.id}
                          player={player}
                          isSelected={isSelected(game.id, 'A', player.id)}
                          onClick={() => handlePlayerClick(game.id, 'A', player.id)}
                          onMoveToOtherTeam={() => moveToOtherTeam(game.id, 'A', player.id)}
                          moveDirection="right"
                          teamColor="blue"
                        />
                      ))}
                    </div>
                  </div>

                  {/* Team B */}
                  <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/30">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-red-400">Team B</h4>
                      <span className="text-sm text-gray-400">
                        Avg: <span className="text-white font-medium">{teamBRating}</span>
                      </span>
                    </div>
                    <div className="space-y-2">
                      {game.team_b.map(player => (
                        <PlayerCard
                          key={player.id}
                          player={player}
                          isSelected={isSelected(game.id, 'B', player.id)}
                          onClick={() => handlePlayerClick(game.id, 'B', player.id)}
                          onMoveToOtherTeam={() => moveToOtherTeam(game.id, 'B', player.id)}
                          moveDirection="left"
                          teamColor="red"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer - Fixed */}
        <div className="flex-shrink-0 p-6 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
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
              'Save Teams'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PlayerCardProps {
  player: Player;
  isSelected: boolean;
  onClick: () => void;
  onMoveToOtherTeam: () => void;
  moveDirection: 'left' | 'right';
  teamColor: 'blue' | 'red';
}

function PlayerCard({ player, isSelected, onClick, onMoveToOtherTeam, moveDirection, teamColor }: PlayerCardProps) {
  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
        isSelected
          ? 'bg-rally-coral/30 border-2 border-rally-coral ring-2 ring-rally-coral/50'
          : 'bg-rally-dark/70 border border-white/10 hover:border-white/20'
      }`}
    >
      {/* Move left button (for Team B) */}
      {moveDirection === 'left' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveToOtherTeam();
          }}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 transition-colors"
          title="Move to Team A"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Player info - clickable for swap */}
      <button
        onClick={onClick}
        className="flex-1 text-left min-w-0"
      >
        <div className="font-medium text-gray-100 truncate text-sm">{player.name}</div>
        <div className="flex items-center gap-2 text-xs">
          {player.position && player.position !== 'any' && (
            <span className={`px-1.5 py-0.5 rounded ${
              teamColor === 'blue' ? 'bg-blue-500/30 text-blue-300' : 'bg-red-500/30 text-red-300'
            }`}>
              {player.position}
            </span>
          )}
          <span className="text-gray-400">{player.rating}</span>
        </div>
      </button>

      {/* Move right button (for Team A) */}
      {moveDirection === 'right' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMoveToOtherTeam();
          }}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors"
          title="Move to Team B"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
