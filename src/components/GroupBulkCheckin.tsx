import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Player, PlayerGroup, PlayerGroupMember, SessionCheckin } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface GroupBulkCheckinProps {
  sessionId: string;
  existingCheckins: SessionCheckin[];
  onCheckinComplete: () => void;
}

interface GroupWithMembers extends PlayerGroup {
  members: (PlayerGroupMember & { player: Player })[];
}

export default function GroupBulkCheckin({
  sessionId,
  existingCheckins,
  onCheckinComplete,
}: GroupBulkCheckinProps) {
  const { player: currentPlayer } = useAuth();
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, [currentPlayer]);

  const fetchGroups = async () => {
    if (!currentPlayer) return;

    try {
      // Fetch all groups (admins can see all, others see their own)
      const query = supabase
        .from('player_groups')
        .select('*')
        .order('name');

      // If not admin, only show groups created by the current player
      // or groups they are a member of
      if (!currentPlayer.is_admin) {
        query.eq('created_by', currentPlayer.id);
      }

      const { data: groupsData, error: groupsError } = await query;

      if (groupsError) throw groupsError;

      // Fetch members for each group
      const groupsWithMembers = await Promise.all(
        (groupsData || []).map(async (group) => {
          const { data: members } = await supabase
            .from('player_group_members')
            .select('*, player:players(*)')
            .eq('group_id', group.id);

          return {
            ...group,
            members: (members || []) as (PlayerGroupMember & { player: Player })[],
          };
        })
      );

      setGroups(groupsWithMembers);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkedInPlayerIds = new Set(existingCheckins.map((c) => c.player_id));

  const getGroupCheckinStatus = (group: GroupWithMembers) => {
    const total = group.members.length;
    const checkedIn = group.members.filter((m) => checkedInPlayerIds.has(m.player_id)).length;
    return { total, checkedIn, allCheckedIn: checkedIn === total };
  };

  const handleBulkCheckin = async (group: GroupWithMembers) => {
    setCheckingIn(group.id);

    try {
      // Get members who are not yet checked in
      const membersToCheckin = group.members.filter(
        (m) => !checkedInPlayerIds.has(m.player_id)
      );

      if (membersToCheckin.length === 0) {
        alert('All group members are already checked in!');
        setCheckingIn(null);
        return;
      }

      // Bulk insert check-ins
      const checkinInserts = membersToCheckin.map((m) => ({
        session_id: sessionId,
        player_id: m.player_id,
      }));

      const { error } = await supabase.from('session_checkins').insert(checkinInserts);

      if (error) {
        // Handle potential duplicates gracefully
        if (error.code === '23505') {
          alert('Some players were already checked in');
        } else {
          throw error;
        }
      }

      onCheckinComplete();
    } catch (error: any) {
      console.error('Error bulk checking in:', error);
      alert('Failed to check in group: ' + error.message);
    } finally {
      setCheckingIn(null);
    }
  };

  if (loading) {
    return (
      <div className="card-glass p-4">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-rally-coral"></div>
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return null; // Don't show if no groups exist
  }

  return (
    <div className="card-glass p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-100">Group Check-in</h3>
            <p className="text-sm text-gray-400">{groups.length} group{groups.length !== 1 ? 's' : ''} available</p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {groups.map((group) => {
            const status = getGroupCheckinStatus(group);
            const isCheckingIn = checkingIn === group.id;

            return (
              <div
                key={group.id}
                className={`p-4 rounded-xl border transition-all ${
                  status.allCheckedIn
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-rally-dark/50 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-100">{group.name}</h4>
                    <p className="text-sm text-gray-400">
                      {status.checkedIn}/{status.total} checked in
                    </p>
                  </div>
                  {!status.allCheckedIn && (
                    <button
                      onClick={() => handleBulkCheckin(group)}
                      disabled={isCheckingIn}
                      className="px-4 py-2 bg-gradient-rally rounded-lg text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {isCheckingIn ? (
                        <span className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                          Checking in...
                        </span>
                      ) : (
                        `Check in ${status.total - status.checkedIn} member${status.total - status.checkedIn !== 1 ? 's' : ''}`
                      )}
                    </button>
                  )}
                  {status.allCheckedIn && (
                    <span className="px-3 py-1.5 bg-green-500/20 rounded-lg text-green-400 text-sm font-medium">
                      All checked in
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {group.members.map((member) => {
                    const isCheckedIn = checkedInPlayerIds.has(member.player_id);
                    return (
                      <div
                        key={member.id}
                        className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${
                          isCheckedIn
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-rally-dark text-gray-300'
                        }`}
                      >
                        {isCheckedIn && (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                        <span>{member.player.name}</span>
                        <span className="text-xs opacity-70">{member.player.rating}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
