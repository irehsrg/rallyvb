import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { useState } from 'react';
import HelpModal from './HelpModal';
import OfflineIndicator from './OfflineIndicator';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, player, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'issue' | 'other'>('other');
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackDescription, setFeedbackDescription] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackTitle.trim() || !feedbackDescription.trim()) {
      alert('Please provide both a title and description');
      return;
    }

    setSubmittingFeedback(true);
    try {
      const { error } = await supabase
        .from('feedback_reports')
        .insert({
          player_id: player?.id || null,
          category: feedbackType,
          title: feedbackTitle,
          description: feedbackDescription,
          status: 'new',
        });

      if (error) {
        console.error('Feedback submission error:', error);
        throw error;
      }

      alert('Thank you for your feedback!');
      setShowFeedbackModal(false);
      setFeedbackTitle('');
      setFeedbackDescription('');
      setFeedbackType('other');
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      alert(`Failed to submit feedback: ${error.message || 'Unknown error'}. Check console for details.`);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const cycleTheme = () => {
    const themes: Array<'dark' | 'light' | 'auto'> = ['dark', 'light', 'auto'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const getThemeIcon = () => {
    if (theme === 'dark') {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      );
    } else if (theme === 'light') {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    } else {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const navLinkClass = (path: string) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
      isActive(path)
        ? 'bg-gradient-rally text-white shadow-lg shadow-rally-coral/30'
        : 'text-gray-400 hover:text-gray-100 hover:bg-rally-light/50'
    }`;

  const mobileNavClass = (path: string) =>
    `flex flex-col items-center justify-center py-2 transition-all duration-300 ${
      isActive(path) ? 'text-rally-coral' : 'text-gray-500'
    }`;

  return (
    <div className="min-h-screen bg-rally-darker">
      {/* Header */}
      <header className="bg-rally-dark/80 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link to="/home" className="flex items-center gap-3 group">
              <img
                src="/RallyIcon.png"
                alt="Rally"
                className="w-10 h-10 rounded-xl transition-transform duration-300 group-hover:scale-110"
              />
            </Link>

            <div className="flex items-center gap-2">
              {/* Help Button */}
              <button
                onClick={() => setShowHelpModal(true)}
                className="p-2 text-gray-400 hover:text-gray-100 hover:bg-rally-light/50 rounded-xl transition-all duration-300"
                title="Help & Tips"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

              {/* Feedback Button */}
              <button
                onClick={() => setShowFeedbackModal(true)}
                className="p-2 text-gray-400 hover:text-gray-100 hover:bg-rally-light/50 rounded-xl transition-all duration-300"
                title="Send Feedback"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </button>

              {/* Theme Toggle */}
              <button
                onClick={cycleTheme}
                className="p-2 text-gray-400 hover:text-gray-100 hover:bg-rally-light/50 rounded-xl transition-all duration-300"
                title={`Theme: ${theme}`}
              >
                {getThemeIcon()}
              </button>

              {user ? (
                <>
                  <Link
                    to="/profile"
                    className="hidden sm:flex items-center gap-3 bg-rally-light/50 px-4 py-2 rounded-xl hover:bg-rally-light transition-all cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-rally flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                      {player?.profile_photo_url ? (
                        <img
                          src={player.profile_photo_url}
                          alt={player.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        player?.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-300">
                      {player?.name}
                    </span>
                    <div className="flex items-center gap-1 bg-rally-dark px-2 py-1 rounded-lg">
                      <svg className="w-4 h-4 text-rally-coral" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-xs font-bold text-rally-coral">
                        {player?.rating}
                      </span>
                    </div>
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="text-sm px-4 py-2 text-gray-400 hover:text-gray-100 hover:bg-rally-light/50 rounded-xl transition-all duration-300"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-sm px-4 py-2 text-gray-300 hover:text-gray-100 rounded-xl transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    className="text-sm px-4 py-2 bg-gradient-rally text-white rounded-xl hover:shadow-lg hover:shadow-rally-coral/50 transition-all duration-300"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar Navigation (Desktop) */}
      {user && (
        <aside className="hidden md:block fixed left-0 top-20 bottom-0 w-64 bg-rally-dark/50 backdrop-blur-xl border-r border-white/10 overflow-y-auto">
          <nav className="p-4 space-y-2">
            <Link to="/home" className={navLinkClass('/home')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="font-medium">Home</span>
            </Link>

            <Link to="/leaderboard" className={navLinkClass('/leaderboard')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="font-medium">Leaderboard</span>
            </Link>

            <Link to="/history" className={navLinkClass('/history')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="font-medium">History</span>
            </Link>

            <Link to="/statistics" className={navLinkClass('/statistics')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="font-medium">Statistics</span>
            </Link>

            <Link to="/events" className={navLinkClass('/events')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              <span className="font-medium">Events</span>
            </Link>

            <Link to="/teams" className={navLinkClass('/teams')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="font-medium">Teams</span>
            </Link>

            <Link to="/tournaments" className={navLinkClass('/tournaments')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <span className="font-medium">Tournaments</span>
            </Link>

            <Link to="/profile" className={navLinkClass('/profile')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-medium">Profile</span>
            </Link>

            {player?.is_admin && (
              <Link to="/admin" className={navLinkClass('/admin')}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="font-medium">Admin</span>
              </Link>
            )}
          </nav>
        </aside>
      )}

      {/* Bottom Navigation (Mobile) */}
      {user && (
        <nav className="fixed bottom-0 left-0 right-0 bg-rally-dark/95 backdrop-blur-xl border-t border-white/10 md:hidden z-50">
          <div className={`grid ${player?.is_admin ? 'grid-cols-6' : 'grid-cols-5'} gap-1`}>
            <Link to="/home" className={mobileNavClass('/home')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-[10px] mt-0.5 font-medium">Home</span>
            </Link>

            <Link to="/events" className={mobileNavClass('/events')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              <span className="text-[10px] mt-0.5 font-medium">Events</span>
            </Link>

            <Link to="/tournaments" className={mobileNavClass('/tournaments')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <span className="text-[10px] mt-0.5 font-medium">Tourney</span>
            </Link>

            <Link to="/leaderboard" className={mobileNavClass('/leaderboard')}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-[10px] mt-0.5 font-medium">Ranks</span>
            </Link>

            <Link to="/profile" className={mobileNavClass('/profile')}>
              <div className="w-5 h-5 rounded-full bg-gradient-rally flex items-center justify-center overflow-hidden">
                {player?.profile_photo_url ? (
                  <img
                    src={player.profile_photo_url}
                    alt={player.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[8px] text-white font-bold">
                    {player?.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 font-medium">Profile</span>
            </Link>

            {player?.is_admin && (
              <Link to="/admin" className={mobileNavClass('/admin')}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-[10px] mt-0.5 font-medium">Admin</span>
              </Link>
            )}
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className={`${user ? 'md:ml-64 pb-20 md:pb-0' : ''} min-h-screen`}>
        {children}
      </main>

      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="card-glass p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                Send Feedback
              </h3>
              <button
                onClick={() => {
                  setShowFeedbackModal(false);
                  setFeedbackTitle('');
                  setFeedbackDescription('');
                }}
                className="text-gray-400 hover:text-gray-100 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Feedback Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Feedback Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFeedbackType('bug')}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      feedbackType === 'bug'
                        ? 'bg-red-500/20 border-red-500 text-red-400'
                        : 'bg-rally-dark border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-medium">Bug</span>
                  </button>
                  <button
                    onClick={() => setFeedbackType('feature')}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      feedbackType === 'feature'
                        ? 'bg-green-500/20 border-green-500 text-green-400'
                        : 'bg-rally-dark border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span className="text-xs font-medium">Feature</span>
                  </button>
                  <button
                    onClick={() => setFeedbackType('issue')}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      feedbackType === 'issue'
                        ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                        : 'bg-rally-dark border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-xs font-medium">Issue</span>
                  </button>
                  <button
                    onClick={() => setFeedbackType('other')}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      feedbackType === 'other'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                        : 'bg-rally-dark border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    <svg className="w-5 h-5 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <span className="text-xs font-medium">Other</span>
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={feedbackTitle}
                  onChange={(e) => setFeedbackTitle(e.target.value)}
                  className="input-modern w-full"
                  placeholder="Brief summary of your feedback"
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {feedbackTitle.length} / 100 characters
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={feedbackDescription}
                  onChange={(e) => setFeedbackDescription(e.target.value)}
                  className="input-modern w-full"
                  rows={6}
                  placeholder="Please provide details about your feedback..."
                  maxLength={1000}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {feedbackDescription.length} / 1000 characters
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => {
                  setShowFeedbackModal(false);
                  setFeedbackTitle('');
                  setFeedbackDescription('');
                }}
                className="btn-secondary flex-1"
                disabled={submittingFeedback}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitFeedback}
                className="btn-primary flex-1"
                disabled={submittingFeedback || !feedbackTitle.trim() || !feedbackDescription.trim()}
              >
                {submittingFeedback ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  'Submit Feedback'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
    </div>
  );
}
