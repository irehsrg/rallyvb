import { useState, useEffect } from 'react';
import { supabase, logAdminAction } from '../lib/supabase';
import { Venue } from '../types';
import { useAuth } from '../contexts/AuthContext';

export default function VenuesManager() {
  const { player } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);

  useEffect(() => {
    fetchVenues();
  }, []);

  const fetchVenues = async () => {
    try {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .order('name');

      if (error) throw error;
      setVenues(data || []);
    } catch (error) {
      console.error('Error fetching venues:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (venue: Venue) => {
    try {
      const newActiveState = !venue.is_active;
      const { error } = await supabase
        .from('venues')
        .update({ is_active: newActiveState })
        .eq('id', venue.id);

      if (error) throw error;

      // Log the admin action
      if (player?.id) {
        await logAdminAction(player.id, newActiveState ? 'activate_venue' : 'deactivate_venue', 'venue', venue.id, {
          venue_name: venue.name,
        });
      }

      await fetchVenues();
    } catch (error) {
      console.error('Error toggling venue:', error);
      alert('Failed to update venue status');
    }
  };

  const handleDelete = async (venue: Venue) => {
    if (!confirm('Are you sure you want to delete this venue? Sessions using this venue will have their venue unset.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('venues')
        .delete()
        .eq('id', venue.id);

      if (error) throw error;

      // Log the admin action
      if (player?.id) {
        await logAdminAction(player.id, 'delete_venue', 'venue', venue.id, {
          venue_name: venue.name,
          venue_address: venue.address,
        });
      }

      await fetchVenues();
    } catch (error) {
      console.error('Error deleting venue:', error);
      alert('Failed to delete venue');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-rally-coral"></div>
      </div>
    );
  }

  return (
    <div className="card-glass p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Venues</h2>
          <p className="text-sm text-gray-400 mt-1">Manage locations where sessions are held</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
        >
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Venue
          </span>
        </button>
      </div>

      {venues.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-300 mb-2">No venues yet</h3>
          <p className="text-gray-500 mb-6">Add your first venue to get started</p>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            Add Venue
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {venues.map((venue) => (
            <div
              key={venue.id}
              className={`p-4 rounded-xl border-2 transition-all ${
                venue.is_active
                  ? 'bg-rally-dark/50 border-white/10 hover:border-rally-coral/30'
                  : 'bg-gray-800/30 border-gray-700/50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-gray-100 truncate">{venue.name}</h3>
                    {!venue.is_active && (
                      <span className="px-2 py-0.5 text-xs bg-gray-600/20 text-gray-400 rounded-lg border border-gray-600/30">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-gray-400 flex items-start gap-2">
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{venue.address}</span>
                    </div>
                    {venue.notes && (
                      <div className="text-sm text-gray-500 flex items-start gap-2">
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{venue.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {venue.google_maps_url && (
                    <a
                      href={venue.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 text-sm font-medium transition-all text-center"
                    >
                      Maps
                    </a>
                  )}
                  <button
                    onClick={() => setEditingVenue(venue)}
                    className="px-3 py-1.5 rounded-lg bg-rally-dark hover:bg-rally-light text-gray-300 text-sm transition-all"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(venue)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      venue.is_active
                        ? 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30'
                        : 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30'
                    }`}
                  >
                    {venue.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDelete(venue)}
                    className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showAddModal || editingVenue) && (
        <VenueFormModal
          venue={editingVenue}
          onClose={() => {
            setShowAddModal(false);
            setEditingVenue(null);
          }}
          onSuccess={() => {
            fetchVenues();
            setShowAddModal(false);
            setEditingVenue(null);
          }}
        />
      )}
    </div>
  );
}

interface VenueFormModalProps {
  venue: Venue | null;
  onClose: () => void;
  onSuccess: () => void;
}

function VenueFormModal({ venue, onClose, onSuccess }: VenueFormModalProps) {
  const { player } = useAuth();
  const [name, setName] = useState(venue?.name || '');
  const [address, setAddress] = useState(venue?.address || '');
  const [googleMapsUrl, setGoogleMapsUrl] = useState(venue?.google_maps_url || '');
  const [notes, setNotes] = useState(venue?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !address.trim()) {
      alert('Please fill in venue name and address');
      return;
    }

    setSaving(true);
    try {
      if (venue) {
        // Update existing venue
        const { error } = await supabase
          .from('venues')
          .update({
            name: name.trim(),
            address: address.trim(),
            google_maps_url: googleMapsUrl.trim() || null,
            notes: notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', venue.id);

        if (error) throw error;

        // Log the admin action
        if (player?.id) {
          await logAdminAction(player.id, 'update_venue', 'venue', venue.id, {
            venue_name: name.trim(),
            previous_name: venue.name,
          });
        }
      } else {
        // Create new venue
        const { data: newVenue, error } = await supabase
          .from('venues')
          .insert({
            name: name.trim(),
            address: address.trim(),
            google_maps_url: googleMapsUrl.trim() || null,
            notes: notes.trim() || null,
            created_by: player?.id,
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;

        // Log the admin action
        if (player?.id && newVenue) {
          await logAdminAction(player.id, 'create_venue', 'venue', newVenue.id, {
            venue_name: name.trim(),
            venue_address: address.trim(),
          });
        }
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving venue:', error);
      alert('Failed to save venue');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card-glass p-8 max-w-lg w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-100">
            {venue ? 'Edit Venue' : 'Add Venue'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Venue Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-modern w-full"
              placeholder="e.g. Downtown Sports Center"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Address <span className="text-red-400">*</span>
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input-modern w-full"
              rows={2}
              placeholder="123 Main St, City, State 12345"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Google Maps URL <span className="text-gray-500">(Optional)</span>
            </label>
            <input
              type="url"
              value={googleMapsUrl}
              onChange={(e) => setGoogleMapsUrl(e.target.value)}
              className="input-modern w-full"
              placeholder="https://maps.google.com/..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Direct link to venue on Google Maps for precise navigation
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Notes <span className="text-gray-500">(Optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-modern w-full"
              rows={3}
              placeholder="Parking info, entry instructions, etc."
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !address.trim()}
            className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : venue ? 'Update' : 'Add'} Venue
          </button>
        </div>
      </div>
    </div>
  );
}
