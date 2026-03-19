import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Trophy, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const LoginPage: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const [accessCode, setAccessCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);

  // Already logged in
  if (isAuthenticated) {
    navigate(from, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) {
      toast.error('Please enter your access code.');
      return;
    }

    setLoading(true);
    try {
      await login(accessCode.trim());
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Invalid access code. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, var(--gray-900) 0%, #1a1f4e 50%, #2d1040 100%)',
      }}
    >
      {/* Back link */}
      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm font-medium transition-colors"
        style={{ color: 'rgba(255,255,255,.6)' }}
        onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#fff')}
        onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'rgba(255,255,255,.6)')}
      >
        <ArrowLeft size={16} />
        Back to Events
      </Link>

      <div className="w-full max-w-md">
        {/* Card */}
        <div
          className="rounded-2xl p-8 md:p-10"
          style={{
            background: 'rgba(255,255,255,.97)',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--gradient)' }}
            >
              <Trophy size={28} color="#fff" />
            </div>
            <h1 className="text-2xl font-extrabold" style={{ color: 'var(--gray-900)' }}>
              Organization Login
            </h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--gray-500)' }}>
              Enter your access code to manage events
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--gray-700)' }}>
                Access Code
              </label>
              <div className="relative">
                <input
                  type={showCode ? 'text' : 'password'}
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="Enter your organization access code"
                  className="form-input pr-12"
                  autoFocus
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors"
                  style={{ color: 'var(--gray-400)' }}
                  onClick={() => setShowCode(!showCode)}
                  tabIndex={-1}
                >
                  {showCode ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-gradient w-full justify-center py-3 text-base"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing In…
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Info */}
          <div
            className="mt-6 p-4 rounded-xl text-sm"
            style={{ background: 'var(--gray-50)', color: 'var(--gray-600)' }}
          >
            <p className="font-semibold mb-1" style={{ color: 'var(--gray-700)' }}>
              Don't have an access code?
            </p>
            <p>
              Contact the{' '}
              <a
                href="mailto:sports@gov.bm"
                className="font-medium"
                style={{ color: 'var(--blue)' }}
              >
                Department of Sports &amp; Recreation
              </a>{' '}
              to register your organization.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
