import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { OpenSession, OpenSessionRSVP, OpenSessionComment, RSVPStatus } from '../types';
import { getAdminPermissions } from '../utils/permissions';
import CreateEventModal from '../components/CreateEventModal';
import { notifyCommentReply } from '../utils/notifications';

export default function EventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { player } = useAuth();
  const [event, setEvent] = useState<OpenSession | null>(null);
  const [rsvps, setRsvps] = useState<OpenSessionRSVP[]>([]);
  const [comments, setComments] = useState<OpenSessionComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRsvp, setUserRsvp] = useState<RSVPStatus | null>(null);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [rsvpFilter, setRsvpFilter] = useState<'going' | 'maybe' | 'all'>('going');

  const permissions = getAdminPermissions(player);
  const isHost = event?.host_id === player?.id;
  const canEdit = isHost || permissions.canManageAllOpenSessions;

  useEffect(() => {
    if (eventId) {
      fetchEvent();
      fetchRsvps();
      fetchComments();
    }
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      const { data, error } = await supabase
        .from('open_sessions')
        .select(`
          *,
          host:players!open_sessions_host_id_fkey(id, name, profile_photo_url),
          venue:venues(id, name, address, google_maps_url)
        `)
        .eq('id', eventId)
        .single();

      if (error) throw error;
      setEvent(data);
    } catch (error) {
      console.error('Error fetching event:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRsvps = async () => {
    try {
      const { data, error } = await supabase
        .from('open_session_rsvps')
        .select(`
          *,
          player:players(id, name, profile_photo_url, rating)
        `)
        .eq('session_id', eventId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setRsvps(data || []);

      // Set user's RSVP
      if (player) {
        const myRsvp = data?.find((r) => r.player_id === player.id);
        setUserRsvp(myRsvp?.status || null);
      }
    } catch (error) {
      console.error('Error fetching RSVPs:', error);
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('open_session_comments')
        .select(`
          *,
          player:players(id, name, profile_photo_url)
        `)
        .eq('session_id', eventId)
        .is('parent_id', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch replies for each comment
      const commentsWithReplies = await Promise.all(
        (data || []).map(async (comment) => {
          const { data: replies } = await supabase
            .from('open_session_comments')
            .select(`
              *,
              player:players(id, name, profile_photo_url)
            `)
            .eq('parent_id', comment.id)
            .order('created_at', { ascending: true });

          return { ...comment, replies: replies || [] };
        })
      );

      setComments(commentsWithReplies);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleRSVP = async (status: RSVPStatus) => {
    if (!player || !eventId) return;

    try {
      const { error } = await supabase
        .from('open_session_rsvps')
        .upsert(
          {
            session_id: eventId,
            player_id: player.id,
            status,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_id,player_id' }
        );

      if (error) throw error;
      setUserRsvp(status);
      fetchRsvps();
    } catch (error) {
      console.error('Error updating RSVP:', error);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player || !eventId || !newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const { error } = await supabase.from('open_session_comments').insert({
        session_id: eventId,
        player_id: player.id,
        parent_id: null,
        content: newComment.trim(),
      });

      if (error) throw error;
      setNewComment('');
      fetchComments();
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleSubmitReply = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (!player || !eventId || !replyContent.trim()) return;

    setSubmittingComment(true);
    try {
      const { error } = await supabase.from('open_session_comments').insert({
        session_id: eventId,
        player_id: player.id,
        parent_id: parentId,
        content: replyContent.trim(),
      });

      if (error) throw error;

      // Send notification to the parent comment author
      if (event) {
        const parentComment = comments.find(c => c.id === parentId);
        if (parentComment && parentComment.player_id !== player.id) {
          notifyCommentReply(
            parentComment.player_id,
            { id: event.id, title: event.title },
            player.name
          ).catch(err => console.error('Failed to send comment reply notification:', err));
        }
      }

      setReplyContent('');
      setReplyingTo(null);
      fetchComments();
    } catch (error) {
      console.error('Error posting reply:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;

    try {
      const { error } = await supabase
        .from('open_session_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      fetchComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventId) return;

    try {
      const { error } = await supabase
        .from('open_sessions')
        .delete()
        .eq('id', eventId);

      if (error) throw error;
      navigate('/events');
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event');
    }
  };

  const handleCancelEvent = async () => {
    if (!eventId) return;
    if (!confirm('Cancel this event? Attendees will be notified.')) return;

    try {
      const { error } = await supabase
        .from('open_sessions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', eventId);

      if (error) throw error;
      fetchEvent();
    } catch (error) {
      console.error('Error cancelling event:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatCommentTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getSkillLevelColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'intermediate':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'advanced':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'expert':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const filteredRsvps = rsvps.filter((r) => {
    if (rsvpFilter === 'all') return true;
    return r.status === rsvpFilter;
  });

  const rsvpCounts = {
    going: rsvps.filter((r) => r.status === 'going').length,
    maybe: rsvps.filter((r) => r.status === 'maybe').length,
    not_going: rsvps.filter((r) => r.status === 'not_going').length,
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-rally-coral"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-rally-darker flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-100 mb-4">Event not found</h2>
          <Link to="/events" className="btn-primary">
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rally-darker">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link
          to="/events"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-200 mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Events
        </Link>

        {/* Event Header Card */}
        <div className="card-glass p-6 mb-6">
          {/* Status Badge */}
          {event.status === 'cancelled' && (
            <div className="mb-4 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm font-medium">
              This event has been cancelled
            </div>
          )}

          {/* Title & Host */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-100 mb-2">{event.title}</h1>
              <div className="flex items-center gap-2 text-gray-400">
                <span>Hosted by</span>
                {(event.host as any)?.profile_photo_url ? (
                  <img
                    src={(event.host as any).profile_photo_url}
                    alt={(event.host as any).name}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-rally-coral/20 flex items-center justify-center text-xs text-rally-coral font-bold">
                    {(event.host as any)?.name?.charAt(0) || '?'}
                  </div>
                )}
                <Link
                  to={`/player/${(event.host as any)?.id}`}
                  className="font-medium text-gray-300 hover:text-rally-coral"
                >
                  {(event.host as any)?.name || 'Unknown'}
                </Link>
              </div>
            </div>

            {/* Host Actions */}
            {canEdit && event.status !== 'cancelled' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-rally-dark hover:bg-rally-light text-gray-300 text-sm transition-all"
                >
                  Edit
                </button>
                <button
                  onClick={handleCancelEvent}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm transition-all"
                >
                  Cancel Event
                </button>
              </div>
            )}
          </div>

          {/* Date, Time, Location */}
          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-rally-coral/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-rally-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="text-gray-100 font-medium">{formatDate(event.event_date)}</div>
                <div className="text-gray-400 text-sm">
                  {formatTime(event.start_time)}
                  {event.end_time && ` - ${formatTime(event.end_time)}`}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-rally-coral/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-rally-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <div className="text-gray-100 font-medium">
                  {(event.venue as any)?.name || event.custom_location || 'Location TBD'}
                </div>
                <div className="text-gray-400 text-sm">
                  {(event.venue as any)?.address || event.custom_address}
                </div>
                {((event.venue as any)?.google_maps_url || event.google_maps_url) && (
                  <a
                    href={(event.venue as any)?.google_maps_url || event.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rally-coral text-sm hover:underline"
                  >
                    View on Maps
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className={`px-3 py-1 text-sm rounded-lg border font-medium ${getSkillLevelColor(event.skill_level)}`}>
              {event.skill_level === 'all_levels' ? 'All Levels' : event.skill_level}
            </span>
            {event.max_players && (
              <span className="px-3 py-1 text-sm rounded-lg bg-gray-500/20 text-gray-400 border border-gray-500/30">
                Max {event.max_players} players
              </span>
            )}
            <span className="px-3 py-1 text-sm rounded-lg bg-gray-500/20 text-gray-400 border border-gray-500/30">
              Min {event.min_players} players
            </span>
          </div>

          {/* Description */}
          {event.description && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-400 mb-2">About this event</h3>
              <p className="text-gray-300 whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {/* RSVP Buttons */}
          {player && event.status !== 'cancelled' && event.status !== 'completed' && (
            <div className="pt-4 border-t border-white/10">
              <div className="text-sm text-gray-400 mb-3">Your response</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleRSVP('going')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    userRsvp === 'going'
                      ? 'bg-green-500 text-white'
                      : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  }`}
                >
                  Going
                </button>
                <button
                  onClick={() => handleRSVP('maybe')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    userRsvp === 'maybe'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                  }`}
                >
                  Maybe
                </button>
                <button
                  onClick={() => handleRSVP('not_going')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    userRsvp === 'not_going'
                      ? 'bg-red-500 text-white'
                      : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  }`}
                >
                  Can't Go
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Attendees Section */}
        <div className="card-glass p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-100 mb-4">
            Attendees ({rsvpCounts.going} going)
          </h2>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setRsvpFilter('going')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                rsvpFilter === 'going'
                  ? 'bg-green-500/30 text-green-400'
                  : 'bg-rally-dark/50 text-gray-400 hover:bg-rally-dark'
              }`}
            >
              Going ({rsvpCounts.going})
            </button>
            <button
              onClick={() => setRsvpFilter('maybe')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                rsvpFilter === 'maybe'
                  ? 'bg-yellow-500/30 text-yellow-400'
                  : 'bg-rally-dark/50 text-gray-400 hover:bg-rally-dark'
              }`}
            >
              Maybe ({rsvpCounts.maybe})
            </button>
            <button
              onClick={() => setRsvpFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                rsvpFilter === 'all'
                  ? 'bg-rally-coral text-white'
                  : 'bg-rally-dark/50 text-gray-400 hover:bg-rally-dark'
              }`}
            >
              All
            </button>
          </div>

          {/* Attendee List */}
          {filteredRsvps.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No responses yet</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {filteredRsvps.map((rsvp) => (
                <Link
                  key={rsvp.id}
                  to={`/player/${rsvp.player_id}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-rally-dark/50 hover:bg-rally-dark transition-colors"
                >
                  {(rsvp.player as any)?.profile_photo_url ? (
                    <img
                      src={(rsvp.player as any).profile_photo_url}
                      alt={(rsvp.player as any).name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-rally-coral/20 flex items-center justify-center text-rally-coral font-bold">
                      {(rsvp.player as any)?.name?.charAt(0) || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-100 font-medium truncate">
                      {(rsvp.player as any)?.name || 'Unknown'}
                    </div>
                    <div className="text-gray-500 text-sm">
                      Rating: {(rsvp.player as any)?.rating || 1500}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs rounded font-medium ${
                      rsvp.status === 'going'
                        ? 'bg-green-500/20 text-green-400'
                        : rsvp.status === 'maybe'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {rsvp.status === 'not_going' ? "Can't go" : rsvp.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Comments Section */}
        {event.allow_comments && (
          <div className="card-glass p-6">
            <h2 className="text-xl font-bold text-gray-100 mb-4">
              Discussion ({comments.length})
            </h2>

            {/* New Comment Form */}
            {player && (
              <form onSubmit={handleSubmitComment} className="mb-6">
                <div className="flex gap-3">
                  {player.profile_photo_url ? (
                    <img
                      src={player.profile_photo_url}
                      alt={player.name}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-rally-coral/20 flex items-center justify-center text-rally-coral font-bold flex-shrink-0">
                      {player.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Ask a question or leave a comment..."
                      className="input-modern w-full resize-none"
                      rows={2}
                      maxLength={500}
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        type="submit"
                        disabled={!newComment.trim() || submittingComment}
                        className="btn-primary text-sm disabled:opacity-50"
                      >
                        {submittingComment ? 'Posting...' : 'Post'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* Comments List */}
            {comments.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No comments yet. Be the first to ask a question!</p>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="space-y-3">
                    {/* Main Comment */}
                    <div className="flex gap-3">
                      {(comment.player as any)?.profile_photo_url ? (
                        <img
                          src={(comment.player as any).profile_photo_url}
                          alt={(comment.player as any).name}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-rally-coral/20 flex items-center justify-center text-rally-coral font-bold flex-shrink-0">
                          {(comment.player as any)?.name?.charAt(0) || '?'}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            to={`/player/${comment.player_id}`}
                            className="font-medium text-gray-100 hover:text-rally-coral"
                          >
                            {(comment.player as any)?.name || 'Unknown'}
                          </Link>
                          {comment.player_id === event.host_id && (
                            <span className="px-1.5 py-0.5 text-xs bg-rally-coral/20 text-rally-coral rounded">
                              Host
                            </span>
                          )}
                          <span className="text-gray-500 text-sm">
                            {formatCommentTime(comment.created_at)}
                          </span>
                          {comment.is_edited && (
                            <span className="text-gray-600 text-xs">(edited)</span>
                          )}
                        </div>
                        <p className="text-gray-300">{comment.content}</p>
                        <div className="flex items-center gap-3 mt-2">
                          {player && (
                            <button
                              onClick={() => {
                                setReplyingTo(replyingTo === comment.id ? null : comment.id);
                                setReplyContent('');
                              }}
                              className="text-gray-500 hover:text-rally-coral text-sm"
                            >
                              Reply
                            </button>
                          )}
                          {(comment.player_id === player?.id || isHost) && (
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-gray-500 hover:text-red-400 text-sm"
                            >
                              Delete
                            </button>
                          )}
                        </div>

                        {/* Reply Form */}
                        {replyingTo === comment.id && player && (
                          <form onSubmit={(e) => handleSubmitReply(e, comment.id)} className="mt-3">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                placeholder={`Reply to ${(comment.player as any)?.name || 'comment'}...`}
                                className="input-modern flex-1 text-sm py-2"
                                maxLength={500}
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyingTo(null);
                                  setReplyContent('');
                                }}
                                className="px-3 py-2 text-gray-500 hover:text-gray-300 text-sm"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={!replyContent.trim() || submittingComment}
                                className="btn-primary text-sm py-2 px-4 disabled:opacity-50"
                              >
                                Reply
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    </div>

                    {/* Replies */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="ml-12 space-y-3 border-l-2 border-white/10 pl-4">
                        {comment.replies.map((reply: OpenSessionComment) => (
                          <div key={reply.id} className="flex gap-3">
                            {(reply.player as any)?.profile_photo_url ? (
                              <img
                                src={(reply.player as any).profile_photo_url}
                                alt={(reply.player as any).name}
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-rally-coral/20 flex items-center justify-center text-rally-coral font-bold text-sm flex-shrink-0">
                                {(reply.player as any)?.name?.charAt(0) || '?'}
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Link
                                  to={`/player/${reply.player_id}`}
                                  className="font-medium text-gray-100 hover:text-rally-coral text-sm"
                                >
                                  {(reply.player as any)?.name || 'Unknown'}
                                </Link>
                                {reply.player_id === event.host_id && (
                                  <span className="px-1 py-0.5 text-xs bg-rally-coral/20 text-rally-coral rounded">
                                    Host
                                  </span>
                                )}
                                <span className="text-gray-500 text-xs">
                                  {formatCommentTime(reply.created_at)}
                                </span>
                              </div>
                              <p className="text-gray-300 text-sm">{reply.content}</p>
                              {(reply.player_id === player?.id || isHost) && (
                                <button
                                  onClick={() => handleDeleteComment(reply.id)}
                                  className="text-gray-500 hover:text-red-400 text-xs mt-1"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="card-glass p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-gray-100 mb-4">Delete Event?</h3>
              <p className="text-gray-400 mb-6">
                This will permanently delete this event and all associated RSVPs and comments.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteEvent}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Event Modal */}
      {showEditModal && (
        <CreateEventModal
          editEvent={event}
          onClose={() => setShowEditModal(false)}
          onCreated={() => {
            setShowEditModal(false);
            fetchEvent();
          }}
        />
      )}
    </div>
  );
}
