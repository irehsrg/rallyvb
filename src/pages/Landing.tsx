import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen bg-rally-darker">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-rally-darker/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img
                src="/RallyIcon.png"
                alt="Rally"
                className="w-8 h-8 rounded-lg"
              />
              <span className="text-xl font-bold text-gray-100">Rally</span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors font-medium"
              >
                Log In
              </Link>
              <Link
                to="/signup"
                className="px-4 py-2 bg-gradient-rally text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-100 mb-6 leading-tight">
            Organize Pickup Games,{' '}
            <span className="text-gradient-rally">Track Your Progress</span>
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Rally is the all-in-one platform for volleyball communities. Manage sessions,
            track ratings, host events, and build your local volleyball scene.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signup"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-rally text-white rounded-xl font-semibold text-lg hover:opacity-90 transition-all hover:scale-105"
            >
              Get Started Free
            </Link>
            <Link
              to="/events"
              className="w-full sm:w-auto px-8 py-4 bg-rally-dark border border-white/20 text-gray-300 rounded-xl font-semibold text-lg hover:bg-rally-light hover:border-rally-coral/30 transition-all"
            >
              Browse Events
            </Link>
          </div>
        </div>
      </section>

      {/* What is Rally Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-rally-dark/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-100 mb-4">
              What is Rally?
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Rally helps volleyball communities run better pickup sessions and events.
              Whether you're a player looking for games or an organizer managing a group,
              Rally has you covered.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="card-glass p-6 text-center">
              <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-100 mb-2">Easy Check-ins</h3>
              <p className="text-gray-400">
                Players check in for sessions with one tap. See who's coming and manage your roster effortlessly.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="card-glass p-6 text-center">
              <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-100 mb-2">Skill Ratings</h3>
              <p className="text-gray-400">
                ELO-based ratings that update after each game. Track your progress and find balanced matchups.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="card-glass p-6 text-center">
              <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-100 mb-2">Balanced Teams</h3>
              <p className="text-gray-400">
                Auto-generate fair teams based on player ratings. Keep games competitive and fun for everyone.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* User Roles Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-100 mb-4">
              Built for Everyone
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Rally supports different roles to fit how your volleyball community operates.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Player Role */}
            <div className="card-glass p-8 border-2 border-transparent hover:border-green-500/30 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-100">Players</h3>
                  <span className="text-sm text-green-400">Free to join</span>
                </div>
              </div>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Check in for pickup sessions
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Track your rating and stats
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  RSVP to community events
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  View leaderboards and history
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Get push notifications
                </li>
              </ul>
            </div>

            {/* Host Role */}
            <div className="card-glass p-8 border-2 border-transparent hover:border-rally-coral/30 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-rally-coral/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-rally-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-100">Hosts</h3>
                  <span className="text-sm text-rally-coral">Event organizers</span>
                </div>
              </div>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-rally-coral mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Create public events
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-rally-coral mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Set skill levels and player limits
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-rally-coral mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Manage RSVPs and comments
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-rally-coral mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Add custom locations
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-rally-coral mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Notify players of new events
                </li>
              </ul>
            </div>

            {/* Admin Role */}
            <div className="card-glass p-8 border-2 border-transparent hover:border-purple-500/30 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-100">Admins</h3>
                  <span className="text-sm text-purple-400">Full control</span>
                </div>
              </div>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Create rated pickup sessions
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Auto-generate balanced teams
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Record scores and update ratings
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Manage venues and tournaments
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Assign roles to other users
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-rally-dark/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-100 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Get started in minutes. Here's how a typical session runs with Rally.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-rally flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white">
                1
              </div>
              <h3 className="text-lg font-bold text-gray-100 mb-2">Admin Creates Session</h3>
              <p className="text-gray-400 text-sm">
                Set the date, location, and number of courts for your pickup game.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-rally flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white">
                2
              </div>
              <h3 className="text-lg font-bold text-gray-100 mb-2">Players Check In</h3>
              <p className="text-gray-400 text-sm">
                Players tap to confirm attendance. Everyone sees who's coming in real-time.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-rally flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white">
                3
              </div>
              <h3 className="text-lg font-bold text-gray-100 mb-2">Teams Generated</h3>
              <p className="text-gray-400 text-sm">
                Rally creates balanced teams based on ratings. Adjust manually if needed.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-rally flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white">
                4
              </div>
              <h3 className="text-lg font-bold text-gray-100 mb-2">Record Results</h3>
              <p className="text-gray-400 text-sm">
                Enter game scores. Ratings update automatically based on performance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-100 mb-4">
              Everything You Need
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: '📊', title: 'Leaderboards', desc: 'See top players ranked by rating' },
              { icon: '📱', title: 'Push Notifications', desc: 'Get notified about sessions and results' },
              { icon: '🏆', title: 'Tournaments', desc: 'Bracket-based competitive events' },
              { icon: '👥', title: 'Team Management', desc: 'Create and manage persistent teams' },
              { icon: '📍', title: 'Venue Management', desc: 'Save frequent locations with details' },
              { icon: '📈', title: 'Stats & History', desc: 'View your game history and trends' },
              { icon: '🔔', title: 'Event Reminders', desc: 'Automatic 1-hour reminders' },
              { icon: '💬', title: 'Event Comments', desc: 'Discuss events with other players' },
              { icon: '📲', title: 'QR Check-in', desc: 'Quick guest check-in via QR code' },
            ].map((feature, i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-rally-dark/30 hover:bg-rally-dark/50 transition-colors">
                <span className="text-2xl">{feature.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-100">{feature.title}</h3>
                  <p className="text-sm text-gray-400">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-rally-dark/30 to-rally-darker">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-100 mb-4">
            Ready to Rally?
          </h2>
          <p className="text-lg text-gray-400 mb-8">
            Join your local volleyball community today. It's free to sign up and start playing.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signup"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-rally text-white rounded-xl font-semibold text-lg hover:opacity-90 transition-all hover:scale-105"
            >
              Create Free Account
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-4 bg-rally-dark border border-white/20 text-gray-300 rounded-xl font-semibold text-lg hover:bg-rally-light transition-all"
            >
              I Already Have an Account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img
              src="/RallyIcon.png"
              alt="Rally"
              className="w-6 h-6 rounded"
            />
            <span className="text-gray-400 text-sm">Rally Volleyball</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link to="/events" className="hover:text-gray-300 transition-colors">Events</Link>
            <Link to="/leaderboard" className="hover:text-gray-300 transition-colors">Leaderboard</Link>
            <Link to="/teams" className="hover:text-gray-300 transition-colors">Teams</Link>
            <Link to="/tournaments" className="hover:text-gray-300 transition-colors">Tournaments</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
