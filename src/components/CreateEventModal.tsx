import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Venue, EventSkillLevel } from '../types';
import { notifyNewEvent } from '../utils/notifications';

interface CreateEventModalProps {
  onClose: () => void;
  onCreated: () => void;
  editEvent?: any; // For editing existing events
}

export default function CreateEventModal({ onClose, onCreated, editEvent }: CreateEventModalProps) {
  const { player } = useAuth();
  const [loading, setLoading] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);

  // Form state
  const [title, setTitle] = useState(editEvent?.title || '');
  const [description, setDescription] = useState(editEvent?.description || '');
  const [venueId, setVenueId] = useState(editEvent?.venue_id || '');
  const [customLocation, setCustomLocation] = useState(editEvent?.custom_location || '');
  const [customAddress, setCustomAddress] = useState(editEvent?.custom_address || '');
  const [googleMapsUrl, setGoogleMapsUrl] = useState(editEvent?.google_maps_url || '');
  const [eventDate, setEventDate] = useState(editEvent?.event_date || '');
  const [startTime, setStartTime] = useState(editEvent?.start_time || '');
  const [endTime, setEndTime] = useState(editEvent?.end_time || '');
  const [maxPlayers, setMaxPlayers] = useState<number | ''>(editEvent?.max_players || '');
  const [minPlayers, setMinPlayers] = useState(editEvent?.min_players || 4);
  const [skillLevel, setSkillLevel] = useState<EventSkillLevel>(editEvent?.skill_level || 'all_levels');
  const [isPublic, setIsPublic] = useState(editEvent?.is_public ?? true);
  const [allowComments, setAllowComments] = useState(editEvent?.allow_comments ?? true);
  const [useVenue, setUseVenue] = useState(!!editEvent?.venue_id);

  useEffect(() => {
    fetchVenues();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player) return;

    if (!title.trim()) {
      alert('Please enter an event title');
      return;
    }
    if (!eventDate) {
      alert('Please select a date');
      return;
    }
    if (!startTime) {
      alert('Please select a start time');
      return;
    }
    if (!useVenue && !customLocation.trim()) {
      alert('Please enter a location');
      return;
    }

    setLoading(true);
    try {
      const eventData = {
        host_id: player.id,
        title: title.trim(),
        description: description.trim() || null,
        venue_id: useVenue ? venueId || null : null,
        custom_location: !useVenue ? customLocation.trim() : null,
        custom_address: !useVenue ? customAddress.trim() || null : null,
        google_maps_url: !useVenue ? googleMapsUrl.trim() || null : null,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime || null,
        max_players: maxPlayers || null,
        min_players: minPlayers,
        skill_level: skillLevel,
        is_public: isPublic,
        allow_comments: allowComments,
        status: 'upcoming',
        updated_at: new Date().toISOString(),
      };

      if (editEvent) {
        const { error } = await supabase
          .from('open_sessions')
          .update(eventData)
          .eq('id', editEvent.id);

        if (error) throw error;
      } else {
        const { data: newEvent, error } = await supabase
          .from('open_sessions')
          .insert(eventData)
          .select('id')
          .single();

        if (error) throw error;

        // Send push notification for new public events
        if (isPublic && newEvent) {
          // Get venue name if using a venue
          let locationName = customLocation.trim() || 'TBD';
          if (useVenue && venueId) {
            const venue = venues.find(v => v.id === venueId);
            if (venue) locationName = venue.name;
          }

          notifyNewEvent({
            id: newEvent.id,
            title: title.trim(),
            event_date: eventDate,
            start_time: startTime,
            host_name: player.name,
            location: locationName,
          }).catch(err => console.error('Failed to send new event notification:', err));
        }
      }

      onCreated();
    } catch (error: any) {
      console.error('Error saving event:', error);
      alert('Failed to save event: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="card-glass p-6 sm:p-8 max-w-lg w-full my-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-100">
            {editEvent ? 'Edit Event' : 'Create Event'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Event Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Open Gym Volleyball"
              className="input-modern w-full"
              maxLength={100}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell players what to expect..."
              className="input-modern w-full"
              rows={3}
              maxLength={500}
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                min={today}
                className="input-modern w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Start Time <span className="text-red-400">*</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="input-modern w-full"
              />
            </div>
          </div>

          {/* End Time */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              End Time <span className="text-gray-500">(optional)</span>
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="input-modern w-full"
            />
          </div>

          {/* Location Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Location
            </label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setUseVenue(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  useVenue
                    ? 'bg-rally-coral text-white'
                    : 'bg-rally-dark/50 text-gray-400 hover:bg-rally-dark'
                }`}
              >
                Saved Venue
              </button>
              <button
                type="button"
                onClick={() => setUseVenue(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  !useVenue
                    ? 'bg-rally-coral text-white'
                    : 'bg-rally-dark/50 text-gray-400 hover:bg-rally-dark'
                }`}
              >
                Custom Location
              </button>
            </div>

            {useVenue ? (
              <select
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
                className="input-modern w-full"
              >
                <option value="">Select a venue...</option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder="Location name"
                  className="input-modern w-full"
                />
                <input
                  type="text"
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  placeholder="Address (optional)"
                  className="input-modern w-full"
                />
                <input
                  type="url"
                  value={googleMapsUrl}
                  onChange={(e) => setGoogleMapsUrl(e.target.value)}
                  placeholder="Google Maps URL (optional)"
                  className="input-modern w-full"
                />
              </div>
            )}
          </div>

          {/* Player Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Min Players
              </label>
              <input
                type="number"
                value={minPlayers}
                onChange={(e) => setMinPlayers(parseInt(e.target.value) || 4)}
                min={2}
                max={50}
                className="input-modern w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Players <span className="text-gray-500">(optional)</span>
              </label>
              <input
                type="number"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value ? parseInt(e.target.value) : '')}
                min={2}
                max={100}
                placeholder="No limit"
                className="input-modern w-full"
              />
            </div>
          </div>

          {/* Skill Level */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Skill Level
            </label>
            <select
              value={skillLevel}
              onChange={(e) => setSkillLevel(e.target.value as EventSkillLevel)}
              className="input-modern w-full"
            >
              <option value="all_levels">All Levels Welcome</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>

          {/* Settings */}
          <div className="space-y-4 pt-2">
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-gray-600 bg-rally-dark text-rally-coral focus:ring-rally-coral focus:ring-offset-0"
                />
                <span className="text-gray-300">Public event</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-8">
                {isPublic
                  ? "This event will appear in the public Events feed for all users to see and RSVP."
                  : "Only you can see this event. Useful for drafts or coordinating privately before publishing."}
              </p>
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowComments}
                  onChange={(e) => setAllowComments(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-gray-600 bg-rally-dark text-rally-coral focus:ring-rally-coral focus:ring-offset-0"
                />
                <span className="text-gray-300">Allow comments</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-8">
                Let players ask questions and discuss the event.
              </p>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {loading ? 'Saving...' : editEvent ? 'Update Event' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
