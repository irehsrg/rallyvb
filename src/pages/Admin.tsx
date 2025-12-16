import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Session as SessionType, SessionCheckin, Player, Game } from '../types';
import { generateTeams } from '../utils/teams';
import { calculateBalanceScore, calculateEloChange } from '../utils/elo';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

export default function Admin() {
  const { player } = useAuth();
  const navigate = useNavigate();
  const [activeSession, setActiveSession] = useState<SessionType | null>(null);
  const [checkins, setCheckins] = useState<(SessionCheckin & { player: Player })[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [courtCount, setCourtCount] = useState(2);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [locationName, setLocationName] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);

  useEffect(() => {
    if (!player?.is_admin) {
      navigate('/');
      return;
    }
    fetchActiveSession();
  }, [player, navigate]);

  const fetchActiveSession = async () => {
    try {
      const { data: session } = await supabase
        .from('sessions')
        .select('*')
        .in('status', ['setup', 'active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setActiveSession(session);

      if (session) {
        await fetchCheckins(session.id);
        await fetchGames(session.id);
      }
    } catch (error) {
      console.error('Error fetching session:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCheckins = async (sessionId: string) => {
    const { data, error } = await supabase
      .from('session_checkins')
      .select('*, player:players(*)')
      .eq('session_id', sessionId);

    if (error) {
      console.error('Error fetching checkins:', error);
      return;
    }
    setCheckins(data || []);
  };

  const fetchGames = async (sessionId: string) => {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('session_id', sessionId)
      .order('court_number');

    if (error) {
      console.error('Error fetching games:', error);
      return;
    }
    setGames(data || []);
  };

  const handleCreateSession = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          date: sessionDate,
          status: 'setup',
          court_count: courtCount,
          created_by: player?.id,
          location_name: locationName || null,
        })
        .select()
        .single();

      if (error) throw error;
      setActiveSession(data);
      alert(`Session created successfully for ${new Date(sessionDate).toLocaleDateString()}!`);
      setSessionDate(new Date().toISOString().split('T')[0]); // Reset to today
      setLocationName('');
    } catch (error: any) {
      console.error('Error creating session:', error);
      alert('Failed to create session: ' + error.message);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;

    if (!confirm('Are you sure you want to end this session? All incomplete games will remain as-is.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', activeSession.id);

      if (error) throw error;

      alert('Session ended successfully!');
      setActiveSession(null);
      setCheckins([]);
      setGames([]);
    } catch (error: any) {
      console.error('Error ending session:', error);
      alert('Failed to end session: ' + error.message);
    }
  };

  const handleGenerateTeams = async () => {
    if (!activeSession || checkins.length < 4) {
      alert('Need at least 4 players to generate teams');
      return;
    }

    try {
      const players = checkins.map(c => c.player);
      const teams = generateTeams(players, activeSession.court_count, 6);

      for (const assignment of teams) {
        const { data: game, error: gameError } = await supabase
          .from('games')
          .insert({
            session_id: activeSession.id,
            court_number: assignment.courtNumber,
            status: 'pending',
          })
          .select()
          .single();

        if (gameError) throw gameError;

        const gamePlayerInserts: any[] = [];

        assignment.teamA.forEach(player => {
          gamePlayerInserts.push({
            game_id: game.id,
            player_id: player.id,
            team: 'A',
            rating_before: player.rating,
          });
        });

        assignment.teamB.forEach(player => {
          gamePlayerInserts.push({
            game_id: game.id,
            player_id: player.id,
            team: 'B',
            rating_before: player.rating,
          });
        });

        const { error: playersError } = await supabase
          .from('game_players')
          .insert(gamePlayerInserts);

        if (playersError) throw playersError;
      }

      await supabase
        .from('sessions')
        .update({ status: 'active' })
        .eq('id', activeSession.id);

      alert('Teams generated successfully!');
      await fetchActiveSession();
    } catch (error: any) {
      console.error('Error generating teams:', error);
      alert('Failed to generate teams: ' + error.message);
    }
  };

  const handleRecordResult = async (gameId: string, scoreA: number, scoreB: number) => {
    const winner = scoreA > scoreB ? 'A' : 'B';

    try {
      const { data: gamePlayers, error: fetchError } = await supabase
        .from('game_players')
        .select('*, player:players(*)')
        .eq('game_id', gameId);

      if (fetchError) throw fetchError;

      const teamA = gamePlayers.filter(gp => gp.team === 'A');
      const teamB = gamePlayers.filter(gp => gp.team === 'B');

      const avgA = teamA.reduce((sum, gp) => sum + gp.rating_before, 0) / teamA.length;
      const avgB = teamB.reduce((sum, gp) => sum + gp.rating_before, 0) / teamB.length;

      for (const gp of gamePlayers) {
        const isTeamA = gp.team === 'A';
        const won = (winner === 'A' && isTeamA) || (winner === 'B' && !isTeamA);
        const teamAvg = isTeamA ? avgA : avgB;
        const oppAvg = isTeamA ? avgB : avgA;

        const change = calculateEloChange(teamAvg, oppAvg, won);
        const newRating = gp.rating_before + change;

        await supabase
          .from('game_players')
          .update({ rating_after: newRating, rating_change: change })
          .eq('id', gp.id);

        const newWins = won ? gp.player.wins + 1 : gp.player.wins;
        const newLosses = won ? gp.player.losses : gp.player.losses + 1;
        const newStreak = won ? gp.player.win_streak + 1 : 0;
        const bestStreak = Math.max(newStreak, gp.player.best_win_streak);

        await supabase
          .from('players')
          .update({
            rating: newRating,
            games_played: gp.player.games_played + 1,
            wins: newWins,
            losses: newLosses,
            win_streak: newStreak,
            best_win_streak: bestStreak,
            last_played_at: new Date().toISOString(),
          })
          .eq('id', gp.player_id);

        await supabase.from('rating_history').insert({
          player_id: gp.player_id,
          game_id: gameId,
          previous_rating: gp.rating_before,
          new_rating: newRating,
          change: change,
        });
      }

      await supabase
        .from('games')
        .update({
          score_a: scoreA,
          score_b: scoreB,
          winner,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', gameId);

      alert('Result recorded successfully!');
      await fetchActiveSession();
    } catch (error: any) {
      console.error('Error recording result:', error);
      alert('Failed to record result: ' + error.message);
    }
  };

  if (!player?.is_admin) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-rally-coral"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rally-darker">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-rally flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-gray-100">Admin Dashboard</h1>
          </div>
          <p className="text-gray-400">Manage sessions, teams, and game results</p>
        </div>

        {/* Create Session */}
        {!activeSession && (
          <div className="card-glass p-8 mb-8 animate-slide-up">
            <h2 className="text-2xl font-bold text-gray-100 mb-6">Create New Session</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Session Date
                </label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="input-modern w-full"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Number of Courts
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={courtCount}
                  onChange={(e) => setCourtCount(parseInt(e.target.value))}
                  className="input-modern w-full"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Location / Gym Name <span className="text-gray-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="input-modern w-full"
                  placeholder="e.g. Downtown Gym, Venice Beach Courts"
                />
              </div>
            </div>
            <button onClick={handleCreateSession} className="btn-primary w-full">
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Session
              </span>
            </button>
          </div>
        )}

        {/* Active Session */}
        {activeSession && (
          <>
            <div className="card-glass p-8 mb-8 animate-slide-up">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-100 mb-2">Current Session</h2>
                  <div className="flex flex-wrap items-center gap-4 text-gray-400">
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {new Date(activeSession.date).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {activeSession.court_count} courts
                    </span>
                    {activeSession.location_name && (
                      <span className="flex items-center gap-2 text-rally-coral">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        {activeSession.location_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-4 py-2 rounded-xl text-sm font-bold ${
                    activeSession.status === 'setup'
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      : 'bg-green-500/20 text-green-400 border border-green-500/30'
                  }`}>
                    {activeSession.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <button
                  onClick={() => setShowQRCode(true)}
                  className="flex-1 px-4 py-3 bg-rally-dark/50 hover:bg-rally-dark border border-white/10 hover:border-rally-coral/30 text-gray-100 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Guest Check-in QR Code
                </button>
                <button
                  onClick={handleEndSession}
                  className="flex-1 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 hover:border-red-500/50 text-red-400 rounded-xl transition-all flex items-center justify-center gap-2 font-semibold"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  End Session
                </button>
              </div>

              {/* Checked-in Players */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-rally-coral" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                  Checked-in Players ({checkins.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {checkins.map(checkin => (
                    <div key={checkin.id} className="bg-rally-dark/50 p-3 rounded-xl border border-white/10">
                      <div className="font-medium text-gray-100 text-sm truncate">{checkin.player.name}</div>
                      <div className="text-xs text-rally-coral font-semibold mt-1">
                        {checkin.player.rating}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {activeSession.status === 'setup' && (
                <button
                  onClick={handleGenerateTeams}
                  disabled={checkins.length < 4}
                  className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Generate Teams
                  </span>
                </button>
              )}
            </div>

            {/* Games */}
            {games.length > 0 && (
              <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <h2 className="text-2xl font-bold text-gray-100 mb-4">Games</h2>
                {games.map(game => (
                  <GameCard
                    key={game.id}
                    game={game}
                    onRecordResult={handleRecordResult}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* QR Code Modal */}
        {showQRCode && activeSession && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="card-glass max-w-md w-full p-8 animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-100">Guest Check-in QR Code</h2>
                <button
                  onClick={() => setShowQRCode(false)}
                  className="w-8 h-8 rounded-lg bg-rally-dark/50 hover:bg-rally-dark flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="bg-white p-6 rounded-2xl mb-6">
                <QRCodeSVG
                  value={`${window.location.origin}/guest-checkin/${activeSession.id}`}
                  size={256}
                  level="H"
                  includeMargin={true}
                  className="w-full h-auto"
                />
              </div>

              <div className="text-center">
                <p className="text-gray-300 mb-2 font-medium">
                  Scan to check in as a guest
                </p>
                <p className="text-sm text-gray-500">
                  Players can scan this code to check in without creating an account
                </p>
                {activeSession.location_name && (
                  <p className="text-sm text-rally-coral mt-3">
                    {activeSession.location_name}
                  </p>
                )}
              </div>

              <div className="mt-6 p-4 bg-rally-dark/50 rounded-xl">
                <p className="text-xs text-gray-400 text-center">
                  <strong className="text-gray-300">Note:</strong> Guest accounts are temporary and won't save rating history
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GameCard({
  game,
  onRecordResult,
}: {
  game: Game;
  onRecordResult: (gameId: string, scoreA: number, scoreB: number) => Promise<void>;
}) {
  const [teamA, setTeamA] = useState<Player[]>([]);
  const [teamB, setTeamB] = useState<Player[]>([]);
  const [scoreA, setScoreA] = useState(game.score_a || 0);
  const [scoreB, setScoreB] = useState(game.score_b || 0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeams();
  }, [game.id]);

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from('game_players')
      .select('*, player:players(*)')
      .eq('game_id', game.id);

    if (error) {
      console.error('Error fetching teams:', error);
      return;
    }

    setTeamA(data.filter(gp => gp.team === 'A').map(gp => gp.player));
    setTeamB(data.filter(gp => gp.team === 'B').map(gp => gp.player));
    setLoading(false);
  };

  const balance = teamA.length > 0 && teamB.length > 0 ? calculateBalanceScore(teamA, teamB) : null;

  const handleSubmit = async () => {
    if (scoreA === scoreB) {
      alert('Scores cannot be tied');
      return;
    }
    await onRecordResult(game.id, scoreA, scoreB);
  };

  if (loading) return <div className="card-glass p-6">Loading game...</div>;

  return (
    <div className="card-glass p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-100">Court {game.court_number}</h3>
        {balance && (
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
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Team A */}
        <div className="bg-rally-dark/50 rounded-xl p-4 border-2 border-blue-500/30">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-blue-400">Team A</h4>
            <span className="text-sm text-gray-400">Avg: {balance?.avgA.toFixed(0)}</span>
          </div>
          <ul className="space-y-2">
            {teamA.map(player => (
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
            <h4 className="font-bold text-red-400">Team B</h4>
            <span className="text-sm text-gray-400">Avg: {balance?.avgB.toFixed(0)}</span>
          </div>
          <ul className="space-y-2">
            {teamB.map(player => (
              <li key={player.id} className="flex justify-between text-sm">
                <span className="text-gray-300">{player.name}</span>
                <span className="text-gray-500 font-mono">{player.rating}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {game.status === 'completed' ? (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
          <svg className="w-6 h-6 mx-auto mb-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="font-semibold text-green-400">
            Final Score: {game.score_a} - {game.score_b}
          </p>
          <p className="text-sm text-green-400/70 mt-1">Team {game.winner} wins!</p>
        </div>
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
          <button
            onClick={handleSubmit}
            className="btn-primary px-6"
          >
            Record
          </button>
        </div>
      )}
    </div>
  );
}
