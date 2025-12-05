import { useNavigate } from 'react-router-dom';
import { Ban, Timer, Trash2, Eraser, MessageSquare, ChevronRight } from 'lucide-react';
import { formatRelative, formatDuration } from '../../utils/formatters';
import { useState, useRef, useEffect } from 'react';

const actionConfig = {
  ban: { icon: Ban, color: 'text-red-500', bgColor: 'bg-red-500/20', label: 'Ban' },
  timeout: { icon: Timer, color: 'text-yellow-500', bgColor: 'bg-yellow-500/20', label: 'Timeout' },
  delete: { icon: Trash2, color: 'text-orange-500', bgColor: 'bg-orange-500/20', label: 'Delete' },
  clear: { icon: Eraser, color: 'text-blue-500', bgColor: 'bg-blue-500/20', label: 'Clear' },
  default: { icon: MessageSquare, color: 'text-gray-400', bgColor: 'bg-gray-500/20', label: 'Action' },
};

function MobileModActionCard({ action, showChannel = true }) {
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);
  const detailsRef = useRef(null);

  const config = actionConfig[action.action_type] || actionConfig.default;
  const Icon = config.icon;

  // Close details when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (detailsRef.current && !detailsRef.current.contains(e.target)) {
        setShowDetails(false);
      }
    };

    if (showDetails) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showDetails]);

  return (
    <>
      <div
        onClick={() => setShowDetails(true)}
        className="flex items-start gap-3 p-3 border-b border-gray-700/50 active:bg-gray-800/50"
      >
        {/* Action icon */}
        <div className={`p-2 rounded-lg ${config.bgColor} ${config.color} flex-shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${config.bgColor} ${config.color}`}>
              {config.label}
            </span>
            {action.duration_seconds && (
              <span className="text-xs text-gray-400">
                {formatDuration(action.duration_seconds)}
              </span>
            )}
          </div>

          <p className="text-sm text-white mt-1">
            <span className="font-medium">{action.target_username || action.target_display_name}</span>
            <span className="text-gray-400"> by </span>
            <span className="text-twitch-purple">{action.moderator_username || action.moderator_display_name}</span>
          </p>

          {action.reason && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-1">
              {action.reason}
            </p>
          )}

          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            <span>{formatRelative(action.timestamp)}</span>
            {showChannel && action.channel_name && (
              <>
                <span>•</span>
                <span>#{action.channel_name}</span>
              </>
            )}
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
      </div>

      {/* Details Sheet */}
      {showDetails && (
        <>
          <div 
            className="fixed inset-0 z-50 bg-black/60"
            onClick={() => setShowDetails(false)}
          />
          
          <div 
            ref={detailsRef}
            className="fixed bottom-0 left-0 right-0 z-50 bg-twitch-gray rounded-t-2xl safe-area-bottom animate-slide-up max-h-[80vh] overflow-y-auto"
          >
            <div className="flex justify-center py-3 sticky top-0 bg-twitch-gray">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>

            {/* Header */}
            <div className="px-4 pb-4 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${config.bgColor} ${config.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white capitalize">{action.action_type}</h3>
                  <p className="text-sm text-gray-400">{formatRelative(action.timestamp)}</p>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="p-4 space-y-4">
              {/* Target */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Target User</label>
                <button
                  onClick={() => {
                    navigate(`/user/${action.target_username}`);
                    setShowDetails(false);
                  }}
                  className="w-full flex items-center justify-between p-3 mt-1 rounded-xl bg-gray-800 active:bg-gray-700"
                >
                  <span className="text-white font-medium">
                    {action.target_display_name || action.target_username}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Moderator */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Moderator</label>
                <button
                  onClick={() => {
                    navigate(`/user/${action.moderator_username}`);
                    setShowDetails(false);
                  }}
                  className="w-full flex items-center justify-between p-3 mt-1 rounded-xl bg-gray-800 active:bg-gray-700"
                >
                  <span className="text-twitch-purple font-medium">
                    {action.moderator_display_name || action.moderator_username}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Channel */}
              {action.channel_name && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Channel</label>
                  <button
                    onClick={() => {
                      navigate(`/channel/${action.channel_name}`);
                      setShowDetails(false);
                    }}
                    className="w-full flex items-center justify-between p-3 mt-1 rounded-xl bg-gray-800 active:bg-gray-700"
                  >
                    <span className="text-white font-medium">#{action.channel_name}</span>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              )}

              {/* Duration */}
              {action.duration_seconds && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Duration</label>
                  <p className="text-white mt-1 p-3 rounded-xl bg-gray-800">
                    {formatDuration(action.duration_seconds)}
                  </p>
                </div>
              )}

              {/* Reason */}
              {action.reason && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Reason</label>
                  <p className="text-white mt-1 p-3 rounded-xl bg-gray-800">
                    {action.reason}
                  </p>
                </div>
              )}

              {/* Timestamp */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Exact Time</label>
                <p className="text-white mt-1 p-3 rounded-xl bg-gray-800">
                  {new Date(action.timestamp).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Close button */}
            <div className="p-4 border-t border-gray-700">
              <button
                onClick={() => setShowDetails(false)}
                className="w-full py-3 rounded-xl bg-gray-700 text-white font-medium active:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default MobileModActionCard;
