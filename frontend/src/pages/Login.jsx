import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0A0118] via-[#1a0a2e] to-[#0A0118] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img src="/brand/migrahosting-icon.svg" alt="M" className="h-12 w-12" />
            <span className="text-2xl font-extrabold text-white">MigraHosting</span>
          </div>
          <p className="text-gray-400">Client Portal</p>
        </div>

        {/* Login Form */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 ring-1 ring-white/10">
          <h1 className="text-2xl font-bold text-white mb-6">Sign In</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#8A4DFF] focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#8A4DFF] focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-[#8A4DFF] to-[#6B2FD6] text-white font-semibold rounded-lg hover:from-[#9B5FFF] hover:to-[#7C3FE7] transition-all shadow-lg shadow-[#8A4DFF]/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/forgot-password" className="text-sm text-[#8A4DFF] hover:underline">
              Forgot your password?
            </Link>
          </div>
        </div>

        {/* Back to website */}
        <div className="mt-6 text-center">
          <a href="http://localhost:5173" className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Back to MigraHosting.com
          </a>
        </div>
      </div>
    </div>
  );
}
