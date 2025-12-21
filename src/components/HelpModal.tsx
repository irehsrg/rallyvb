import { useState } from 'react';

type Tab = 'install' | 'tips' | 'faq';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Component for displaying help screenshots with fallback
function HelpImage({ src, alt, fallbackIcon }: { src: string; alt: string; fallbackIcon?: React.ReactNode }) {
  const [hasError, setHasError] = useState(false);

  if (hasError && fallbackIcon) {
    return <div className="flex justify-center">{fallbackIcon}</div>;
  }

  return (
    <img
      src={src}
      alt={alt}
      className="rounded-lg border border-gray-600 max-w-full mx-auto"
      onError={() => setHasError(true)}
    />
  );
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('install');
  const [installPlatform, setInstallPlatform] = useState<'ios' | 'android'>('ios');

  if (!isOpen) return null;

  const tabClass = (tab: Tab) =>
    `px-4 py-2 rounded-lg font-medium transition-all ${
      activeTab === tab
        ? 'bg-rally-coral text-white'
        : 'text-gray-400 hover:text-gray-200 hover:bg-rally-light/50'
    }`;

  const platformClass = (platform: 'ios' | 'android') =>
    `flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
      installPlatform === platform
        ? 'bg-gradient-rally text-white shadow-lg'
        : 'bg-rally-dark text-gray-400 hover:text-gray-200 border border-gray-700'
    }`;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="card-glass p-6 max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
            <svg className="w-6 h-6 text-rally-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Help & Tips
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-100 transition-colors p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-gray-700 pb-4">
          <button onClick={() => setActiveTab('install')} className={tabClass('install')}>
            Install App
          </button>
          <button onClick={() => setActiveTab('tips')} className={tabClass('tips')}>
            Quick Tips
          </button>
          <button onClick={() => setActiveTab('faq')} className={tabClass('faq')}>
            FAQ
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 pr-2">
          {activeTab === 'install' && (
            <div className="space-y-4">
              <p className="text-gray-300 text-sm">
                Install Rally on your phone for quick access - it works just like a native app!
              </p>

              {/* Platform Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setInstallPlatform('ios')}
                  className={platformClass('ios')}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  iPhone / iPad
                </button>
                <button
                  onClick={() => setInstallPlatform('android')}
                  className={platformClass('android')}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.523 15.341c-.5 0-.906-.406-.906-.906s.406-.907.906-.907.907.407.907.907-.406.906-.907.906m-11.046 0c-.5 0-.906-.406-.906-.906s.406-.907.906-.907.907.407.907.907-.406.906-.907.906M17.921 7.66l1.623-2.812a.337.337 0 00-.584-.338l-1.644 2.848a10.191 10.191 0 00-4.316-.949c-1.548 0-3.007.333-4.316.95L7.04 4.51a.337.337 0 00-.584.338l1.623 2.812C5.276 9.056 3.328 11.85 3 15.153h18c-.329-3.302-2.276-6.096-5.079-7.493"/>
                  </svg>
                  Android
                </button>
              </div>

              {/* iOS Instructions */}
              {installPlatform === 'ios' && (
                <div className="space-y-4">
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                    <p className="text-blue-400 text-sm flex items-start gap-2">
                      <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        <strong>iOS 16.4+:</strong> Works in Safari, Chrome, Firefox, and Edge!
                        <br />
                        <span className="text-blue-300/70 text-xs">Older iOS versions require Safari.</span>
                      </span>
                    </p>
                  </div>

                  <div className="bg-rally-dark rounded-xl p-4 border border-gray-700">
                    <h4 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-rally-coral text-white text-sm flex items-center justify-center font-bold">1</span>
                      Open the Menu
                    </h4>
                    <p className="text-gray-400 text-sm ml-8 mb-3">
                      Tap the <strong className="text-gray-200">three dots menu</strong> in Safari's address bar.
                    </p>
                    <div className="ml-8">
                      <HelpImage
                        src="/help-images/ios-1.PNG"
                        alt="iOS Safari menu button"
                      />
                    </div>
                  </div>

                  <div className="bg-rally-dark rounded-xl p-4 border border-gray-700">
                    <h4 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-rally-coral text-white text-sm flex items-center justify-center font-bold">2</span>
                      Tap the Share Button
                    </h4>
                    <p className="text-gray-400 text-sm ml-8 mb-3">
                      Tap the <strong className="text-gray-200">Share</strong> button (square with arrow pointing up).
                    </p>
                    <div className="ml-8">
                      <HelpImage
                        src="/help-images/ios-2.PNG"
                        alt="iOS Share Button"
                      />
                    </div>
                  </div>

                  <div className="bg-rally-dark rounded-xl p-4 border border-gray-700">
                    <h4 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-rally-coral text-white text-sm flex items-center justify-center font-bold">3</span>
                      Tap "More"
                    </h4>
                    <p className="text-gray-400 text-sm ml-8 mb-3">
                      Scroll through the share options and tap <strong className="text-gray-200">"More"</strong> to see additional options.
                    </p>
                    <div className="ml-8">
                      <HelpImage
                        src="/help-images/ios-3.PNG"
                        alt="iOS More button"
                      />
                    </div>
                  </div>

                  <div className="bg-rally-dark rounded-xl p-4 border border-gray-700">
                    <h4 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-rally-coral text-white text-sm flex items-center justify-center font-bold">4</span>
                      Select "Add to Home Screen"
                    </h4>
                    <p className="text-gray-400 text-sm ml-8 mb-3">
                      Find and tap <strong className="text-gray-200">"Add to Home Screen"</strong> in the list.
                    </p>
                    <div className="ml-8">
                      <HelpImage
                        src="/help-images/ios-4.PNG"
                        alt="iOS Add to Home Screen option"
                      />
                    </div>
                  </div>

                  <div className="bg-rally-dark rounded-xl p-4 border border-gray-700">
                    <h4 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-rally-coral text-white text-sm flex items-center justify-center font-bold">5</span>
                      Tap "Add"
                    </h4>
                    <p className="text-gray-400 text-sm ml-8 mb-3">
                      Confirm by tapping <strong className="text-gray-200">"Add"</strong> in the top right corner.
                    </p>
                    <div className="ml-8">
                      <HelpImage
                        src="/help-images/ios-5.PNG"
                        alt="iOS Confirm Add button"
                      />
                    </div>
                  </div>

                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                    <p className="text-green-400 text-sm flex items-start gap-2">
                      <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        <strong>Done!</strong> Rally will now appear on your home screen and run in full-screen mode.
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* Android Instructions */}
              {installPlatform === 'android' && (
                <div className="space-y-4">
                  <div className="bg-rally-dark rounded-xl p-4 border border-gray-700">
                    <h4 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-rally-coral text-white text-sm flex items-center justify-center font-bold">1</span>
                      Open in Chrome
                    </h4>
                    <p className="text-gray-400 text-sm ml-8">
                      Open this site in <strong className="text-gray-200">Chrome</strong> for the best experience. Other browsers like Firefox and Edge also work.
                    </p>
                  </div>

                  <div className="bg-rally-dark rounded-xl p-4 border border-gray-700">
                    <h4 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-rally-coral text-white text-sm flex items-center justify-center font-bold">2</span>
                      Tap the Menu Button
                    </h4>
                    <p className="text-gray-400 text-sm ml-8 mb-3">
                      Tap the <strong className="text-gray-200">three dots menu</strong> in the top right corner of Chrome.
                    </p>
                    <div className="ml-8">
                      <HelpImage
                        src="/help-images/android-menu-button.png"
                        alt="Android Chrome menu button"
                        fallbackIcon={
                          <div className="bg-rally-darker rounded-lg p-4">
                            <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                            </svg>
                          </div>
                        }
                      />
                    </div>
                  </div>

                  <div className="bg-rally-dark rounded-xl p-4 border border-gray-700">
                    <h4 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-rally-coral text-white text-sm flex items-center justify-center font-bold">3</span>
                      Select "Add to Home screen" or "Install app"
                    </h4>
                    <p className="text-gray-400 text-sm ml-8 mb-3">
                      Look for <strong className="text-gray-200">"Add to Home screen"</strong> or <strong className="text-gray-200">"Install app"</strong> in the menu.
                    </p>
                    <div className="ml-8">
                      <HelpImage
                        src="/help-images/android-add-to-home.png"
                        alt="Android Add to Home screen option"
                        fallbackIcon={
                          <div className="bg-rally-darker rounded-lg p-3 flex items-center gap-3 max-w-[200px]">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span className="text-gray-200 text-sm">Add to Home screen</span>
                          </div>
                        }
                      />
                    </div>
                  </div>

                  <div className="bg-rally-dark rounded-xl p-4 border border-gray-700">
                    <h4 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-rally-coral text-white text-sm flex items-center justify-center font-bold">4</span>
                      Tap "Install" or "Add"
                    </h4>
                    <p className="text-gray-400 text-sm ml-8 mb-3">
                      Confirm by tapping <strong className="text-gray-200">"Install"</strong> or <strong className="text-gray-200">"Add"</strong>.
                    </p>
                    <div className="ml-8">
                      <HelpImage
                        src="/help-images/android-confirm-install.png"
                        alt="Android Confirm Install button"
                        fallbackIcon={
                          <div className="bg-rally-darker rounded-lg p-3 flex items-center justify-end gap-4 max-w-[200px]">
                            <span className="text-gray-400 text-sm">Cancel</span>
                            <span className="text-blue-400 text-sm font-medium">Install</span>
                          </div>
                        }
                      />
                    </div>
                  </div>

                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                    <p className="text-green-400 text-sm flex items-start gap-2">
                      <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        <strong>Done!</strong> Rally will now appear on your home screen and run in full-screen mode.
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tips' && (
            <div className="space-y-4">
              <div className="bg-rally-dark rounded-xl p-4 border border-gray-700">
                <h4 className="font-semibold text-gray-100 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-rally-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Check In to Sessions
                </h4>
                <p className="text-gray-400 text-sm">
                  Tap the "Check In" button on the Home page when there's an active session. Your spot is confirmed once you're checked in!
                </p>
              </div>

              <div className="bg-rally-dark rounded-xl p-4 border border-gray-700">
                <h4 className="font-semibold text-gray-100 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  Your Rating
                </h4>
                <p className="text-gray-400 text-sm">
                  Your rating updates after each game based on wins/losses and opponent skill. Check your profile to see your rating history!
                </p>
              </div>

              <div className="bg-rally-dark rounded-xl p-4 border border-gray-700">
                <h4 className="font-semibold text-gray-100 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Player Groups
                </h4>
                <p className="text-gray-400 text-sm">
                  Want to be on the same team as your friends? Create a player group and the team generator will try to keep you together.
                </p>
              </div>

              <div className="bg-rally-dark rounded-xl p-4 border border-gray-700">
                <h4 className="font-semibold text-gray-100 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Leaderboard
                </h4>
                <p className="text-gray-400 text-sm">
                  Check the Leaderboard to see how you rank against other players. Tap any player to see their profile and stats!
                </p>
              </div>

              <div className="bg-rally-dark rounded-xl p-4 border border-gray-700">
                <h4 className="font-semibold text-gray-100 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Session History
                </h4>
                <p className="text-gray-400 text-sm">
                  View all past sessions in the History tab. See game results, teams, and how your rating changed each session.
                </p>
              </div>

              <div className="bg-rally-dark rounded-xl p-4 border border-gray-700">
                <h4 className="font-semibold text-gray-100 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-rally-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  Dark Mode
                </h4>
                <p className="text-gray-400 text-sm">
                  Toggle between dark, light, and auto themes using the theme button in the header. Auto mode follows your system preference.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'faq' && (
            <div className="space-y-4">
              <details className="bg-rally-dark rounded-xl border border-gray-700 group">
                <summary className="p-4 cursor-pointer font-semibold text-gray-100 flex items-center justify-between">
                  How does the rating system work?
                  <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-4 pb-4 text-gray-400 text-sm border-t border-gray-700 pt-3">
                  We use an ELO rating system (similar to chess). Everyone starts at 1500. When you win against higher-rated opponents, you gain more points. Losing to lower-rated opponents costs more points. This keeps games competitive!
                </div>
              </details>

              <details className="bg-rally-dark rounded-xl border border-gray-700 group">
                <summary className="p-4 cursor-pointer font-semibold text-gray-100 flex items-center justify-between">
                  How are teams generated?
                  <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-4 pb-4 text-gray-400 text-sm border-t border-gray-700 pt-3">
                  Teams are balanced using a serpentine draft based on player ratings. The algorithm also considers player positions (setter, outside, etc.) to create well-rounded teams. Player groups are kept together when possible.
                </div>
              </details>

              <details className="bg-rally-dark rounded-xl border border-gray-700 group">
                <summary className="p-4 cursor-pointer font-semibold text-gray-100 flex items-center justify-between">
                  What if I can't make it after checking in?
                  <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-4 pb-4 text-gray-400 text-sm border-t border-gray-700 pt-3">
                  You can check out anytime before the session is locked by the admin. Just tap the "Check Out" button on the Home page. If you're on the waitlist, the next person will automatically get your spot.
                </div>
              </details>

              <details className="bg-rally-dark rounded-xl border border-gray-700 group">
                <summary className="p-4 cursor-pointer font-semibold text-gray-100 flex items-center justify-between">
                  How do I invite a guest?
                  <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-4 pb-4 text-gray-400 text-sm border-t border-gray-700 pt-3">
                  Admins can generate a QR code for guest check-ins. Your guest scans the code and enters their name - no account needed! Guests play at a default rating and their stats aren't tracked.
                </div>
              </details>

              <details className="bg-rally-dark rounded-xl border border-gray-700 group">
                <summary className="p-4 cursor-pointer font-semibold text-gray-100 flex items-center justify-between">
                  Can I join a team or tournament?
                  <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-4 pb-4 text-gray-400 text-sm border-t border-gray-700 pt-3">
                  Yes! Check the Teams and Tournaments tabs to browse existing teams and competitions. Team managers can invite you, or you can create your own team and register for tournaments.
                </div>
              </details>

              <details className="bg-rally-dark rounded-xl border border-gray-700 group">
                <summary className="p-4 cursor-pointer font-semibold text-gray-100 flex items-center justify-between">
                  How do I report a bug or suggest a feature?
                  <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-4 pb-4 text-gray-400 text-sm border-t border-gray-700 pt-3">
                  Use the feedback button (chat icon) in the header! You can report bugs, request features, or share any other feedback. We read every submission.
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
