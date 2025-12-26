import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PlayerVenueFollow } from '../types';

interface VenueFollowButtonProps {
  venueId: string;
  venueName: string;
  compact?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
}

export default function VenueFollowButton({
  venueId,
  venueName,
  compact = false,
  onFollowChange,
}: VenueFollowButtonProps) {
  const { player } = useAuth();
  const [followStatus, setFollowStatus] = useState<PlayerVenueFollow | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (player?.id) {
      fetchFollowStatus();
    } else {
      setLoading(false);
    }
  }, [player?.id, venueId]);

  const fetchFollowStatus = async () => {
    if (!player?.id) return;

    try {
      const { data, error } = await supabase
        .from('player_venue_follows')
        .select('*')
        .eq('player_id', player.id)
        .eq('venue_id', venueId)
        .maybeSingle();

      if (error) throw error;
      setFollowStatus(data);
    } catch (error) {
      console.error('Error fetching follow status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!player?.id || updating) return;

    setUpdating(true);
    try {
      if (followStatus) {
        // Only allow unfollowing explicit follows
        if (followStatus.follow_type === 'explicit') {
          const { error } = await supabase
            .from('player_venue_follows')
            .delete()
            .eq('id', followStatus.id);

          if (error) throw error;
          setFollowStatus(null);
          onFollowChange?.(false);
        }
      } else {
        // Create new explicit follow
        const { data, error } = await supabase
          .from('player_venue_follows')
          .insert({
            player_id: player.id,
            venue_id: venueId,
            follow_type: 'explicit',
          })
          .select()
          .single();

        if (error) throw error;
        setFollowStatus(data);
        onFollowChange?.(true);
      }
    } catch (error) {
      console.error('Error updating follow status:', error);
    } finally {
      setUpdating(false);
    }
  };

  if (!player) {
    return null;
  }

  if (loading) {
    return (
      <div className={`${compact ? 'w-6 h-6' : 'px-3 py-1.5'} animate-pulse bg-gray-700/50 rounded-lg`} />
    );
  }

  const isFollowing = !!followStatus;
  const isAutoFollow = followStatus?.follow_type === 'auto';

  if (compact) {
    return (
      <button
        onClick={handleToggleFollow}
        disabled={updating}
        className={`p-1.5 rounded-lg transition-all ${
          isFollowing
            ? 'text-rally-coral hover:text-rally-coral/80'
            : 'text-gray-400 hover:text-rally-coral'
        } ${updating ? 'opacity-50' : ''}`}
        title={
          isFollowing
            ? isAutoFollow
              ? `Following ${venueName} (auto-tracked from check-in)`
              : `Following ${venueName}`
            : `Follow ${venueName}`
        }
      >
        <svg
          className="w-5 h-5"
          fill={isFollowing ? 'currentColor' : 'none'}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={handleToggleFollow}
      disabled={updating}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
        isFollowing
          ? 'bg-rally-coral/20 text-rally-coral border border-rally-coral/30 hover:bg-rally-coral/30'
          : 'bg-gray-700/50 text-gray-300 border border-gray-600/30 hover:border-rally-coral/30 hover:text-rally-coral'
      } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <svg
        className="w-4 h-4"
        fill={isFollowing ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
      <span>
        {updating
          ? 'Updating...'
          : isFollowing
          ? isAutoFollow
            ? 'Following'
            : 'Following'
          : 'Follow'}
      </span>
      {isAutoFollow && isFollowing && (
        <span className="text-xs opacity-60">(auto)</span>
      )}
    </button>
  );
}
