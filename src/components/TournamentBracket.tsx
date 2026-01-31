import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { supabase } from '../lib/supabase';
import { Team, TournamentGame, Tournament } from '../types';
import { prepareForCapture } from '../utils/pngExport';

interface BracketMatch {
  id?: string;
  round: number;
  position: number;
  team_a?: Team;
  team_b?: Team;
  winner?: 'A' | 'B';
  score_a?: number;
  score_b?: number;
  game?: TournamentGame;
}

interface TournamentBracketProps {
  tournament: Tournament;
  teams: Team[];
  matches: TournamentGame[];
  onMatchUpdated?: () => void;
}

export default function TournamentBracket({ tournament, teams, matches, onMatchUpdated }: TournamentBracketProps) {
  const bracketRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [editingMatch, setEditingMatch] = useState<BracketMatch | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [saving, setSaving] = useState(false);

  const handleDownloadPNG = async () => {
    if (!bracketRef.current) return;

    setDownloading(true);
    try {
      // Prepare element for capture (converts oklab colors to hex)
      const cleanup = prepareForCapture(bracketRef.current);

      const canvas = await html2canvas(bracketRef.current, {
        backgroundColor: '#1a1a2e',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      cleanup();

      const link = document.createElement('a');
      link.download = `${tournament.name.replace(/[^a-z0-9]/gi, '_')}_bracket.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error generating bracket image:', error);
      alert('Failed to generate bracket image');
    } finally {
      setDownloading(false);
    }
  };

  const handleEditMatch = (match: BracketMatch) => {
    if (!match.team_a || !match.team_b) return; // Can't score a match without both teams
    setEditingMatch(match);
    setScoreA(match.score_a?.toString() || '');
    setScoreB(match.score_b?.toString() || '');
  };

  const handleSaveScore = async () => {
    if (!editingMatch?.id) return;

    const scoreANum = parseInt(scoreA) || 0;
    const scoreBNum = parseInt(scoreB) || 0;

    if (scoreANum === scoreBNum) {
      alert('Games cannot end in a tie. Please enter different scores.');
      return;
    }

    setSaving(true);
    try {
      const winner: 'A' | 'B' = scoreANum > scoreBNum ? 'A' : 'B';
      const winningTeamId = winner === 'A' ? editingMatch.team_a?.id : editingMatch.team_b?.id;

      // Update the current game
      const { error: updateError } = await supabase
        .from('games')
        .update({
          score_a: scoreANum,
          score_b: scoreBNum,
          match_winner: winner,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', editingMatch.id);

      if (updateError) throw updateError;

      // Find and update the next round game to advance the winner
      const currentRound = editingMatch.game?.match_round || '';
      const nextRoundName = getNextRoundName(currentRound);

      if (nextRoundName && winningTeamId) {
        // Get current game's court_number to calculate next round position
        // Position in display is 0-indexed, court_number in DB is 1-indexed
        const currentCourtNumber = editingMatch.game?.court_number || (editingMatch.position + 1);

        // Calculate which position in the next round this winner goes to
        // Games 1,2 → Position 1 (court 1), Games 3,4 → Position 2 (court 2), etc.
        const nextCourtNumber = Math.ceil(currentCourtNumber / 2);
        // Odd court numbers (1,3,5...) go to team_a, even (2,4,6...) go to team_b
        const isTeamA = currentCourtNumber % 2 === 1;

        // Find the next round game
        const { data: nextGames, error: findError } = await supabase
          .from('games')
          .select('*')
          .eq('tournament_id', tournament.id)
          .eq('match_round', nextRoundName)
          .eq('court_number', nextCourtNumber);

        if (findError) {
          console.error('Error finding next round game:', findError);
        } else if (nextGames && nextGames.length > 0) {
          const nextGame = nextGames[0];
          const updateField = isTeamA ? 'team_a_id' : 'team_b_id';

          const { error: advanceError } = await supabase
            .from('games')
            .update({ [updateField]: winningTeamId })
            .eq('id', nextGame.id);

          if (advanceError) {
            console.error('Error advancing winner to next round:', advanceError);
          }
        } else {
          console.warn(`No next round game found: round=${nextRoundName}, court=${nextCourtNumber}`);
        }
      }

      setEditingMatch(null);
      onMatchUpdated?.();
    } catch (error) {
      console.error('Error saving score:', error);
      alert('Failed to save score');
    } finally {
      setSaving(false);
    }
  };

  const getNextRoundName = (currentRound: string): string | null => {
    if (currentRound === 'finals') return null;
    if (currentRound === 'semifinals') return 'finals';
    if (currentRound === 'quarterfinals') return 'semifinals';
    // Handle round_1, round_2, etc.
    const match = currentRound.match(/round_(\d+)/);
    if (match) {
      const roundNum = parseInt(match[1]);
      const totalRounds = Math.ceil(Math.log2(teams.length));
      const fromEnd = totalRounds - roundNum;
      if (fromEnd === 2) return 'semifinals';
      if (fromEnd === 1) return 'finals';
      return `round_${roundNum + 1}`;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Download Button */}
      <div className="flex justify-end">
        <button
          onClick={handleDownloadPNG}
          disabled={downloading}
          className="flex items-center gap-2 px-4 py-2 bg-rally-dark hover:bg-rally-light border border-white/10 hover:border-white/20 rounded-lg text-gray-200 transition-all disabled:opacity-50"
        >
          {downloading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-200"></div>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download PNG</span>
            </>
          )}
        </button>
      </div>

      {/* Bracket Content */}
      <div ref={bracketRef} className="p-4 bg-rally-darker rounded-xl">
        {/* Tournament Header */}
        <div className="text-center mb-6 pb-4 border-b border-white/10">
          <h2 className="text-2xl font-bold text-gray-100">{tournament.name}</h2>
          <p className="text-gray-400 text-sm mt-1">
            {tournament.format === 'round_robin' ? 'Round Robin' :
             tournament.format === 'single_elimination' ? 'Single Elimination' : 'Double Elimination'}
            {tournament.start_date && ` • ${new Date(tournament.start_date).toLocaleDateString()}`}
          </p>
        </div>

        {tournament.format === 'round_robin' && !tournament.playoffs_enabled ? (
          <RoundRobinView teams={teams} matches={matches} />
        ) : (
          <>
            {/* Show standings for season tournaments with playoffs */}
            {tournament.format === 'round_robin' && tournament.playoffs_enabled && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-300 mb-4">Season Standings</h3>
                <RoundRobinView teams={teams} matches={matches.filter(m => m.match_round?.startsWith('week_'))} />
              </div>
            )}
            {/* Playoff/Elimination Bracket */}
            <div>
              {tournament.playoffs_enabled && (
                <h3 className="text-lg font-semibold text-gray-300 mb-4">Playoff Bracket</h3>
              )}
              <EliminationBracket
                teams={teams}
                matches={matches.filter(m => !m.match_round?.startsWith('week_'))}
                onEditMatch={handleEditMatch}
              />
            </div>
          </>
        )}
      </div>

      {/* Score Entry Modal */}
      {editingMatch && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-rally-dark rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h3 className="text-xl font-bold text-gray-100 mb-6 text-center">Enter Score</h3>

            <div className="space-y-4">
              {/* Team A */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {editingMatch.team_a?.name || 'Team A'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={scoreA}
                    onChange={(e) => setScoreA(e.target.value)}
                    className="w-full px-4 py-3 bg-rally-darker border border-white/10 rounded-lg text-gray-100 text-center text-2xl font-bold focus:outline-none focus:border-rally-coral"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="text-center text-gray-500 text-sm">vs</div>

              {/* Team B */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {editingMatch.team_b?.name || 'Team B'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={scoreB}
                    onChange={(e) => setScoreB(e.target.value)}
                    className="w-full px-4 py-3 bg-rally-darker border border-white/10 rounded-lg text-gray-100 text-center text-2xl font-bold focus:outline-none focus:border-rally-coral"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Preview Winner */}
            {scoreA && scoreB && parseInt(scoreA) !== parseInt(scoreB) && (
              <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                <span className="text-green-400 font-medium">
                  Winner: {parseInt(scoreA) > parseInt(scoreB) ? editingMatch.team_a?.name : editingMatch.team_b?.name}
                </span>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingMatch(null)}
                className="flex-1 px-4 py-3 bg-rally-darker border border-white/10 rounded-lg text-gray-300 hover:bg-rally-light transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveScore}
                disabled={saving || !scoreA || !scoreB || parseInt(scoreA) === parseInt(scoreB)}
                className="flex-1 px-4 py-3 bg-rally-coral text-white font-semibold rounded-lg hover:bg-rally-coral/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Score'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EliminationBracket({ teams, matches, onEditMatch }: { teams: Team[]; matches: TournamentGame[]; onEditMatch: (match: BracketMatch) => void }) {
  // Calculate bracket structure
  const teamCount = teams.length;
  const rounds = Math.ceil(Math.log2(teamCount));

  // Generate bracket matches
  const generateBracket = (): BracketMatch[][] => {
    const bracket: BracketMatch[][] = [];

    for (let round = 0; round < rounds; round++) {
      const matchesInRound = Math.pow(2, rounds - round - 1);
      const roundMatches: BracketMatch[] = [];

      for (let pos = 0; pos < matchesInRound; pos++) {
        // Find actual game for this bracket position
        const game = matches.find(
          (m) => m.match_round === getRoundName(round, rounds) && m.court_number === pos + 1
        );

        roundMatches.push({
          id: game?.id,
          round,
          position: pos,
          team_a: game?.team_a_id ? teams.find(t => t.id === game.team_a_id) : undefined,
          team_b: game?.team_b_id ? teams.find(t => t.id === game.team_b_id) : undefined,
          winner: game?.match_winner,
          score_a: game?.score_a ?? undefined,
          score_b: game?.score_b ?? undefined,
          game,
        });
      }

      bracket.push(roundMatches);
    }

    return bracket;
  };

  const getRoundName = (roundIndex: number, totalRounds: number): string => {
    const fromEnd = totalRounds - roundIndex;
    if (fromEnd === 1) return 'finals';
    if (fromEnd === 2) return 'semifinals';
    if (fromEnd === 3) return 'quarterfinals';
    return `round_${roundIndex + 1}`;
  };

  const getRoundDisplayName = (roundIndex: number, totalRounds: number): string => {
    const fromEnd = totalRounds - roundIndex;
    if (fromEnd === 1) return 'Finals';
    if (fromEnd === 2) return 'Semi-Finals';
    if (fromEnd === 3) return 'Quarter-Finals';
    return `Round ${roundIndex + 1}`;
  };

  const bracket = generateBracket();

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-8 min-w-max p-4">
        {bracket.map((roundMatches, roundIndex) => (
          <div key={roundIndex} className="flex flex-col justify-around min-h-[600px]">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 text-center">
              {getRoundDisplayName(roundIndex, rounds)}
            </h3>
            <div className="flex flex-col justify-around flex-1 gap-4">
              {roundMatches.map((match) => (
                <BracketMatchCard key={`${roundIndex}-${match.position}`} match={match} onEdit={onEditMatch} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketMatchCard({ match, onEdit }: { match: BracketMatch; onEdit: (match: BracketMatch) => void }) {
  const canEdit = match.team_a && match.team_b && match.game?.status !== 'completed';
  const isCompleted = match.game?.status === 'completed';

  return (
    <div
      onClick={() => canEdit && onEdit(match)}
      className={`w-64 bg-rally-dark/50 rounded-xl border-2 overflow-hidden transition-all ${
        canEdit
          ? 'border-white/10 hover:border-rally-coral/50 cursor-pointer hover:shadow-lg'
          : isCompleted
          ? 'border-green-500/30'
          : 'border-white/10'
      }`}
    >
      {/* Team A */}
      <div
        className={`p-3 border-b border-white/10 ${
          match.winner === 'A' ? 'bg-green-500/20 border-l-4 border-l-green-500' : ''
        }`}
      >
        {match.team_a ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="font-semibold text-gray-100 truncate">{match.team_a.name}</span>
              {match.winner === 'A' && (
                <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            {match.score_a !== undefined && (
              <span className={`text-lg font-bold ml-2 ${
                match.winner === 'A' ? 'text-green-400' : 'text-gray-400'
              }`}>
                {match.score_a}
              </span>
            )}
          </div>
        ) : (
          <div className="text-gray-600 text-sm">TBD</div>
        )}
      </div>

      {/* Team B */}
      <div
        className={`p-3 ${
          match.winner === 'B' ? 'bg-green-500/20 border-l-4 border-l-green-500' : ''
        }`}
      >
        {match.team_b ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="font-semibold text-gray-100 truncate">{match.team_b.name}</span>
              {match.winner === 'B' && (
                <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            {match.score_b !== undefined && (
              <span className={`text-lg font-bold ml-2 ${
                match.winner === 'B' ? 'text-green-400' : 'text-gray-400'
              }`}>
                {match.score_b}
              </span>
            )}
          </div>
        ) : (
          <div className="text-gray-600 text-sm">TBD</div>
        )}
      </div>

      {/* Match Status */}
      {match.game?.status === 'in_progress' && (
        <div className="px-3 py-1 bg-rally-dark text-center">
          <span className="text-xs text-green-400 font-medium">In Progress</span>
        </div>
      )}
      {canEdit && (
        <div className="px-3 py-1 bg-rally-coral/10 text-center">
          <span className="text-xs text-rally-coral font-medium">Click to enter score</span>
        </div>
      )}
      {!match.team_a && !match.team_b && (
        <div className="px-3 py-1 bg-rally-dark text-center">
          <span className="text-xs text-gray-500">Waiting for previous round</span>
        </div>
      )}
    </div>
  );
}

function RoundRobinView({ teams, matches }: { teams: Team[]; matches: TournamentGame[] }) {
  // Calculate standings
  const standings = teams.map((team) => {
    const teamMatches = matches.filter(
      (m) => m.team_a_id === team.id || m.team_b_id === team.id
    );

    let wins = 0;
    let losses = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;

    teamMatches.forEach((match) => {
      if (match.status === 'completed') {
        const isTeamA = match.team_a_id === team.id;
        const won = (isTeamA && match.match_winner === 'A') || (!isTeamA && match.match_winner === 'B');

        if (won) wins++;
        else losses++;

        pointsFor += isTeamA ? (match.score_a || 0) : (match.score_b || 0);
        pointsAgainst += isTeamA ? (match.score_b || 0) : (match.score_a || 0);
      }
    });

    return {
      team,
      wins,
      losses,
      played: wins + losses,
      pointsFor,
      pointsAgainst,
      pointDiff: pointsFor - pointsAgainst,
      winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
    };
  }).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.pointDiff - a.pointDiff;
  });

  return (
    <div className="space-y-6">
      {/* Standings Table */}
      <div className="card-glass p-6">
        <h3 className="text-xl font-bold text-gray-100 mb-4">Standings</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-white/10">
                <th className="pb-3 text-sm font-semibold text-gray-400">#</th>
                <th className="pb-3 text-sm font-semibold text-gray-400">Team</th>
                <th className="pb-3 text-sm font-semibold text-gray-400 text-center">W</th>
                <th className="pb-3 text-sm font-semibold text-gray-400 text-center">L</th>
                <th className="pb-3 text-sm font-semibold text-gray-400 text-center">Win %</th>
                <th className="pb-3 text-sm font-semibold text-gray-400 text-center">PF</th>
                <th className="pb-3 text-sm font-semibold text-gray-400 text-center">PA</th>
                <th className="pb-3 text-sm font-semibold text-gray-400 text-center">Diff</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((standing, index) => (
                <tr key={standing.team.id} className="border-b border-white/5 hover:bg-rally-dark/30 transition-colors">
                  <td className="py-3 text-gray-300 font-semibold">{index + 1}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-100">{standing.team.name}</span>
                      {index < 3 && (
                        <span className={`w-2 h-2 rounded-full ${
                          index === 0 ? 'bg-yellow-400' : index === 1 ? 'bg-gray-400' : 'bg-orange-400'
                        }`} />
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-center text-green-400 font-semibold">{standing.wins}</td>
                  <td className="py-3 text-center text-red-400 font-semibold">{standing.losses}</td>
                  <td className="py-3 text-center text-gray-300">{standing.winRate.toFixed(0)}%</td>
                  <td className="py-3 text-center text-gray-400">{standing.pointsFor}</td>
                  <td className="py-3 text-center text-gray-400">{standing.pointsAgainst}</td>
                  <td className={`py-3 text-center font-semibold ${
                    standing.pointDiff > 0 ? 'text-green-400' : standing.pointDiff < 0 ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {standing.pointDiff > 0 ? '+' : ''}{standing.pointDiff}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Match Results */}
      <div className="card-glass p-6">
        <h3 className="text-xl font-bold text-gray-100 mb-4">Match Results</h3>
        <div className="space-y-3">
          {matches
            .filter(m => m.status === 'completed')
            .sort((a, b) => new Date(b.completed_at || '').getTime() - new Date(a.completed_at || '').getTime())
            .map((match) => {
              const teamA = teams.find(t => t.id === match.team_a_id);
              const teamB = teams.find(t => t.id === match.team_b_id);

              return (
                <div key={match.id} className="p-4 bg-rally-dark/50 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className={`flex items-center justify-between mb-1 ${
                        match.match_winner === 'A' ? 'font-bold' : ''
                      }`}>
                        <span className={match.match_winner === 'A' ? 'text-green-400' : 'text-gray-300'}>
                          {teamA?.name || 'TBD'}
                        </span>
                        <span className={`text-lg ${match.match_winner === 'A' ? 'text-green-400' : 'text-gray-400'}`}>
                          {match.score_a}
                        </span>
                      </div>
                      <div className={`flex items-center justify-between ${
                        match.match_winner === 'B' ? 'font-bold' : ''
                      }`}>
                        <span className={match.match_winner === 'B' ? 'text-green-400' : 'text-gray-300'}>
                          {teamB?.name || 'TBD'}
                        </span>
                        <span className={`text-lg ${match.match_winner === 'B' ? 'text-green-400' : 'text-gray-400'}`}>
                          {match.score_b}
                        </span>
                      </div>
                    </div>
                  </div>
                  {match.completed_at && (
                    <div className="text-xs text-gray-500 mt-2">
                      {new Date(match.completed_at).toLocaleString()}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
