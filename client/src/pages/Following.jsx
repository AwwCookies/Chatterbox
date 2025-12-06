import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { 
  Radio, 
  Eye, 
  Clock, 
  Gamepad2, 
  Users, 
  RefreshCw, 
  Loader2,
  AlertCircle,
  LogIn,
  ExternalLink
} from 'lucide-react';

// Format viewer count
const formatViewers = (count) => {
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
  return count.toString();
};

// Format uptime
const formatUptime = (startedAt) => {
  const start = new Date(startedAt);
  const now = new Date();
  const diffMs = now - start;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

function StreamCard({ stream }) {
  const watchUrl = `/watch/${stream.userLogin}`;
  const twitchUrl = `https://twitch.tv/${stream.userLogin}`;
  
  return (
    <div className="bg-twitch-gray rounded-lg overflow-hidden border border-gray-700 hover:border-twitch-purple/50 transition-colors group">
      {/* Thumbnail - links to our Watch page */}
      <Link to={watchUrl} className="block relative">
        <img
          src={stream.thumbnailUrl}
          alt={stream.title}
          className="w-full aspect-video object-cover"
        />
        {/* Live indicator */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-red-600 text-white text-xs font-bold rounded">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
          LIVE
        </div>
        {/* Viewer count */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 bg-black/70 text-white text-xs rounded">
          <Eye className="w-3 h-3" />
          {formatViewers(stream.viewerCount)}
        </div>
        {/* Uptime */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 bg-black/70 text-white text-xs rounded">
          <Clock className="w-3 h-3" />
          {formatUptime(stream.startedAt)}
        </div>
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-twitch-purple/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Radio className="w-8 h-8 text-white" />
        </div>
      </Link>
      
      {/* Info */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Channel name and title */}
          <div className="flex-1 min-w-0">
            <Link 
              to={watchUrl}
              className="font-semibold text-white hover:text-twitch-purple transition-colors block truncate"
            >
              {stream.userDisplayName}
            </Link>
            <p className="text-sm text-gray-400 truncate mt-1" title={stream.title}>
              {stream.title}
            </p>
          </div>
        </div>
        
        {/* Game */}
        {stream.gameName && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
            <Gamepad2 className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{stream.gameName}</span>
          </div>
        )}
        
        {/* Tags */}
        {stream.tags && stream.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {stream.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        
        {/* Actions */}
        <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between">
          <Link
            to={`/channel/${stream.userLogin}`}
            className="text-xs text-twitch-purple hover:underline"
          >
            View chat logs →
          </Link>
          <a
            href={twitchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-gray-400 flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            Twitch
          </a>
        </div>
      </div>
    </div>
  );
}

export default function Following() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const { 
    data, 
    isLoading, 
    error, 
    refetch, 
    isFetching 
  } = useQuery({
    queryKey: ['followed-streams'],
    queryFn: async () => {
      const response = await authApi.getFollowedStreams();
      return response.data;
    },
    enabled: isAuthenticated,
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });

  // Not logged in
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="p-4 bg-twitch-purple/20 rounded-full w-fit mx-auto mb-4">
            <LogIn className="w-12 h-12 text-twitch-purple" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Sign in Required</h1>
          <p className="text-gray-400 mb-6">
            Connect your Twitch account to see which streamers you follow are currently live.
          </p>
          <button
            onClick={() => navigate('/login?returnUrl=/following')}
            className="px-6 py-3 bg-twitch-purple hover:bg-twitch-purple-dark text-white font-semibold rounded-lg transition-colors"
          >
            Sign in with Twitch
          </button>
        </div>
      </div>
    );
  }

  // Loading
  if (isLoading || authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-twitch-purple animate-spin" />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6 max-w-md">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div>
              <h2 className="text-lg font-semibold text-red-400">Failed to load streams</h2>
              <p className="text-red-300 mt-2">
                {error.response?.data?.error || error.message || 'Something went wrong'}
              </p>
              <button
                onClick={() => refetch()}
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

  const streams = data?.streams || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Radio className="w-7 h-7 text-red-500" />
            Following - Live
          </h1>
          <p className="text-gray-400 mt-1">
            {streams.length === 0 
              ? 'None of your followed channels are live' 
              : `${streams.length} channel${streams.length === 1 ? '' : 's'} live`}
          </p>
        </div>
        
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stream Grid */}
      {streams.length === 0 ? (
        <div className="bg-twitch-gray rounded-lg p-12 text-center border border-gray-700">
          <div className="p-4 bg-gray-800 rounded-full w-fit mx-auto mb-4">
            <Users className="w-12 h-12 text-gray-500" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">No Live Streams</h2>
          <p className="text-gray-400 max-w-md mx-auto">
            None of the channels you follow on Twitch are currently streaming. 
            Check back later or explore the channels being logged.
          </p>
          <Link
            to="/channels"
            className="inline-block mt-6 px-6 py-3 bg-twitch-purple hover:bg-twitch-purple-dark text-white font-medium rounded-lg transition-colors"
          >
            Browse Logged Channels
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {streams.map((stream) => (
            <StreamCard key={stream.id} stream={stream} />
          ))}
        </div>
      )}
    </div>
  );
}
