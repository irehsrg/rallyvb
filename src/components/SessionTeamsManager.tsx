import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Player, SessionTeam, Session, Game, RotationMode } from '../types';
import { generateTeams } from '../utils/teams';
import {
  generateNextRound,
  calculateStandings,
  getRotationModeName,
  getRotationModeDescription,
  isRoundRobinComplete,
  RoundMatchup,
} from '../utils/rotation';

interface SessionTeamsManagerProps {
  session: Session;
  checkins: { player: Player }[];
  games: Game[];
  onTeamsCreated: () => void;
  onGamesGenerated: () => void;
}

const TEAM_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#78716c'
];

export default function SessionTeamsManager({
  session,
  checkins,
  games,
  onTeamsCreated,
  onGamesGenerated,
}: SessionTeamsManagerProps) {
  const [sessionTeams, setSessionTeams] = useState<SessionTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showCreateTeams, setShowCreateTeams] = useState(false);
  const [teamCount, setTeamCount] = useState(3);
  const [teamSize, setTeamSize] = useState(6);
  const [rotationMode, setRotationMode] = useState<RotationMode>(session.rotation_mode || 'king_of_court');
  const [selectedPlayer, setSelectedPlayer] = useState<{ teamId: string; playerId: string } | null>(null);
  const [nextRoundPreview, setNextRoundPreview] = useState<RoundMatchup[] | null>(null);

  // Fetch session teams
  useEffect(() => {
    fetchSessionTeams();
  }, [session.id]);

  const fetchSessionTeams = async () => {
    setLoading(true);
    try {
      const { data: teams, error } = await supabase
        .from('session_teams')
        .select(`
          *,
          session_team_players (
            player_id,
            player:players (*)
          )
        `)
        .eq('session_id', session.id)
        .order('team_number');

      if (error) throw error;

      // Transform to include players array
      const teamsWithPlayers = (teams || []).map(team => ({
        ...team,
        players: team.session_team_players?.map((stp: any) => stp.player).filter(Boolean) || [],
      }));

      setSessionTeams(teamsWithPlayers);
    } catch (error) {
      console.error('Error fetching session teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeams = async () => {
    if (checkins.length < teamCount * 2) {
      alert(`Need at least ${teamCount * 2} players to create ${teamCount} teams`);
      return;
    }

    setGenerating(true);
    try {
      // Use the existing team generation logic
      const players = checkins.map(c => c.player);
      const generatedTeams = generateTeams(players, Math.ceil(teamCount / 2), teamSize, true, []);

      // Flatten into teams (each court has teamA and teamB)
      const allTeams: Player[][] = [];
      generatedTeams.forEach(court => {
        allTeams.push(court.teamA, court.teamB);
      });

      // Take only the number of teams we want
      const teamsToCreate = allTeams.slice(0, teamCount);

      // Update session rotation mode
      await supabase
        .from('sessions')
        .update({ rotation_mode: rotationMode, current_round: 1 })
        .eq('id', session.id);

      // Create session teams
      for (let i = 0; i < teamsToCreate.length; i++) {
        const teamPlayers = teamsToCreate[i];

        // Create team
        const { data: newTeam, error: teamError } = await supabase
          .from('session_teams')
          .insert({
            session_id: session.id,
            team_name: `Team ${i + 1}`,
            team_number: i + 1,
            color: TEAM_COLORS[i % TEAM_COLORS.length],
          })
          .select()
          .single();

        if (teamError) throw teamError;

        // Add players to team
        const playerInserts = teamPlayers.map(player => ({
          session_team_id: newTeam.id,
          player_id: player.id,
        }));

        const { error: playersError } = await supabase
          .from('session_team_players')
          .insert(playerInserts);

        if (playersError) throw playersError;
      }

      setShowCreateTeams(false);
      await fetchSessionTeams();
      onTeamsCreated();
    } catch (error: any) {
      console.error('Error creating teams:', error);
      alert('Failed to create teams: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteTeams = async () => {
    if (!confirm('Are you sure you want to delete all teams? This will also delete all games.')) {
      return;
    }

    try {
      // Delete games first (they reference session_teams)
      await supabase
        .from('games')
        .delete()
        .eq('session_id', session.id);

      // Delete teams (cascade will delete session_team_players)
      await supabase
        .from('session_teams')
        .delete()
        .eq('session_id', session.id);

      // Reset session round
      await supabase
        .from('sessions')
        .update({ current_round: 1 })
        .eq('id', session.id);

      setSessionTeams([]);
      onTeamsCreated();
    } catch (error: any) {
      console.error('Error deleting teams:', error);
      alert('Failed to delete teams: ' + error.message);
    }
  };

  const handleMovePlayer = async (fromTeamId: string, toTeamId: string, playerId: string) => {
    try {
      // Remove from old team
      await supabase
        .from('session_team_players')
        .delete()
        .eq('session_team_id', fromTeamId)
        .eq('player_id', playerId);

      // Add to new team
      await supabase
        .from('session_team_players')
        .insert({
          session_team_id: toTeamId,
          player_id: playerId,
        });

      setSelectedPlayer(null);
      await fetchSessionTeams();
    } catch (error: any) {
      console.error('Error moving player:', error);
      alert('Failed to move player: ' + error.message);
    }
  };

  const handleGenerateNextRound = async () => {
    if (sessionTeams.length < 2) {
      alert('Need at least 2 teams to generate games');
      return;
    }

    setGenerating(true);
    try {
      const currentRound = session.current_round || 1;
      const completedGames = games.filter(g => g.status === 'completed');

      const result = generateNextRound(
        sessionTeams,
        completedGames,
        rotationMode,
        session.court_count,
        currentRound
      );

      if (result.matchups.length === 0) {
        if (rotationMode === 'round_robin' && isRoundRobinComplete(sessionTeams, completedGames)) {
          alert('Round robin complete! All teams have played each other.');
        } else {
          alert('No valid matchups available for next round.');
        }
        setGenerating(false);
        return;
      }

      // Create games for each matchup
      for (const matchup of result.matchups) {
        // Create the game
        const { data: game, error: gameError } = await supabase
          .from('games')
          .insert({
            session_id: session.id,
            court_number: matchup.courtNumber,
            status: 'pending',
            round_number: currentRound,
            session_team_a_id: matchup.teamA.id,
            session_team_b_id: matchup.teamB.id,
          })
          .select()
          .single();

        if (gameError) throw gameError;

        // Add players to game_players
        const gamePlayersA = (matchup.teamA.players || []).map(p => ({
          game_id: game.id,
          player_id: p.id,
          team: 'A' as const,
          rating_before: p.rating,
        }));

        const gamePlayersB = (matchup.teamB.players || []).map(p => ({
          game_id: game.id,
          player_id: p.id,
          team: 'B' as const,
          rating_before: p.rating,
        }));

        await supabase
          .from('game_players')
          .insert([...gamePlayersA, ...gamePlayersB]);
      }

      // Increment round number
      await supabase
        .from('sessions')
        .update({ current_round: currentRound + 1 })
        .eq('id', session.id);

      onGamesGenerated();
    } catch (error: any) {
      console.error('Error generating round:', error);
      alert('Failed to generate round: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const previewNextRound = () => {
    const currentRound = session.current_round || 1;
    const completedGames = games.filter(g => g.status === 'completed');

    const result = generateNextRound(
      sessionTeams,
      completedGames,
      rotationMode,
      session.court_count,
      currentRound
    );

    setNextRoundPreview(result.matchups);
  };

  const standings = calculateStandings(sessionTeams, games);
  const pendingGames = games.filter(g => g.status === 'pending' || g.status === 'in_progress');
  const canGenerateNextRound = pendingGames.length === 0;

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-rally-coral"></div>
      </div>
    );
  }

  // No teams yet - show create teams UI
  if (sessionTeams.length === 0) {
    return (
      <div className="card-glass p-6">
        <h3 className="text-xl font-bold text-gray-100 mb-4">Session Teams</h3>

        {!showCreateTeams ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">No teams created yet. Create persistent teams that stay together throughout the session.</p>
            <button
              onClick={() => setShowCreateTeams(true)}
              className="btn-primary"
              disabled={checkins.length < 4}
            >
              Create Teams
            </button>
            {checkins.length < 4 && (
              <p className="text-sm text-yellow-400 mt-2">Need at least 4 checked-in players</p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Number of Teams
                </label>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={teamCount}
                  onChange={(e) => setTeamCount(parseInt(e.target.value) || 2)}
                  className="input-modern w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {checkins.length} players available
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Players per Team
                </label>
                <input
                  type="number"
                  min="2"
                  max="12"
                  value={teamSize}
                  onChange={(e) => setTeamSize(parseInt(e.target.value) || 6)}
                  className="input-modern w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Rotation Mode
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                {(['king_of_court', 'round_robin', 'swiss', 'manual'] as RotationMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setRotationMode(mode)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      rotationMode === mode
                        ? 'border-rally-coral bg-rally-coral/20'
                        : 'border-white/10 bg-rally-dark/50 hover:border-white/20'
                    }`}
                  >
                    <div className="font-medium text-gray-100">{getRotationModeName(mode)}</div>
                    <div className="text-xs text-gray-400 mt-1">{getRotationModeDescription(mode)}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateTeams(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTeams}
                className="btn-primary flex-1"
                disabled={generating || checkins.length < teamCount * 2}
              >
                {generating ? 'Creating...' : 'Create Teams'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Teams exist - show management UI
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-glass p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-100">Session Teams</h3>
            <p className="text-sm text-gray-400">
              {getRotationModeName(session.rotation_mode || 'manual')} • Round {session.current_round || 1}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDeleteTeams}
              className="px-3 py-1.5 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
            >
              Reset Teams
            </button>
          </div>
        </div>
      </div>

      {/* Standings */}
      {games.filter(g => g.status === 'completed').length > 0 && (
        <div className="card-glass p-4">
          <h4 className="font-semibold text-gray-200 mb-3">Standings</h4>
          <div className="space-y-2">
            {standings.map((team, index) => (
              <div
                key={team.id}
                className="flex items-center justify-between p-2 rounded-lg bg-rally-dark/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-500 w-6">{index + 1}</span>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: team.color || '#6b7280' }}
                  />
                  <span className="font-medium text-gray-200">{team.team_name}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-400">{team.wins || 0}W</span>
                  <span className="text-red-400">{team.losses || 0}L</span>
                  <span className={`${(team.point_differential || 0) >= 0 ? 'text-blue-400' : 'text-gray-400'}`}>
                    {(team.point_differential || 0) >= 0 ? '+' : ''}{team.point_differential || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teams Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessionTeams.map((team) => (
          <div
            key={team.id}
            className="card-glass p-4"
            style={{ borderLeftColor: team.color || '#6b7280', borderLeftWidth: '4px' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-200">{team.team_name}</h4>
              <span className="text-xs text-gray-400">{team.players?.length || 0} players</span>
            </div>
            <div className="space-y-1">
              {team.players?.map((player) => (
                <div
                  key={player.id}
                  onClick={() => {
                    if (selectedPlayer?.playerId === player.id) {
                      setSelectedPlayer(null);
                    } else if (selectedPlayer) {
                      // Move player to this team
                      handleMovePlayer(selectedPlayer.teamId, team.id, selectedPlayer.playerId);
                    } else {
                      setSelectedPlayer({ teamId: team.id, playerId: player.id });
                    }
                  }}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer transition-all ${
                    selectedPlayer?.playerId === player.id
                      ? 'bg-rally-coral/30 border border-rally-coral'
                      : selectedPlayer
                      ? 'bg-green-500/20 border border-green-500/50 hover:bg-green-500/30'
                      : 'bg-rally-dark/50 hover:bg-rally-dark/70'
                  }`}
                >
                  <span className="text-sm text-gray-200">{player.name}</span>
                  <span className="text-xs text-gray-400">{player.rating}</span>
                </div>
              ))}
            </div>
            {team.players?.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-2">No players</p>
            )}
          </div>
        ))}
      </div>

      {selectedPlayer && (
        <div className="text-center text-sm text-rally-coral">
          Click another team to move player, or click the same player to deselect
        </div>
      )}

      {/* Generate Next Round */}
      <div className="card-glass p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h4 className="font-semibold text-gray-200">Next Round</h4>
            {!canGenerateNextRound && (
              <p className="text-sm text-yellow-400">
                Complete current games before generating next round
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={previewNextRound}
              className="px-4 py-2 bg-rally-dark/50 hover:bg-rally-dark text-gray-200 rounded-lg transition-colors"
              disabled={!canGenerateNextRound}
            >
              Preview
            </button>
            <button
              onClick={handleGenerateNextRound}
              className="btn-primary"
              disabled={!canGenerateNextRound || generating}
            >
              {generating ? 'Generating...' : 'Generate Games'}
            </button>
          </div>
        </div>

        {/* Preview */}
        {nextRoundPreview && nextRoundPreview.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-gray-400">Upcoming matchups:</p>
            {nextRoundPreview.map((matchup, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-rally-dark/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Court {matchup.courtNumber}</span>
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: matchup.teamA.color || '#6b7280' }}
                  />
                  <span className="text-gray-200">{matchup.teamA.team_name}</span>
                </div>
                <span className="text-gray-500">vs</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-200">{matchup.teamB.team_name}</span>
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: matchup.teamB.color || '#6b7280' }}
                  />
                </div>
              </div>
            ))}
            <button
              onClick={() => setNextRoundPreview(null)}
              className="text-sm text-gray-400 hover:text-gray-200"
            >
              Hide preview
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
