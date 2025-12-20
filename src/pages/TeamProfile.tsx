import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Team, TeamMember, Player, TournamentGame } from '../types';

interface TeamMemberWithPlayer extends TeamMember {
  player: Player;
}

export default function TeamProfile() {
  const { teamId } = useParams<{ teamId: string }>();
  const { player: currentPlayer } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMemberWithPlayer[]>([]);
  const [matches, setMatches] = useState<TournamentGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    if (teamId) {
      fetchTeamData();
    }
  }, [teamId, currentPlayer]);

  const fetchTeamData = async () => {
    try {
      // Fetch team info
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (teamError) throw teamError;
      setTeam(teamData);

      // Fetch team members
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select(`
          *,
          player:players(*)
        `)
        .eq('team_id', teamId)
        .eq('is_active', true)
        .order('role', { ascending: false })
        .order('joined_at', { ascending: true });

      if (membersError) throw membersError;
      setMembers(membersData as TeamMemberWithPlayer[] || []);

      // Check if current player is a member or manager
      if (currentPlayer) {
        const membership = membersData?.find(m => m.player_id === currentPlayer.id);
        setIsMember(!!membership);
        setIsManager(membership?.role === 'manager');
      }

      // Fetch team matches (tournament games only, as pickup games don't have team entities)
      const { data: matchesData, error: matchesError} = await supabase
        .from('games')
        .select('*')
        .not('tournament_id', 'is', null)
        .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(10);

      if (matchesError) throw matchesError;
      setMatches(matchesData || []);
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestJoin = async () => {
    if (!currentPlayer || !team) return;

    try {
      // For now, just add them directly - in production you'd want a request system
      const { error } = await supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          player_id: currentPlayer.id,
          role: 'member',
          is_active: true,
        });

      if (error) throw error;

      alert('Successfully joined team!');
      await fetchTeamData();
    } catch (error: any) {
      console.error('Error joining team:', error);
      alert('Failed to join team: ' + error.message);
    }
  };

  const handleLeaveTeam = async () => {
    if (!currentPlayer || !team) return;

    if (!confirm('Are you sure you want to leave this team?')) return;

    try {
      const { error } = await supabase
        .from('team_members')
        .update({ is_active: false })
        .eq('team_id', team.id)
        .eq('player_id', currentPlayer.id);

      if (error) throw error;

      alert('Successfully left team');
      await fetchTeamData();
    } catch (error: any) {
      console.error('Error leaving team:', error);
      alert('Failed to leave team: ' + error.message);
    }
  };

  const getWinRate = () => {
    if (!team) return 0;
    const totalGames = team.wins + team.losses;
    if (totalGames === 0) return 0;
    return Math.round((team.wins / totalGames) * 100);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-rally-coral"></div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-rally-darker flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-100 mb-2">Team Not Found</h2>
          <Link to="/teams" className="text-rally-coral hover:underline">
            Back to Teams
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rally-darker">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link
          to="/teams"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-200 mb-6 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Teams
        </Link>

        {/* Team Header */}
        <div className="card-glass p-8 mb-8 animate-fade-in">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-6">
            {team.logo_url ? (
              <img
                src={team.logo_url}
                alt={team.name}
                className="w-24 h-24 rounded-2xl object-cover border-2 border-white/10"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-gradient-rally flex items-center justify-center">
                <span className="text-4xl font-bold text-white">
                  {team.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-100 mb-2">{team.name}</h1>
              {team.description && (
                <p className="text-gray-400 mb-4">{team.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                <span>Created {new Date(team.created_at).toLocaleDateString()}</span>
                <span>•</span>
                <span>{members.length} members</span>
                <span>•</span>
                <span>{team.tournaments_played} tournaments</span>
              </div>
            </div>

            {currentPlayer && !isMember && (
              <button
                onClick={handleRequestJoin}
                className="btn-primary whitespace-nowrap"
              >
                Join Team
              </button>
            )}

            {isMember && !isManager && (
              <button
                onClick={handleLeaveTeam}
                className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
              >
                Leave Team
              </button>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="text-3xl font-bold text-green-400">{team.wins}</div>
              <div className="text-sm text-gray-400 mt-1">Wins</div>
            </div>
            <div className="stat-card">
              <div className="text-3xl font-bold text-red-400">{team.losses}</div>
              <div className="text-sm text-gray-400 mt-1">Losses</div>
            </div>
            <div className="stat-card">
              <div className="text-3xl font-bold text-gradient-rally">{getWinRate()}%</div>
              <div className="text-sm text-gray-400 mt-1">Win Rate</div>
            </div>
            <div className="stat-card">
              <div className="text-3xl font-bold text-orange-400">{team.tournaments_played}</div>
              <div className="text-sm text-gray-400 mt-1">Tournaments</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Roster */}
          <div className="lg:col-span-2">
            <div className="card-glass p-6 animate-slide-up">
              <h2 className="text-2xl font-bold text-gray-100 mb-6">Roster</h2>

              {members.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No members yet</p>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 bg-rally-dark/50 rounded-xl hover:bg-rally-dark/70 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-rally flex items-center justify-center">
                          <span className="text-white font-bold">
                            {member.player.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-100">{member.player.name}</h3>
                            {member.role === 'manager' && (
                              <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded border border-purple-500/30">
                                Manager
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            Rating: {member.player.rating} • {member.player.games_played} games
                          </p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Matches */}
          <div>
            <div className="card-glass p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <h2 className="text-xl font-bold text-gray-100 mb-6">Recent Matches</h2>

              {matches.length === 0 ? (
                <p className="text-gray-400 text-center py-8 text-sm">No matches yet</p>
              ) : (
                <div className="space-y-3">
                  {matches.map((match) => {
                    const isTeamA = match.team_a_id === teamId;
                    const teamScore = isTeamA ? match.score_a : match.score_b;
                    const oppScore = isTeamA ? match.score_b : match.score_a;
                    const won = (isTeamA && match.winner === 'A') || (!isTeamA && match.winner === 'B');

                    return (
                      <div
                        key={match.id}
                        className={`p-3 rounded-lg border-2 ${
                          won
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-red-500/10 border-red-500/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-xs font-bold ${
                            won ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {won ? 'WIN' : 'LOSS'}
                          </span>
                          {match.completed_at && (
                            <span className="text-xs text-gray-500">
                              {new Date(match.completed_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="text-lg font-bold text-gray-100">
                          {teamScore} - {oppScore}
                        </div>
                        {match.tournament_id && (
                          <div className="text-xs text-purple-400 mt-1">Tournament Match</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
