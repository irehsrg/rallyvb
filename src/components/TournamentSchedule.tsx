import { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { supabase } from '../lib/supabase';
import { Tournament, Team } from '../types';
import { formatTime } from '../utils/schedule';
import { prepareForCapture } from '../utils/pngExport';

interface ScheduledGame {
  id: string;
  team_a_id: string;
  team_b_id: string;
  week_number: number;
  scheduled_date: string;
  scheduled_time?: string;
  match_round: string;
  court_number: number;
  status: string;
  score_a?: number;
  score_b?: number;
  match_winner?: 'A' | 'B';
}

interface TournamentScheduleProps {
  tournament: Tournament;
  teams: Team[];
  onGameUpdated?: () => void;
}

export default function TournamentSchedule({ tournament, teams, onGameUpdated }: TournamentScheduleProps) {
  const scheduleRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [games, setGames] = useState<ScheduledGame[]>([]);
  const [loading, setLoading] = useState(true);

  // Score entry state
  const [editingGame, setEditingGame] = useState<ScheduledGame | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSchedule();
  }, [tournament.id]);

  const fetchSchedule = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('tournament_id', tournament.id)
        .like('match_round', 'week_%')
        .order('week_number')
        .order('court_number');

      if (error) throw error;
      setGames(data || []);
    } catch (error) {
      console.error('Error fetching schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPNG = async () => {
    if (!scheduleRef.current) return;

    setDownloading(true);
    try {
      // Prepare element for capture (converts oklab colors to hex)
      const cleanup = prepareForCapture(scheduleRef.current);

      const canvas = await html2canvas(scheduleRef.current, {
        backgroundColor: '#1a1a2e',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      cleanup();

      const link = document.createElement('a');
      link.download = `${tournament.name.replace(/[^a-z0-9]/gi, '_')}_schedule.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error generating schedule image:', error);
      alert('Failed to generate schedule image');
    } finally {
      setDownloading(false);
    }
  };

  const getTeamName = (teamId: string) => {
    return teams.find(t => t.id === teamId)?.name || 'TBD';
  };

  const handleEditGame = (game: ScheduledGame) => {
    if (game.status === 'completed') return; // Already completed
    setEditingGame(game);
    setScoreA(game.score_a?.toString() || '');
    setScoreB(game.score_b?.toString() || '');
  };

  const handleSaveScore = async () => {
    if (!editingGame) return;

    const scoreANum = parseInt(scoreA) || 0;
    const scoreBNum = parseInt(scoreB) || 0;

    if (scoreANum === scoreBNum) {
      alert('Games cannot end in a tie. Please enter different scores.');
      return;
    }

    setSaving(true);
    try {
      const winner: 'A' | 'B' = scoreANum > scoreBNum ? 'A' : 'B';

      const { error } = await supabase
        .from('games')
        .update({
          score_a: scoreANum,
          score_b: scoreBNum,
          match_winner: winner,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', editingGame.id);

      if (error) throw error;

      setEditingGame(null);
      await fetchSchedule();
      onGameUpdated?.();
    } catch (error) {
      console.error('Error saving score:', error);
      alert('Failed to save score');
    } finally {
      setSaving(false);
    }
  };

  // Group games by week
  const gamesByWeek = games.reduce((acc, game) => {
    const week = game.week_number || 1;
    if (!acc[week]) acc[week] = [];
    acc[week].push(game);
    return acc;
  }, {} as Record<number, ScheduledGame[]>);

  const weeks = Object.keys(gamesByWeek).map(Number).sort((a, b) => a - b);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-rally-coral"></div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="card-glass p-8 text-center">
        <p className="text-gray-400">No schedule generated yet.</p>
      </div>
    );
  }

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
              <span>Download Schedule</span>
            </>
          )}
        </button>
      </div>

      {/* Schedule Content */}
      <div ref={scheduleRef} className="p-6 bg-rally-darker rounded-xl">
        {/* Header */}
        <div className="text-center mb-8 pb-4 border-b border-white/10">
          <h2 className="text-2xl font-bold text-gray-100">{tournament.name}</h2>
          <p className="text-gray-400 text-sm mt-1">
            Season Schedule • {weeks.length} Weeks • {games.length} Games
          </p>
        </div>

        {/* Schedule by Week */}
        <div className="space-y-6">
          {weeks.map(week => {
            const weekGames = gamesByWeek[week];
            const weekDate = weekGames[0]?.scheduled_date;

            return (
              <div key={week} className="border border-white/10 rounded-xl overflow-hidden">
                {/* Week Header */}
                <div className="bg-rally-dark/50 px-4 py-3 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-100">Week {week}</h3>
                    {weekDate && (
                      <span className="text-sm text-gray-400">
                        {new Date(weekDate).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Games */}
                <div className="divide-y divide-white/5">
                  {weekGames.map(game => {
                    const canEdit = game.status !== 'completed';
                    return (
                      <div
                        key={game.id}
                        onClick={() => canEdit && handleEditGame(game)}
                        className={`px-4 py-3 flex items-center gap-4 transition-colors ${
                          game.status === 'completed'
                            ? 'bg-rally-dark/20'
                            : 'hover:bg-rally-dark/30 cursor-pointer'
                        }`}
                      >
                        {/* Time & Court */}
                        <div className="w-24 flex-shrink-0">
                          {game.scheduled_time && (
                            <div className="text-sm font-medium text-rally-coral">
                              {formatTime(game.scheduled_time)}
                            </div>
                          )}
                          <div className="text-xs text-gray-500">Court {game.court_number}</div>
                        </div>

                        {/* Matchup */}
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex-1 text-right">
                            <span className={`font-medium ${
                              game.match_winner === 'A' ? 'text-green-400' : 'text-gray-200'
                            }`}>
                              {getTeamName(game.team_a_id)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 min-w-[80px] justify-center">
                            {game.status === 'completed' ? (
                              <span className="font-bold text-gray-100">
                                {game.score_a} - {game.score_b}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-500">vs</span>
                            )}
                          </div>

                          <div className="flex-1">
                            <span className={`font-medium ${
                              game.match_winner === 'B' ? 'text-green-400' : 'text-gray-200'
                            }`}>
                              {getTeamName(game.team_b_id)}
                            </span>
                          </div>
                        </div>

                        {/* Status */}
                        <div className="w-20 text-right">
                          {game.status === 'completed' ? (
                            <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                              Final
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs bg-rally-coral/20 text-rally-coral rounded">
                              Enter Score
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-white/10 text-center text-xs text-gray-500">
          Generated by Rally • {new Date().toLocaleDateString()}
        </div>
      </div>

      {/* Score Entry Modal */}
      {editingGame && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-rally-dark rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h3 className="text-xl font-bold text-gray-100 mb-2 text-center">Enter Score</h3>
            <p className="text-sm text-gray-400 text-center mb-6">
              Week {editingGame.week_number} • {editingGame.scheduled_time && formatTime(editingGame.scheduled_time)}
            </p>

            <div className="space-y-4">
              {/* Team A */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {getTeamName(editingGame.team_a_id)}
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
                    {getTeamName(editingGame.team_b_id)}
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
                  Winner: {parseInt(scoreA) > parseInt(scoreB) ? getTeamName(editingGame.team_a_id) : getTeamName(editingGame.team_b_id)}
                </span>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingGame(null)}
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
