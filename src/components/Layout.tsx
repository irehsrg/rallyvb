import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, player, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
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
            <Link to="/" className="flex items-center gap-3 group">
              <img
                src="/RallyIcon.png"
                alt="Rally"
                className="w-10 h-10 rounded-xl transition-transform duration-300 group-hover:scale-110"
              />
            </Link>

            {user ? (
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-3 bg-rally-light/50 px-4 py-2 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-gradient-rally flex items-center justify-center text-white font-bold text-sm">
                    {player?.name.charAt(0).toUpperCase()}
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
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-sm px-4 py-2 text-gray-400 hover:text-gray-100 hover:bg-rally-light/50 rounded-xl transition-all duration-300"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
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
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Sidebar Navigation (Desktop) */}
      {user && (
        <aside className="hidden md:block fixed left-0 top-20 bottom-0 w-64 bg-rally-dark/50 backdrop-blur-xl border-r border-white/10 overflow-y-auto">
          <nav className="p-4 space-y-2">
            <Link to="/" className={navLinkClass('/')}>
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
          <div className={`grid gap-1 ${player?.is_admin ? 'grid-cols-5' : 'grid-cols-4'}`}>
            <Link to="/" className={mobileNavClass('/')}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-xs mt-1 font-medium">Home</span>
            </Link>

            <Link to="/leaderboard" className={mobileNavClass('/leaderboard')}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-xs mt-1 font-medium">Ranks</span>
            </Link>

            <Link to="/history" className={mobileNavClass('/history')}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs mt-1 font-medium">History</span>
            </Link>

            <Link to="/profile" className={mobileNavClass('/profile')}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-xs mt-1 font-medium">Profile</span>
            </Link>

            {player?.is_admin && (
              <Link to="/admin" className={mobileNavClass('/admin')}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs mt-1 font-medium">Admin</span>
              </Link>
            )}
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className={`${user ? 'md:ml-64 pb-20 md:pb-0' : ''} min-h-screen`}>
        {children}
      </main>
    </div>
  );
}
