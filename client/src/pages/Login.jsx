import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Twitch, AlertCircle, Loader2, LogIn, Shield, Download, Trash2, Lock } from 'lucide-react';
import api from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, getLoginUrl, isLoading } = useAuth();
  const [error, setError] = useState(null);
  const [requireAuth, setRequireAuth] = useState(false);

  useEffect(() => {
    // Check if auth is required
    api.get('/settings/require-auth')
      .then(data => setRequireAuth(data.requireAuth))
      .catch(() => setRequireAuth(false));
  }, []);

  useEffect(() => {
    // If already logged in, redirect to home
    if (isAuthenticated) {
      navigate('/');
      return;
    }

    // Check for error from OAuth callback
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam).replace(/_/g, ' '));
    }
  }, [isAuthenticated, navigate, searchParams]);

  const handleLogin = () => {
    const returnUrl = searchParams.get('returnUrl') || '/following';
    window.location.href = getLoginUrl(returnUrl);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-twitch-purple rounded-full">
              <Twitch className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">Sign in to Chatterbox</h1>
          <p className="mt-2 text-gray-400">
            Connect your Twitch account to access personalized features
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Login failed</p>
              <p className="text-red-300 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Login button */}
        <div className="bg-twitch-gray rounded-lg p-6 border border-gray-700">
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-twitch-purple hover:bg-twitch-purple-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Twitch className="w-5 h-5" />
            )}
            Continue with Twitch
          </button>

          <p className="text-xs text-gray-500 mt-4 text-center">
            We'll request access to your followed channels to show you live streams
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-gray-400 text-center">
            What you can do with an account
          </h2>
          
          <div className="grid gap-3">
            <div className="flex items-start gap-3 bg-gray-800/50 rounded-lg p-4">
              <div className="p-2 bg-twitch-purple/20 rounded-lg">
                <LogIn className="w-4 h-4 text-twitch-purple" />
              </div>
              <div>
                <p className="text-white font-medium">See Live Followed Streams</p>
                <p className="text-sm text-gray-400">View which streamers you follow are currently live</p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-gray-800/50 rounded-lg p-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Download className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-white font-medium">Export Your Data</p>
                <p className="text-sm text-gray-400">Request a copy of all your archived messages</p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-gray-800/50 rounded-lg p-4">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <Trash2 className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <p className="text-white font-medium">Delete Your Data</p>
                <p className="text-sm text-gray-400">Request deletion of all your archived chat history</p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-gray-800/50 rounded-lg p-4">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Shield className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-white font-medium">Privacy Controls</p>
                <p className="text-sm text-gray-400">Manage your data and privacy preferences</p>
              </div>
            </div>
          </div>
        </div>

        {/* Back link or auth required notice */}
        <div className="text-center">
          {requireAuth ? (
            <div className="flex items-center justify-center gap-2 text-amber-400 text-sm">
              <Lock className="w-4 h-4" />
              <span>Login required to access this server</span>
            </div>
          ) : (
            <Link to="/" className="text-gray-400 hover:text-white text-sm">
              ← Continue without signing in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
