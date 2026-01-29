import { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { supabase } from '../lib/supabase';
import { Tournament, Team } from '../types';

interface ScheduledGame {
  id: string;
  team_a_id: string;
  team_b_id: string;
  week_number: number;
  scheduled_date: string;
  match_round: string;
  status: string;
  score_a?: number;
  score_b?: number;
  match_winner?: 'A' | 'B';
}

interface TournamentScheduleProps {
  tournament: Tournament;
  teams: Team[];
}

export default function TournamentSchedule({ tournament, teams }: TournamentScheduleProps) {
  const scheduleRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [games, setGames] = useState<ScheduledGame[]>([]);
  const [loading, setLoading] = useState(true);

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
      const canvas = await html2canvas(scheduleRef.current, {
        backgroundColor: '#1a1a2e',
        scale: 2,
        logging: false,
        useCORS: true,
      });

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
                  {weekGames.map(game => (
                    <div
                      key={game.id}
                      className={`px-4 py-3 flex items-center justify-between ${
                        game.status === 'completed' ? 'bg-rally-dark/20' : ''
                      }`}
                    >
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

                      {game.status === 'completed' && (
                        <span className="ml-4 px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                          Final
                        </span>
                      )}
                    </div>
                  ))}
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
    </div>
  );
}
