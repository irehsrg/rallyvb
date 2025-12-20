import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Session as SessionType, SessionCheckin, Player, Game, SessionTemplate, AdminActivityLog, Venue, SetScore } from '../types';
import { generateTeams } from '../utils/teams';
import { calculateBalanceScore, calculateEloChange } from '../utils/elo';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import TeamEditorModal from '../components/TeamEditorModal';
import VenuesManager from '../components/VenuesManager';
import AdminManager from '../components/AdminManager';
import TeamManager from '../components/TeamManager';
import TournamentManager from '../components/TournamentManager';
import { getAdminPermissions, getAdminRoleDisplayName } from '../utils/permissions';

export default function Admin() {
  const { player } = useAuth();
  const navigate = useNavigate();
  const permissions = getAdminPermissions(player);
  const [activeSession, setActiveSession] = useState<SessionType | null>(null);
  const [checkins, setCheckins] = useState<(SessionCheckin & { player: Player })[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [courtCount, setCourtCount] = useState(2);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [locationName, setLocationName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState<number | ''>('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [activityLogs, setActivityLogs] = useState<(AdminActivityLog & { admin?: Player })[]>([]);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [recurringWeeks, setRecurringWeeks] = useState(4);
  const [showTeamEditor, setShowTeamEditor] = useState(false);
  const [generatedGamesData, setGeneratedGamesData] = useState<Array<{
    id: string;
    court_number: number;
    team_a: Player[];
    team_b: Player[];
  }>>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');

  useEffect(() => {
    if (!player?.is_admin) {
      navigate('/');
      return;
    }
    autoCloseOldSessions();
    fetchActiveSession();
    fetchTemplates();
    fetchActivityLogs();
    fetchVenues();
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

  const fetchTemplates = async () => {
    if (!player?.id) return;

    try {
      const { data, error } = await supabase
        .from('session_templates')
        .select('*')
        .eq('admin_id', player.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_activity_log')
        .select('*, admin:players!admin_activity_log_admin_id_fkey(*)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setActivityLogs((data as any) || []);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    }
  };

  const fetchVenues = async () => {
    try {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setVenues(data || []);
    } catch (error) {
      console.error('Error fetching venues:', error);
    }
  };

  const autoCloseOldSessions = async () => {
    try {
      // Get the cutoff time: 3 AM today
      const now = new Date();
      const cutoffTime = new Date(now);
      cutoffTime.setHours(3, 0, 0, 0);

      // If it's currently before 3 AM, use 3 AM yesterday as cutoff
      if (now.getHours() < 3) {
        cutoffTime.setDate(cutoffTime.getDate() - 1);
      }

      // Find sessions that are still active/setup but were created before the cutoff
      const { data: oldSessions, error: fetchError } = await supabase
        .from('sessions')
        .select('*')
        .in('status', ['setup', 'active'])
        .lt('created_at', cutoffTime.toISOString());

      if (fetchError) throw fetchError;

      if (oldSessions && oldSessions.length > 0) {
        console.log(`Auto-closing ${oldSessions.length} old session(s)...`);

        // Close each old session
        for (const session of oldSessions) {
          const { error: updateError } = await supabase
            .from('sessions')
            .update({
              status: 'completed',
              completed_at: cutoffTime.toISOString(),
            })
            .eq('id', session.id);

          if (updateError) {
            console.error(`Error auto-closing session ${session.id}:`, updateError);
          } else {
            // Log the auto-close action
            await logAdminAction('auto_close_session', 'session', session.id, {
              reason: 'Automatically closed at 3 AM',
              original_date: session.date,
            });
          }
        }

        console.log('Old sessions auto-closed successfully');
      }
    } catch (error) {
      console.error('Error auto-closing old sessions:', error);
      // Don't show alert to user, just log it
    }
  };

  const logAdminAction = async (action: string, entityType: string, entityId: string, details?: any) => {
    if (!player?.id) return;

    try {
      await supabase
        .from('admin_activity_log')
        .insert({
          admin_id: player.id,
          action,
          entity_type: entityType,
          entity_id: entityId,
          details: details || null,
        });

      // Refresh logs after adding new one
      await fetchActivityLogs();
    } catch (error) {
      console.error('Error logging admin action:', error);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!player?.id || !templateName.trim()) return;

    try {
      const { error } = await supabase
        .from('session_templates')
        .insert({
          admin_id: player.id,
          name: templateName,
          court_count: courtCount,
          location_name: locationName || null,
          max_players: maxPlayers || null,
          notes: sessionNotes || null,
        });

      if (error) throw error;

      alert('Template saved successfully!');
      setShowTemplateModal(false);
      setTemplateName('');
      await fetchTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);
      alert('Failed to save template: ' + error.message);
    }
  };

  const handleLoadTemplate = (template: SessionTemplate) => {
    setCourtCount(template.court_count);
    setLocationName(template.location_name || '');
    setMaxPlayers(template.max_players || '');
    setSessionNotes(template.notes || '');
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('session_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      await fetchTemplates();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template: ' + error.message);
    }
  };

  const handleCreateSession = async () => {
    try {
      const { data, error} = await supabase
        .from('sessions')
        .insert({
          date: sessionDate,
          status: 'setup',
          court_count: courtCount,
          created_by: player?.id,
          venue_id: selectedVenueId || null,
          location_name: locationName || null, // Keep for backward compatibility
          max_players: maxPlayers || null,
          notes: sessionNotes || null,
        })
        .select()
        .single();

      if (error) throw error;
      setActiveSession(data);

      // Log admin action
      await logAdminAction('create_session', 'session', data.id, {
        date: sessionDate,
        court_count: courtCount,
        max_players: maxPlayers,
        venue_id: selectedVenueId,
      });

      alert(`Session created successfully for ${new Date(sessionDate).toLocaleDateString()}!`);
      setSessionDate(new Date().toISOString().split('T')[0]); // Reset to today
      setSelectedVenueId('');
      setLocationName('');
      setMaxPlayers('');
      setSessionNotes('');
    } catch (error: any) {
      console.error('Error creating session:', error);
      alert('Failed to create session: ' + error.message);
    }
  };

  const handleGenerateRecurringSessions = async () => {
    if (recurringDays.length === 0) {
      alert('Please select at least one day of the week');
      return;
    }

    try {
      const sessionsToCreate = [];
      const today = new Date();

      // Generate sessions for the next N weeks
      for (let week = 0; week < recurringWeeks; week++) {
        for (const dayOfWeek of recurringDays) {
          const sessionDate = new Date(today);
          sessionDate.setDate(today.getDate() + (week * 7) + ((dayOfWeek - today.getDay() + 7) % 7));

          // Skip if the date is in the past
          if (sessionDate < today) continue;

          sessionsToCreate.push({
            date: sessionDate.toISOString().split('T')[0],
            status: 'setup',
            court_count: courtCount,
            created_by: player?.id,
            location_name: locationName || null,
            max_players: maxPlayers || null,
            notes: sessionNotes || null,
          });
        }
      }

      if (sessionsToCreate.length === 0) {
        alert('No sessions to create');
        return;
      }

      const { error } = await supabase
        .from('sessions')
        .insert(sessionsToCreate);

      if (error) throw error;

      // Log admin action
      await logAdminAction('generate_recurring_sessions', 'sessions', 'bulk', {
        count: sessionsToCreate.length,
        days: recurringDays,
        weeks: recurringWeeks,
      });

      alert(`Successfully created ${sessionsToCreate.length} recurring sessions!`);
      setShowRecurringModal(false);
      setRecurringDays([]);
      await fetchActiveSession();
    } catch (error: any) {
      console.error('Error generating recurring sessions:', error);
      alert('Failed to generate recurring sessions: ' + error.message);
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

      // Log admin action
      await logAdminAction('end_session', 'session', activeSession.id, {
        date: activeSession.date,
        games_count: games.length,
      });

      alert('Session ended successfully!');
      setActiveSession(null);
      setCheckins([]);
      setGames([]);
    } catch (error: any) {
      console.error('Error ending session:', error);
      alert('Failed to end session: ' + error.message);
    }
  };

  const handleCancelSession = async () => {
    if (!activeSession || !cancellationReason.trim()) return;

    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: cancellationReason,
        })
        .eq('id', activeSession.id);

      if (error) throw error;

      // Log admin action
      await logAdminAction('cancel_session', 'session', activeSession.id, {
        reason: cancellationReason,
        date: activeSession.date,
      });

      alert('Session cancelled successfully!');
      setShowCancelModal(false);
      setCancellationReason('');
      setActiveSession(null);
      setCheckins([]);
      setGames([]);
    } catch (error: any) {
      console.error('Error cancelling session:', error);
      alert('Failed to cancel session: ' + error.message);
    }
  };

  const handleGenerateTeams = async () => {
    if (!activeSession || checkins.length < 4) {
      alert('Need at least 4 players to generate teams');
      return;
    }

    try {
      const players = checkins.map(c => c.player);

      // Calculate optimal team size based on player count and courts
      const playersPerCourt = Math.floor(players.length / activeSession.court_count);

      // Determine team size for each side (2-6 players)
      // For odd number of players per court, one team will have 1 extra
      let teamSize = Math.floor(playersPerCourt / 2);

      // Minimum 2v2, maximum 6v6
      if (teamSize < 2) teamSize = 2;
      if (teamSize > 6) teamSize = 6;

      // Show warning if teams will be uneven
      if (playersPerCourt % 2 !== 0) {
        const confirmation = confirm(
          `You have ${players.length} players for ${activeSession.court_count} court(s).\n` +
          `This will create ${playersPerCourt < 12 ? 'smaller teams' : 'teams'} with some uneven matchups (e.g., ${teamSize}v${teamSize + 1}).\n\n` +
          `Continue anyway?`
        );
        if (!confirmation) return;
      } else if (playersPerCourt < 12) {
        const confirmation = confirm(
          `You have ${players.length} players for ${activeSession.court_count} court(s).\n` +
          `This will create ${teamSize}v${teamSize} games.\n\n` +
          `Continue?`
        );
        if (!confirmation) return;
      }

      // Fetch group requests for this session
      const { data: groupRequests, error: groupError } = await supabase
        .from('session_group_requests')
        .select(`
          *,
          group:player_groups(
            *,
            members:player_group_members(
              *,
              player:players(*)
            )
          )
        `)
        .eq('session_id', activeSession.id)
        .eq('status', 'confirmed');

      if (groupError) {
        console.error('Error fetching groups:', groupError);
      }

      // Transform group requests into PlayerGroup format
      const playerGroups = (groupRequests || []).map((req: any) => ({
        id: req.group.id,
        members: req.group.members.map((m: any) => m.player),
      }));

      // Generate teams with dynamic team size and groups
      const teams = generateTeams(players, activeSession.court_count, teamSize, true, playerGroups);

      const gamesData: Array<{
        id: string;
        court_number: number;
        team_a: Player[];
        team_b: Player[];
      }> = [];

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

        // Store the game data for the editor
        gamesData.push({
          id: game.id,
          court_number: assignment.courtNumber,
          team_a: assignment.teamA,
          team_b: assignment.teamB,
        });
      }

      // Show the team editor modal
      setGeneratedGamesData(gamesData);
      setShowTeamEditor(true);
    } catch (error: any) {
      console.error('Error generating teams:', error);
      alert('Failed to generate teams: ' + error.message);
    }
  };

  const handleTeamEditorSave = async () => {
    if (!activeSession) return;

    try {
      // Update session status to active
      await supabase
        .from('sessions')
        .update({ status: 'active' })
        .eq('id', activeSession.id);

      // Log admin action
      await logAdminAction('generate_teams', 'session', activeSession.id, {
        courts: activeSession.court_count,
        players: checkins.length,
        games_created: generatedGamesData.length,
      });

      alert('Teams saved successfully!');
      setShowTeamEditor(false);
      setGeneratedGamesData([]);
      await fetchActiveSession();
    } catch (error: any) {
      console.error('Error saving teams:', error);
      alert('Failed to save teams: ' + error.message);
    }
  };

  const handleGenerateAdditionalGames = async () => {
    if (!activeSession || checkins.length < 4) {
      alert('Need at least 4 players to generate additional games');
      return;
    }

    try {
      // Get players who are already in active/pending games
      const { data: existingGamePlayers } = await supabase
        .from('game_players')
        .select('player_id, game:games!inner(status)')
        .in('game.status', ['pending', 'in_progress']);

      const busyPlayerIds = new Set(existingGamePlayers?.map(gp => gp.player_id) || []);

      // Get available players (checked in but not in active games)
      const availablePlayers = checkins
        .filter(c => !busyPlayerIds.has(c.player_id))
        .map(c => c.player);

      if (availablePlayers.length < 4) {
        alert(`Not enough available players. ${availablePlayers.length} available, need at least 4. ${busyPlayerIds.size} players are currently in games.`);
        return;
      }

      // Calculate how many courts we can fill with available players
      const playersPerCourt = 12; // 6v6
      const courtsToGenerate = Math.floor(availablePlayers.length / playersPerCourt);

      if (courtsToGenerate === 0) {
        alert(`Not enough players for a full court. Have ${availablePlayers.length}, need ${playersPerCourt}.`);
        return;
      }

      const teams = generateTeams(availablePlayers, courtsToGenerate, 6);

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

      // Log admin action
      await logAdminAction('generate_additional_games', 'session', activeSession.id, {
        courts: courtsToGenerate,
        available_players: availablePlayers.length,
        busy_players: busyPlayerIds.size,
        games_created: teams.length,
      });

      alert(`Generated ${teams.length} additional game(s) using ${availablePlayers.length} available players!`);
      await fetchActiveSession();
    } catch (error: any) {
      console.error('Error generating additional games:', error);
      alert('Failed to generate additional games: ' + error.message);
    }
  };

  const handleRecordResult = async (gameId: string, scoreA: number, scoreB: number, setScores?: SetScore[]) => {
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

      const gameUpdate: any = {
        score_a: scoreA,
        score_b: scoreB,
        winner,
        status: 'completed',
        completed_at: new Date().toISOString(),
      };

      // Add set scores and match_winner for tournament games
      if (setScores && setScores.length > 0) {
        gameUpdate.set_scores = setScores;
        gameUpdate.match_winner = winner;
      }

      await supabase
        .from('games')
        .update(gameUpdate)
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
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-4xl font-bold text-gray-100">Admin Dashboard</h1>
              {player?.admin_role && (
                <span
                  className={`px-3 py-1 text-sm rounded-lg border font-semibold ${
                    player.admin_role === 'super_admin'
                      ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                      : player.admin_role === 'location_admin'
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      : player.admin_role === 'team_manager'
                      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                      : 'bg-green-500/20 text-green-400 border-green-500/30'
                  }`}
                >
                  {getAdminRoleDisplayName(player.admin_role)}
                </span>
              )}
            </div>
          </div>
          <p className="text-gray-400">Manage sessions, teams, and game results</p>

          {/* Role Info for non-super admins */}
          {player?.admin_role && player.admin_role !== 'super_admin' && (
            <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div className="text-sm font-medium text-blue-400 mb-1">Limited Admin Access</div>
                  <div className="text-xs text-blue-300/80">
                    {player.admin_role === 'location_admin'
                      ? 'You can manage active sessions, teams, and game results. Contact a Super Admin for additional permissions.'
                      : player.admin_role === 'team_manager'
                      ? 'You can create and manage teams, add/remove players, and register for tournaments. Contact a Super Admin for additional permissions.'
                      : 'You can manage check-ins and record game scores. Contact a Super Admin for additional permissions.'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Create Session */}
        {!activeSession && permissions.canCreateSession && (
          <div className="card-glass p-8 mb-8 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-100">Create New Session</h2>
              {permissions.canCreateRecurringSessions && (
                <button
                  onClick={() => setShowRecurringModal(true)}
                  className="btn-secondary px-4 py-2 text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Generate Recurring
                </button>
              )}
            </div>

            {/* Load Template */}
            {templates.length > 0 && (
              <div className="mb-6 p-4 bg-rally-dark/50 rounded-xl">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Load from Template
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleLoadTemplate(template)}
                      className="flex items-center justify-between p-3 bg-rally-dark rounded-lg hover:bg-rally-dark/70 border border-rally-coral/30 hover:border-rally-coral transition-all text-left"
                    >
                      <span className="text-sm text-gray-100 font-medium truncate">{template.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(template.id);
                        }}
                        className="ml-2 text-gray-500 hover:text-red-400 transition-colors"
                        title="Delete template"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </button>
                  ))}
                </div>
              </div>
            )}

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
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Venue <span className="text-gray-500">(Optional)</span>
                </label>
                <select
                  value={selectedVenueId}
                  onChange={(e) => {
                    setSelectedVenueId(e.target.value);
                    // Clear custom location if venue is selected
                    if (e.target.value) setLocationName('');
                  }}
                  className="input-modern w-full"
                >
                  <option value="">Select a venue or enter custom location below</option>
                  {venues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name} - {venue.address}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Custom Location <span className="text-gray-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => {
                    setLocationName(e.target.value);
                    // Clear venue selection if custom location is entered
                    if (e.target.value) setSelectedVenueId('');
                  }}
                  className="input-modern w-full"
                  placeholder="e.g. Downtown Gym, Venice Beach Courts"
                  disabled={!!selectedVenueId}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use this for one-off locations not in the venue list
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Max Players <span className="text-gray-500">(Optional)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(e.target.value ? parseInt(e.target.value) : '')}
                  className="input-modern w-full"
                  placeholder="No limit"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Session Notes <span className="text-gray-500">(Optional)</span>
                </label>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  className="input-modern w-full"
                  rows={3}
                  placeholder="Any special instructions or information..."
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCreateSession} className="btn-primary flex-1">
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Session
                </span>
              </button>
              <button onClick={() => setShowTemplateModal(true)} className="btn-secondary">
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  Save as Template
                </span>
              </button>
            </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                <button
                  onClick={() => setShowQRCode(true)}
                  className="px-4 py-3 bg-rally-dark/50 hover:bg-rally-dark border border-white/10 hover:border-rally-coral/30 text-gray-100 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  QR Code
                </button>
                {permissions.canCancelSession && (
                  <>
                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="px-4 py-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 hover:border-orange-500/50 text-orange-400 rounded-xl transition-all flex items-center justify-center gap-2 font-semibold"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      Cancel Session
                    </button>
                    <button
                      onClick={handleEndSession}
                      className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 hover:border-red-500/50 text-red-400 rounded-xl transition-all flex items-center justify-center gap-2 font-semibold"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      End Session
                    </button>
                  </>
                )}
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

              {activeSession.status === 'setup' && permissions.canGenerateTeams && (
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

              {activeSession.status === 'active' && (
                <button
                  onClick={handleGenerateAdditionalGames}
                  disabled={checkins.length < 4}
                  className="w-full px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 hover:border-blue-500/50 text-blue-400 rounded-xl transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Generate Additional Games
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

        {/* Cancel Session Modal */}
        {showCancelModal && activeSession && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="card-glass p-8 max-w-md w-full animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-100">Cancel Session</h3>
                <button
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancellationReason('');
                  }}
                  className="text-gray-400 hover:text-gray-100 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm text-orange-400 font-medium">
                      This will cancel the session and notify all checked-in players.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cancellation Reason <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="input-modern w-full"
                  rows={4}
                  placeholder="e.g. Bad weather, court unavailable, not enough players..."
                  autoFocus
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {cancellationReason.length} / 500 characters
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancellationReason('');
                  }}
                  className="btn-secondary flex-1"
                >
                  Keep Session
                </button>
                <button
                  onClick={handleCancelSession}
                  className="flex-1 px-4 py-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 hover:border-orange-500/50 text-orange-400 rounded-xl transition-all font-semibold"
                  disabled={!cancellationReason.trim()}
                >
                  Cancel Session
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Save Template Modal */}
        {showTemplateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="card-glass p-8 max-w-md w-full animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-100">Save as Template</h3>
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="text-gray-400 hover:text-gray-100 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="input-modern w-full"
                  placeholder="e.g. Monday Night Session"
                  autoFocus
                />
              </div>

              <div className="p-4 bg-rally-dark/50 rounded-xl mb-6">
                <p className="text-xs text-gray-400 mb-2">This template will save:</p>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• Courts: {courtCount}</li>
                  {locationName && <li>• Location: {locationName}</li>}
                  {maxPlayers && <li>• Max Players: {maxPlayers}</li>}
                  {sessionNotes && <li>• Notes: {sessionNotes}</li>}
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAsTemplate}
                  className="btn-primary flex-1"
                  disabled={!templateName.trim()}
                >
                  Save Template
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recurring Sessions Modal */}
        {showRecurringModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="card-glass p-8 max-w-lg w-full animate-slide-up">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Generate Recurring Sessions
                </h3>
                <button
                  onClick={() => setShowRecurringModal(false)}
                  className="text-gray-400 hover:text-gray-100 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Days of Week */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Select Days of Week
                  </label>
                  <div className="grid grid-cols-7 gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          if (recurringDays.includes(index)) {
                            setRecurringDays(recurringDays.filter(d => d !== index));
                          } else {
                            setRecurringDays([...recurringDays, index].sort());
                          }
                        }}
                        className={`p-2 rounded-lg text-xs font-medium transition-all ${
                          recurringDays.includes(index)
                            ? 'bg-gradient-rally text-white'
                            : 'bg-rally-dark text-gray-400 hover:bg-rally-light'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Number of Weeks */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Number of Weeks
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={recurringWeeks}
                    onChange={(e) => setRecurringWeeks(parseInt(e.target.value) || 1)}
                    className="input-modern w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Sessions will be created for the next {recurringWeeks} week{recurringWeeks !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Preview */}
                {recurringDays.length > 0 && (
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                    <p className="text-sm text-blue-400 font-medium mb-2">
                      Will create approximately {recurringDays.length * recurringWeeks} sessions
                    </p>
                    <p className="text-xs text-gray-400">
                      Sessions will use current court count ({courtCount}), location, and settings
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowRecurringModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateRecurringSessions}
                  className="btn-primary flex-1"
                  disabled={recurringDays.length === 0}
                >
                  Generate Sessions
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Admin Management */}
        {permissions.canManageAdmins && (
          <div className="mt-8 animate-slide-up">
            <AdminManager />
          </div>
        )}

        {/* Venues Management */}
        {permissions.canManageVenues && (
          <div className="mt-8 animate-slide-up">
            <VenuesManager />
          </div>
        )}

        {/* Team Management */}
        {(permissions.canCreateTeams || permissions.canManageOwnTeams || permissions.canManageAllTeams) && (
          <div className="mt-8 animate-slide-up">
            <TeamManager />
          </div>
        )}

        {/* Tournament Management */}
        {(permissions.canCreateTournaments || permissions.canManageTournaments) && (
          <div className="mt-8 animate-slide-up">
            <TournamentManager />
          </div>
        )}

        {/* Admin Activity Log */}
        {permissions.canViewActivityLog && (
          <div className="card-glass p-8 mt-8 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Admin Activity Log
              </h2>
              <button
                onClick={() => setShowActivityLog(!showActivityLog)}
                className="btn-secondary px-4 py-2"
              >
                {showActivityLog ? 'Hide' : 'Show'} Logs
              </button>
            </div>

          {showActivityLog && (
            <div className="space-y-2">
              {activityLogs.length > 0 ? (
                activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-4 bg-rally-dark/50 rounded-xl hover:bg-rally-dark/70 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-gradient-rally flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">
                        {log.admin?.name.charAt(0).toUpperCase() || 'A'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-100">
                          {log.admin?.name || 'Unknown Admin'}
                        </span>
                        <span className="text-xs text-gray-600">•</span>
                        <span className="text-xs text-gray-500">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                          log.action.includes('create') ? 'bg-green-500/20 text-green-400' :
                          log.action.includes('delete') || log.action.includes('cancel') ? 'bg-red-500/20 text-red-400' :
                          log.action.includes('update') || log.action.includes('edit') ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {log.action.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {log.entity_type}: {log.entity_id.substring(0, 8)}...
                        </span>
                      </div>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="text-xs text-gray-600 mt-1">
                          {JSON.stringify(log.details, null, 2).substring(0, 100)}...
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h4 className="text-lg font-semibold text-gray-300 mb-2">No activity logs yet</h4>
                  <p className="text-gray-500">Admin actions will be logged here</p>
                </div>
              )}
            </div>
          )}
          </div>
        )}

        {/* Team Editor Modal */}
        {showTeamEditor && generatedGamesData.length > 0 && (
          <TeamEditorModal
            games={generatedGamesData}
            onClose={() => {
              setShowTeamEditor(false);
              setGeneratedGamesData([]);
            }}
            onSave={handleTeamEditorSave}
          />
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
  onRecordResult: (gameId: string, scoreA: number, scoreB: number, setScores?: SetScore[]) => Promise<void>;
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
