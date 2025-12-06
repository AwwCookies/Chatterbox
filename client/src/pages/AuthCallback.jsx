import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader2, AlertCircle } from 'lucide-react';

/**
 * OAuth callback page - handles the redirect from Twitch OAuth
 * Receives tokens in URL params and completes authentication
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { handleAuthCallback } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    const returnUrl = searchParams.get('returnUrl') || '/following';
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(decodeURIComponent(errorParam).replace(/_/g, ' '));
      return;
    }

    if (!accessToken || !refreshToken) {
      setError('Missing authentication tokens');
      return;
    }

    // Complete authentication
    handleAuthCallback(accessToken, refreshToken, returnUrl)
      .then((redirectUrl) => {
        navigate(redirectUrl, { replace: true });
      })
      .catch((err) => {
        setError(err.message || 'Authentication failed');
      });
  }, [searchParams, handleAuthCallback, navigate]);

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md w-full bg-red-500/10 border border-red-500/50 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div>
              <h2 className="text-lg font-semibold text-red-400">Authentication Failed</h2>
              <p className="text-red-300 mt-2">{error}</p>
              <button
                onClick={() => navigate('/login')}
                className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-twitch-purple animate-spin mx-auto" />
        <p className="text-gray-400 mt-4">Completing sign in...</p>
      </div>
    </div>
  );
}
