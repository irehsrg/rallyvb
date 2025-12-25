import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type SkillLevel = 'beginner' | 'casual' | 'regular' | 'experienced' | 'advanced';

const SKILL_LEVELS: { value: SkillLevel; label: string }[] = [
  { value: 'beginner', label: 'Just learning / New to volleyball' },
  { value: 'casual', label: 'Casual player / Know the basics' },
  { value: 'regular', label: 'Regular player / Comfortable in games' },
  { value: 'experienced', label: 'Experienced / Played competitively' },
  { value: 'advanced', label: 'Advanced / Tournament level' },
];

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('regular');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signUp(email, password, name, skillLevel);
      navigate('/home');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-rally-darker px-4 py-12 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-rally-coral/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-rally-accent/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Logo and header */}
        <div className="text-center animate-fade-in">
          <img
            src="/RallyIcon.png"
            alt="Rally"
            className="w-24 h-24 mx-auto mb-6 rounded-3xl shadow-2xl shadow-rally-coral/50"
          />
          <h2 className="text-4xl font-bold text-gradient-rally mb-2">
            Join Rally
          </h2>
          <p className="text-gray-400 text-lg">
            Create your account and start playing
          </p>
        </div>

        {/* Signup form */}
        <form className="mt-8 space-y-6 card-glass p-8 animate-slide-up" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl animate-fade-in">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                Display Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-modern w-full"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-modern w-full"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-modern w-full"
                placeholder="••••••••"
              />
              <p className="mt-2 text-sm text-gray-500">
                Must be at least 6 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                How would you describe your volleyball experience?
              </label>
              <div className="space-y-2">
                {SKILL_LEVELS.map((level) => (
                  <label
                    key={level.value}
                    className={`flex items-center p-3 rounded-xl cursor-pointer transition-all border-2 ${
                      skillLevel === level.value
                        ? 'bg-rally-coral/20 border-rally-coral/50 text-gray-100'
                        : 'bg-rally-dark/50 border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    <input
                      type="radio"
                      name="skillLevel"
                      value={level.value}
                      checked={skillLevel === level.value}
                      onChange={(e) => setSkillLevel(e.target.value as SkillLevel)}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                      skillLevel === level.value
                        ? 'border-rally-coral bg-rally-coral'
                        : 'border-gray-500'
                    }`}>
                      {skillLevel === level.value && (
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                      )}
                    </div>
                    <span className="text-sm">{level.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Create account'
              )}
            </button>
          </div>

          <div className="text-center pt-2">
            <Link
              to="/login"
              className="text-rally-coral hover:text-rally-accent transition-colors duration-200 font-medium"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </form>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm">
          Manage sessions • Track ratings • Build teams
        </p>
      </div>
    </div>
  );
}
