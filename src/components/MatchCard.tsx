import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Game, Player, Team, SetScore, TournamentGame } from '../types';
import { MatchSetScores } from './SetScoreInput';

interface MatchCardProps {
  game: Game | TournamentGame;
  onRecordResult?: (gameId: string, scoreA: number, scoreB: number, setScores?: SetScore[]) => Promise<void>;
  showEditTeams?: boolean;
  onEditTeams?: (gameId: string) => void;
}

function calculateBalanceScore(teamA: Player[], teamB: Player[]) {
  const avgA = teamA.reduce((sum, p) => sum + p.rating, 0) / teamA.length;
  const avgB = teamB.reduce((sum, p) => sum + p.rating, 0) / teamB.length;
  const difference = Math.abs(avgA - avgB);
  const fairnessPercent = Math.max(0, 100 - (difference / Math.max(avgA, avgB)) * 100);

  return { avgA, avgB, difference, fairnessPercent };
}

export default function MatchCard({ game, onRecordResult, showEditTeams = false, onEditTeams }: MatchCardProps) {
  const [teamAPlayers, setTeamAPlayers] = useState<Player[]>([]);
  const [teamBPlayers, setTeamBPlayers] = useState<Player[]>([]);
  const [teamAEntity, setTeamAEntity] = useState<Team | null>(null);
  const [teamBEntity, setTeamBEntity] = useState<Team | null>(null);
  const [scoreA, setScoreA] = useState(game.score_a || 0);
  const [scoreB, setScoreB] = useState(game.score_b || 0);
  const [setScores, setSetScores] = useState<SetScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<any>(null);

  const isTournamentMatch = 'tournament_id' in game && game.tournament_id;

  useEffect(() => {
    fetchMatchData();
  }, [game.id]);

  const fetchMatchData = async () => {
    try {
      // Fetch player rosters
      const { data: playerData, error: playerError } = await supabase
        .from('game_players')
        .select('*, player:players(*)')
        .eq('game_id', game.id);

      if (playerError) throw playerError;

      setTeamAPlayers(playerData?.filter(gp => gp.team === 'A').map(gp => gp.player) || []);
      setTeamBPlayers(playerData?.filter(gp => gp.team === 'B').map(gp => gp.player) || []);

      // If tournament match, fetch team entities and tournament info
      if (isTournamentMatch) {
        const tournamentGame = game as TournamentGame;

        if (tournamentGame.team_a_id) {
          const { data: teamA } = await supabase
            .from('teams')
            .select('*')
            .eq('id', tournamentGame.team_a_id)
            .single();
          setTeamAEntity(teamA);
        }

        if (tournamentGame.team_b_id) {
          const { data: teamB } = await supabase
            .from('teams')
            .select('*')
            .eq('id', tournamentGame.team_b_id)
            .single();
          setTeamBEntity(teamB);
        }

        if (tournamentGame.tournament_id) {
          const { data: tournamentData } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', tournamentGame.tournament_id)
            .single();
          setTournament(tournamentData);
        }

        // Initialize set scores
        if (tournamentGame.set_scores && Array.isArray(tournamentGame.set_scores)) {
          setSetScores(tournamentGame.set_scores);
        } else if (tournament) {
          // Initialize empty set scores based on best_of
          const emptyScores: SetScore[] = [];
          for (let i = 0; i < tournament.best_of; i++) {
            emptyScores.push({ team_a: 0, team_b: 0 });
          }
          setSetScores(emptyScores);
        }
      }
    } catch (error) {
      console.error('Error fetching match data:', error);
    } finally {
      setLoading(false);
    }
  };

  const balance = teamAPlayers.length > 0 && teamBPlayers.length > 0
    ? calculateBalanceScore(teamAPlayers, teamBPlayers)
    : null;

  const handleSubmit = async () => {
    if (isTournamentMatch && tournament) {
      // Validate set scores
      const setsToWin = Math.ceil(tournament.best_of / 2);
      let teamASetsWon = 0;
      let teamBSetsWon = 0;

      setScores.forEach(set => {
        if (set.team_a > set.team_b) teamASetsWon++;
        else if (set.team_b > set.team_a) teamBSetsWon++;
      });

      if (teamASetsWon < setsToWin && teamBSetsWon < setsToWin) {
        alert(`Match not complete! A team must win ${setsToWin} sets.`);
        return;
      }

      // Calculate total points for score_a and score_b
      const totalScoreA = setScores.reduce((sum, set) => sum + set.team_a, 0);
      const totalScoreB = setScores.reduce((sum, set) => sum + set.team_b, 0);

      await onRecordResult?.(game.id, totalScoreA, totalScoreB, setScores);
    } else {
      // Pickup game - simple scoring
      if (scoreA === scoreB) {
        alert('Scores cannot be tied');
        return;
      }
      await onRecordResult?.(game.id, scoreA, scoreB);
    }
  };

  if (loading) {
    return (
      <div className="card-glass p-6">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-rally-coral"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-glass p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-gray-100">Court {game.court_number}</h3>
          {isTournamentMatch && tournament && (
            <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded border border-purple-500/30 font-medium">
              Tournament
            </span>
          )}
          {isTournamentMatch && (game as TournamentGame).match_round && (
            <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
              {(game as TournamentGame).match_round?.replace('_', ' ').toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {balance && !isTournamentMatch && (
            <span className="text-sm px-3 py-1 bg-rally-dark rounded-lg">
              <span className="text-gray-400">Balance: </span>
              <span className={`font-semibold ${
                balance.fairnessPercent >= 90 ? 'text-green-400' :
                balance.fairnessPercent >= 70 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {balance.fairnessPercent.toFixed(0)}%
              </span>
            </span>
          )}
          {showEditTeams && onEditTeams && game.status !== 'completed' && (
            <button
              onClick={() => onEditTeams(game.id)}
              className="px-3 py-1 text-xs bg-rally-dark hover:bg-rally-light text-gray-300 rounded-lg transition-all"
            >
              Edit Teams
            </button>
          )}
        </div>
      </div>

      {/* Tournament Info */}
      {isTournamentMatch && tournament && (
        <div className="mb-4 p-3 bg-rally-dark/50 rounded-lg border border-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-purple-400">{tournament.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                Best of {tournament.best_of} • {tournament.format.replace('_', ' ')}
              </div>
            </div>
            {(game as TournamentGame).set_number && (
              <div className="text-xs text-gray-400">
                Set {(game as TournamentGame).set_number}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Teams Display */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Team A */}
        <div className="bg-rally-dark/50 rounded-xl p-4 border-2 border-blue-500/30">
          <div className="flex items-center justify-between mb-3">
            <div>
              {teamAEntity ? (
                <div>
                  <h4 className="font-bold text-blue-400">{teamAEntity.name}</h4>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {teamAEntity.wins}W-{teamAEntity.losses}L
                  </div>
                </div>
              ) : (
                <h4 className="font-bold text-blue-400">Team A</h4>
              )}
            </div>
            {!teamAEntity && balance && (
              <span className="text-sm text-gray-400">Avg: {balance.avgA.toFixed(0)}</span>
            )}
          </div>
          <ul className="space-y-2">
            {teamAPlayers.map(player => (
              <li key={player.id} className="flex justify-between text-sm">
                <span className="text-gray-300">{player.name}</span>
                <span className="text-gray-500 font-mono">{player.rating}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Team B */}
        <div className="bg-rally-dark/50 rounded-xl p-4 border-2 border-red-500/30">
          <div className="flex items-center justify-between mb-3">
            <div>
              {teamBEntity ? (
                <div>
                  <h4 className="font-bold text-red-400">{teamBEntity.name}</h4>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {teamBEntity.wins}W-{teamBEntity.losses}L
                  </div>
                </div>
              ) : (
                <h4 className="font-bold text-red-400">Team B</h4>
              )}
            </div>
            {!teamBEntity && balance && (
              <span className="text-sm text-gray-400">Avg: {balance.avgB.toFixed(0)}</span>
            )}
          </div>
          <ul className="space-y-2">
            {teamBPlayers.map(player => (
              <li key={player.id} className="flex justify-between text-sm">
                <span className="text-gray-300">{player.name}</span>
                <span className="text-gray-500 font-mono">{player.rating}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Scoring Section */}
      {game.status === 'completed' ? (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          {isTournamentMatch && setScores.length > 0 ? (
            <div>
              <div className="text-center mb-3">
                <svg className="w-6 h-6 mx-auto mb-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="font-semibold text-green-400">
                  Match Complete - Team {game.winner || ((game as TournamentGame).match_winner)} wins!
                </p>
              </div>
              <div className="space-y-2 bg-rally-dark/50 rounded-lg p-3">
                <h5 className="text-xs font-semibold text-gray-400 uppercase">Set Scores</h5>
                {setScores.map((set, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Set {index + 1}</span>
                    <span className="font-mono">
                      <span className={set.team_a > set.team_b ? 'text-blue-400 font-bold' : 'text-gray-300'}>
                        {set.team_a}
                      </span>
                      {' - '}
                      <span className={set.team_b > set.team_a ? 'text-red-400 font-bold' : 'text-gray-300'}>
                        {set.team_b}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center">
              <svg className="w-6 h-6 mx-auto mb-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="font-semibold text-green-400">
                Final Score: {game.score_a} - {game.score_b}
              </p>
              <p className="text-sm text-green-400/70 mt-1">Team {game.winner} wins!</p>
            </div>
          )}
        </div>
      ) : (
        <div>
          {isTournamentMatch && tournament ? (
            <MatchSetScores
              setScores={setScores}
              pointsToWin={tournament.points_to_win || 25}
              decidingSetPoints={tournament.deciding_set_points || 15}
              minPointDifference={tournament.min_point_difference || 2}
              bestOf={tournament.best_of}
              onSetScoresChange={setSetScores}
            />
          ) : (
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Team A Score</label>
                <input
                  type="number"
                  value={scoreA}
                  onChange={e => setScoreA(parseInt(e.target.value) || 0)}
                  className="input-modern w-full"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Team B Score</label>
                <input
                  type="number"
                  value={scoreB}
                  onChange={e => setScoreB(parseInt(e.target.value) || 0)}
                  className="input-modern w-full"
                />
              </div>
            </div>
          )}

          {onRecordResult && (
            <button
              onClick={handleSubmit}
              className="btn-primary w-full mt-4"
            >
              Record Result
            </button>
          )}
        </div>
      )}
    </div>
  );
}
