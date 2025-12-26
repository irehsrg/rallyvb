import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
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
            Reset Password
          </h2>
          <p className="text-gray-400 text-lg">
            Enter your email to receive a reset link
          </p>
        </div>

        {success ? (
          <div className="card-glass p-8 animate-slide-up text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-100 mb-2">Check your email</h3>
            <p className="text-gray-400 mb-6">
              We've sent a password reset link to <span className="text-rally-coral">{email}</span>
            </p>
            <p className="text-sm text-gray-500 mb-6">
              If you don't see the email, check your spam folder.
            </p>
            <Link
              to="/login"
              className="btn-primary inline-block"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6 card-glass p-8 animate-slide-up" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl animate-fade-in">
                {error}
              </div>
            )}

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
                    Sending...
                  </span>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </div>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="text-rally-coral hover:text-rally-accent transition-colors duration-200 font-medium"
              >
                Back to Login
              </Link>
            </div>
          </form>
        )}

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm">
          Remember your password?{' '}
          <Link to="/login" className="text-rally-coral hover:text-rally-accent">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
