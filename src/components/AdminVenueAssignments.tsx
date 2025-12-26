import { useState, useEffect } from 'react';
import { supabase, logAdminAction } from '../lib/supabase';
import { Player, Venue, AdminVenueAssignment } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { clearVenueAssignmentsCache } from '../utils/permissions';

interface AdminWithAssignments extends Player {
  venue_assignments?: (AdminVenueAssignment & { venue?: Venue })[];
}

export default function AdminVenueAssignments() {
  const { player } = useAuth();
  const [locationAdmins, setLocationAdmins] = useState<AdminWithAssignments[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminWithAssignments | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch all location admins
      const { data: admins, error: adminsError } = await supabase
        .from('players')
        .select('*')
        .eq('is_admin', true)
        .eq('admin_role', 'location_admin')
        .order('name');

      if (adminsError) throw adminsError;

      // Fetch all venues
      const { data: venuesData, error: venuesError } = await supabase
        .from('venues')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (venuesError) throw venuesError;

      // Fetch all venue assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('admin_venue_assignments')
        .select('*, venue:venues(*)');

      if (assignmentsError) throw assignmentsError;

      // Map assignments to admins
      const adminsWithAssignments = admins?.map(admin => ({
        ...admin,
        venue_assignments: assignments?.filter(a => a.admin_id === admin.id) || [],
      })) || [];

      setLocationAdmins(adminsWithAssignments);
      setVenues(venuesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignVenue = async (adminId: string, venueId: string) => {
    try {
      const { error } = await supabase
        .from('admin_venue_assignments')
        .insert({
          admin_id: adminId,
          venue_id: venueId,
          assigned_by: player?.id,
        });

      if (error) throw error;

      // Log the action
      if (player?.id) {
        const admin = locationAdmins.find(a => a.id === adminId);
        const venue = venues.find(v => v.id === venueId);
        await logAdminAction(player.id, 'assign_venue', 'admin_venue_assignment', adminId, {
          admin_name: admin?.name,
          venue_name: venue?.name,
        });
      }

      // Clear cache so the admin sees their new assignment
      clearVenueAssignmentsCache();

      await fetchData();
    } catch (error: any) {
      console.error('Error assigning venue:', error);
      if (error.code === '23505') {
        alert('This venue is already assigned to this admin');
      } else {
        alert('Failed to assign venue');
      }
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to remove this venue assignment?')) return;

    try {
      const { error } = await supabase
        .from('admin_venue_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;

      // Log the action
      if (player?.id) {
        await logAdminAction(player.id, 'remove_venue_assignment', 'admin_venue_assignment', assignmentId, {});
      }

      // Clear cache
      clearVenueAssignmentsCache();

      await fetchData();
    } catch (error) {
      console.error('Error removing assignment:', error);
      alert('Failed to remove assignment');
    }
  };

  if (loading) {
    return (
      <div className="card-glass p-6">
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-rally-coral"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-glass p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
          <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Venue Assignments
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Assign venues to location admins. They will only see sessions at their assigned venues.
        </p>
      </div>

      {locationAdmins.length === 0 ? (
        <div className="text-center py-8">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-300 mb-2">No Location Admins</h3>
          <p className="text-gray-500">Promote users to "Location Admin" role first</p>
        </div>
      ) : (
        <div className="space-y-4">
          {locationAdmins.map(admin => (
            <div key={admin.id} className="bg-rally-dark/50 rounded-xl p-4 border border-white/10">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-rally flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold">
                      {admin.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-100">{admin.name}</h3>
                    <div className="text-sm text-blue-400">Location Admin</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedAdmin(admin);
                    setShowAssignModal(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 text-sm font-medium transition-all flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Assign Venue
                </button>
              </div>

              {/* Assigned Venues */}
              <div className="mt-4">
                {admin.venue_assignments && admin.venue_assignments.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {admin.venue_assignments.map(assignment => (
                      <div
                        key={assignment.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30"
                      >
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm text-green-400 font-medium">
                          {assignment.venue?.name || 'Unknown Venue'}
                        </span>
                        <button
                          onClick={() => handleRemoveAssignment(assignment.id)}
                          className="text-gray-500 hover:text-red-400 transition-colors ml-1"
                          title="Remove assignment"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">
                    No venues assigned - this admin can't see any sessions yet
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assign Venue Modal */}
      {showAssignModal && selectedAdmin && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card-glass p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-100">
                Assign Venue to {selectedAdmin.name}
              </h3>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedAdmin(null);
                }}
                className="text-gray-400 hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {venues.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No venues available. Create venues first.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {venues
                  .filter(v => !selectedAdmin.venue_assignments?.some(a => a.venue_id === v.id))
                  .map(venue => (
                    <button
                      key={venue.id}
                      onClick={() => {
                        handleAssignVenue(selectedAdmin.id, venue.id);
                        setShowAssignModal(false);
                        setSelectedAdmin(null);
                      }}
                      className="w-full p-4 text-left rounded-xl bg-rally-dark/50 hover:bg-rally-dark border border-white/10 hover:border-blue-500/30 transition-all"
                    >
                      <div className="font-medium text-gray-100">{venue.name}</div>
                      <div className="text-sm text-gray-500">{venue.address}</div>
                    </button>
                  ))}
                {venues.filter(v => !selectedAdmin.venue_assignments?.some(a => a.venue_id === v.id)).length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    All venues are already assigned to this admin
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
