import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Venue } from '../types';

interface VenueSelectorProps {
  selectedVenueId: string | null;
  onVenueChange: (venueId: string | null) => void;
  showAllOption?: boolean;
  showFollowedOnly?: boolean;
  label?: string;
  compact?: boolean;
}

interface VenueWithFollow extends Venue {
  isFollowed?: boolean;
  followType?: 'explicit' | 'auto';
}

export default function VenueSelector({
  selectedVenueId,
  onVenueChange,
  showAllOption = true,
  showFollowedOnly = false,
  label = 'Venue',
  compact = false,
}: VenueSelectorProps) {
  const { player } = useAuth();
  const [venues, setVenues] = useState<VenueWithFollow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchVenues();
  }, [player?.id]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchVenues = async () => {
    try {
      // Fetch all active venues
      const { data: venuesData, error: venuesError } = await supabase
        .from('venues')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (venuesError) throw venuesError;

      let venuesWithFollows: VenueWithFollow[] = venuesData || [];

      // If user is logged in, fetch their follows
      if (player?.id) {
        const { data: followsData } = await supabase
          .from('player_venue_follows')
          .select('venue_id, follow_type')
          .eq('player_id', player.id);

        const followsMap = new Map(
          followsData?.map(f => [f.venue_id, f.follow_type]) || []
        );

        venuesWithFollows = venuesData?.map(venue => ({
          ...venue,
          isFollowed: followsMap.has(venue.id),
          followType: followsMap.get(venue.id) as 'explicit' | 'auto' | undefined,
        })) || [];
      }

      // If showing followed only, filter the list
      if (showFollowedOnly && player?.id) {
        venuesWithFollows = venuesWithFollows.filter(v => v.isFollowed);
      }

      setVenues(venuesWithFollows);
    } catch (error) {
      console.error('Error fetching venues:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedVenue = venues.find(v => v.id === selectedVenueId);

  if (loading) {
    return (
      <div className="h-10 bg-gray-700/50 rounded-lg animate-pulse" />
    );
  }

  if (venues.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rally-dark/50 border border-white/10 hover:border-rally-coral/30 transition-all text-sm"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-gray-200 truncate max-w-[120px]">
            {selectedVenue?.name || 'All Venues'}
          </span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-2 w-64 bg-rally-dark border border-white/10 rounded-xl shadow-xl overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              {showAllOption && (
                <button
                  onClick={() => {
                    onVenueChange(null);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-3 ${
                    !selectedVenueId ? 'bg-rally-coral/10 text-rally-coral' : 'text-gray-300'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>All Venues</span>
                </button>
              )}
              {venues.map(venue => (
                <button
                  key={venue.id}
                  onClick={() => {
                    onVenueChange(venue.id);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-3 ${
                    selectedVenueId === venue.id ? 'bg-rally-coral/10 text-rally-coral' : 'text-gray-300'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <span className="block truncate">{venue.name}</span>
                    {venue.isFollowed && (
                      <span className="text-xs text-rally-coral opacity-60">
                        {venue.followType === 'auto' ? 'Auto-following' : 'Following'}
                      </span>
                    )}
                  </div>
                  {venue.isFollowed && (
                    <svg className="w-4 h-4 text-rally-coral" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-rally-dark/50 border-2 border-white/10 hover:border-rally-coral/30 transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-gray-200">
              {selectedVenue?.name || 'All Venues'}
            </span>
          </div>
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-2 w-full bg-rally-dark border border-white/10 rounded-xl shadow-xl overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              {showAllOption && (
                <button
                  onClick={() => {
                    onVenueChange(null);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-3 ${
                    !selectedVenueId ? 'bg-rally-coral/10 text-rally-coral' : 'text-gray-300'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>All Venues</span>
                </button>
              )}
              {venues.map(venue => (
                <button
                  key={venue.id}
                  onClick={() => {
                    onVenueChange(venue.id);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center gap-3 ${
                    selectedVenueId === venue.id ? 'bg-rally-coral/10 text-rally-coral' : 'text-gray-300'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <span className="block truncate">{venue.name}</span>
                    {venue.isFollowed && (
                      <span className="text-xs text-rally-coral opacity-60">
                        {venue.followType === 'auto' ? 'Auto-following' : 'Following'}
                      </span>
                    )}
                  </div>
                  {venue.isFollowed && (
                    <svg className="w-4 h-4 text-rally-coral" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
