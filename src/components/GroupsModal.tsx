import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Player, PlayerGroup, PlayerGroupMember } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface GroupsModalProps {
  onClose: () => void;
  sessionId?: string; // If provided, allows requesting to play together in this session
}

export default function GroupsModal({ onClose, sessionId }: GroupsModalProps) {
  const { player: currentPlayer } = useAuth();
  const [myGroups, setMyGroups] = useState<(PlayerGroup & { members: (PlayerGroupMember & { player: Player })[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupRequested, setGroupRequested] = useState(false);

  useEffect(() => {
    fetchMyGroups();
  }, [currentPlayer]);

  const fetchMyGroups = async () => {
    if (!currentPlayer) return;

    try {
      // Fetch groups created by current player
      const { data: groups, error: groupsError } = await supabase
        .from('player_groups')
        .select('*')
        .eq('created_by', currentPlayer.id)
        .order('created_at', { ascending: false });

      if (groupsError) throw groupsError;

      // Fetch members for each group
      const groupsWithMembers = await Promise.all(
        (groups || []).map(async (group) => {
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

      setMyGroups(groupsWithMembers);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestGroupForSession = async (groupId: string) => {
    if (!sessionId) return;

    try {
      const { error } = await supabase
        .from('session_group_requests')
        .insert({
          session_id: sessionId,
          group_id: groupId,
          status: 'confirmed',
        });

      if (error) {
        if (error.code === '23505') {
          alert('This group has already been requested for this session');
        } else {
          throw error;
        }
      } else {
        setGroupRequested(true);
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (error) {
      console.error('Error requesting group:', error);
      alert('Failed to request group for session');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? All members will be removed.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('player_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      await fetchMyGroups();
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('Failed to delete group');
    }
  };

  if (groupRequested) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="card-glass p-8 max-w-md w-full text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-100 mb-2">Group Requested!</h2>
          <p className="text-gray-400">Your group will be kept together during team generation.</p>
        </div>
      </div>
    );
  }

  if (showCreateModal) {
    return <CreateGroupModal onClose={() => setShowCreateModal(false)} onSuccess={fetchMyGroups} />;
  }

  if (selectedGroup) {
    const group = myGroups.find(g => g.id === selectedGroup);
    if (group) {
      return <ManageGroupModal group={group} onClose={() => setSelectedGroup(null)} onUpdate={fetchMyGroups} />;
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="card-glass max-w-3xl w-full my-8">
        <div className="sticky top-0 bg-rally-dark/95 backdrop-blur-sm p-6 border-b border-white/10 z-10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-gray-100">My Groups</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-gray-400 text-sm">
            Create groups to play with friends on the same team
          </p>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-rally-coral mx-auto"></div>
            </div>
          ) : myGroups.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-300 mb-2">No groups yet</h3>
              <p className="text-gray-500 mb-6">Create a group to play with friends on the same team</p>
              <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                Create Your First Group
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <button onClick={() => setShowCreateModal(true)} className="btn-primary w-full">
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create New Group
                  </span>
                </button>
              </div>

              <div className="space-y-3">
                {myGroups.map((group) => (
                  <div key={group.id} className="card-glass p-5 hover:scale-[1.01] transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-100 mb-1">{group.name}</h3>
                        <p className="text-sm text-gray-400">{group.members.length} members</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedGroup(group.id)}
                          className="px-3 py-1.5 bg-rally-dark hover:bg-rally-light rounded-lg text-sm text-gray-300 transition-colors"
                        >
                          Manage
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
                          className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {group.members.map((member) => (
                        <div
                          key={member.id}
                          className="px-3 py-1.5 bg-rally-dark rounded-lg text-sm text-gray-300 flex items-center gap-2"
                        >
                          <span>{member.player.name}</span>
                          <span className="text-rally-coral font-semibold">{member.player.rating}</span>
                        </div>
                      ))}
                    </div>

                    {sessionId && (
                      <button
                        onClick={() => handleRequestGroupForSession(group.id)}
                        className="w-full btn-primary text-sm py-2"
                      >
                        Request for This Session
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateGroupModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { player: currentPlayer } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [creating, setCreating] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .ilike('name', `%${searchQuery}%`)
        .neq('id', currentPlayer?.id)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching players:', error);
    }
  };

  const handleAddPlayer = (player: Player) => {
    if (selectedPlayers.length >= 3) {
      alert('Groups can have a maximum of 4 players (including you)');
      return;
    }
    if (!selectedPlayers.find(p => p.id === player.id)) {
      setSelectedPlayers([...selectedPlayers, player]);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const handleRemovePlayer = (playerId: string) => {
    setSelectedPlayers(selectedPlayers.filter(p => p.id !== playerId));
  };

  const handleCreate = async () => {
    if (!currentPlayer || !groupName.trim()) {
      alert('Please enter a group name');
      return;
    }

    if (selectedPlayers.length === 0) {
      alert('Please add at least one other player to the group');
      return;
    }

    setCreating(true);
    try {
      // Create the group
      const { data: group, error: groupError } = await supabase
        .from('player_groups')
        .insert({
          name: groupName.trim(),
          created_by: currentPlayer.id,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add the creator as a member
      const membersToAdd = [
        { group_id: group.id, player_id: currentPlayer.id },
        ...selectedPlayers.map(p => ({ group_id: group.id, player_id: p.id })),
      ];

      const { error: membersError } = await supabase
        .from('player_group_members')
        .insert(membersToAdd);

      if (membersError) throw membersError;

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating group:', error);
      alert('Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card-glass p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-100">Create Group</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Group Name
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="input-modern w-full"
              placeholder="e.g. Monday Night Crew"
              maxLength={50}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Add Players (2-4 total including you)
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleSearch();
                }}
                className="input-modern w-full"
                placeholder="Search for players..."
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-rally-dark border border-white/10 rounded-xl max-h-48 overflow-y-auto z-10">
                  {searchResults.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => handleAddPlayer(player)}
                      className="w-full px-4 py-3 hover:bg-rally-light transition-colors text-left flex items-center justify-between"
                    >
                      <span className="text-gray-100">{player.name}</span>
                      <span className="text-sm text-rally-coral">{player.rating}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2 text-sm text-gray-400">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              <span>Selected Players ({selectedPlayers.length + 1}/4)</span>
            </div>
            <div className="space-y-2">
              {/* Show current player */}
              <div className="flex items-center justify-between p-3 bg-rally-dark/50 rounded-lg">
                <div>
                  <span className="text-gray-100">{currentPlayer?.name}</span>
                  <span className="ml-2 text-xs text-rally-coral bg-rally-coral/20 px-2 py-0.5 rounded">You</span>
                </div>
                <span className="text-sm text-rally-coral">{currentPlayer?.rating}</span>
              </div>

              {/* Show selected players */}
              {selectedPlayers.map((player) => (
                <div key={player.id} className="flex items-center justify-between p-3 bg-rally-dark/50 rounded-lg">
                  <span className="text-gray-100">{player.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-rally-coral">{player.rating}</span>
                    <button
                      onClick={() => handleRemovePlayer(player.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !groupName.trim() || selectedPlayers.length === 0}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ManageGroupModal({
  group,
  onClose,
  onUpdate,
}: {
  group: PlayerGroup & { members: (PlayerGroupMember & { player: Player })[] };
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const memberIds = group.members.map(m => m.player_id);
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .ilike('name', `%${searchQuery}%`)
        .not('id', 'in', `(${memberIds.join(',')})`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching players:', error);
    }
  };

  const handleAddMember = async (player: Player) => {
    if (group.members.length >= 4) {
      alert('Groups can have a maximum of 4 players');
      return;
    }

    try {
      const { error } = await supabase
        .from('player_group_members')
        .insert({
          group_id: group.id,
          player_id: player.id,
        });

      if (error) throw error;

      onUpdate();
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Failed to add member');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (group.members.length <= 2) {
      alert('Groups must have at least 2 members');
      return;
    }

    try {
      const { error } = await supabase
        .from('player_group_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      onUpdate();
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card-glass p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-100">{group.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Add More Players
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handleSearch();
                }}
                className="input-modern w-full"
                placeholder="Search for players..."
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-rally-dark border border-white/10 rounded-xl max-h-48 overflow-y-auto z-10">
                  {searchResults.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => handleAddMember(player)}
                      className="w-full px-4 py-3 hover:bg-rally-light transition-colors text-left flex items-center justify-between"
                    >
                      <span className="text-gray-100">{player.name}</span>
                      <span className="text-sm text-rally-coral">{player.rating}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2 text-sm text-gray-400">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              <span>Current Members ({group.members.length}/4)</span>
            </div>
            <div className="space-y-2">
              {group.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-rally-dark/50 rounded-lg">
                  <div>
                    <span className="text-gray-100">{member.player.name}</span>
                    {member.player_id === group.created_by && (
                      <span className="ml-2 text-xs text-rally-coral bg-rally-coral/20 px-2 py-0.5 rounded">
                        Creator
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-rally-coral">{member.player.rating}</span>
                    {member.player_id !== group.created_by && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button onClick={onClose} className="btn-primary w-full">
          Done
        </button>
      </div>
    </div>
  );
}
