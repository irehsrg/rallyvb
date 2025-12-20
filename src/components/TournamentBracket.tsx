import { Team, TournamentGame, Tournament } from '../types';

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
}

export default function TournamentBracket({ tournament, teams, matches }: TournamentBracketProps) {
  if (tournament.format === 'round_robin') {
    return <RoundRobinView teams={teams} matches={matches} />;
  }

  return <EliminationBracket teams={teams} matches={matches} />;
}

function EliminationBracket({ teams, matches }: { teams: Team[]; matches: TournamentGame[] }) {
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
                <BracketMatchCard key={`${roundIndex}-${match.position}`} match={match} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketMatchCard({ match }: { match: BracketMatch }) {
  return (
    <div className="w-64 bg-rally-dark/50 rounded-xl border-2 border-white/10 overflow-hidden">
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
      {!match.team_a && !match.team_b && (
        <div className="px-3 py-1 bg-rally-dark text-center">
          <span className="text-xs text-gray-500">Not Scheduled</span>
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
