import { useNavigate } from 'react-router-dom';
import { Radio, MessageSquare, Users, ChevronRight, MoreVertical } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { formatNumber } from '../../utils/formatters';

function MobileChannelCard({ channel, stats = {}, onToggle, onDelete }) {
  const navigate = useNavigate();
  const [showActions, setShowActions] = useState(false);
  const actionsRef = useRef(null);

  const handleClick = () => {
    navigate(`/channel/${channel.name}`);
  };

  const handleActionsClick = (e) => {
    e.stopPropagation();
    setShowActions(true);
  };

  // Close actions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target)) {
        setShowActions(false);
      }
    };

    if (showActions) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showActions]);

  return (
    <>
      <div
        onClick={handleClick}
        className="flex items-center gap-3 p-4 bg-twitch-gray rounded-xl border border-gray-700 active:bg-gray-700 transition-colors"
      >
        {/* Avatar / Status indicator */}
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-twitch-purple font-bold text-lg">
            {(channel.display_name || channel.name).charAt(0).toUpperCase()}
          </div>
          {channel.is_active && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-twitch-gray" />
          )}
        </div>

        {/* Channel info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white truncate">
              {channel.display_name || channel.name}
            </h3>
            {channel.is_active && (
              <Radio className="w-4 h-4 text-green-500 flex-shrink-0" />
            )}
          </div>
          
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            {stats.messages !== undefined && (
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {formatNumber(stats.messages)}
              </span>
            )}
            {stats.users !== undefined && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {formatNumber(stats.users)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={handleActionsClick}
          className="p-2 -mr-2 text-gray-400 active:text-white rounded-lg"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* Action Sheet */}
      {showActions && (
        <>
          <div 
            className="fixed inset-0 z-50 bg-black/60"
            onClick={() => setShowActions(false)}
          />
          
          <div 
            ref={actionsRef}
            className="fixed bottom-0 left-0 right-0 z-50 bg-twitch-gray rounded-t-2xl safe-area-bottom animate-slide-up"
          >
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>

            <div className="px-4 pb-3 border-b border-gray-700">
              <p className="font-semibold text-white">
                #{channel.display_name || channel.name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {channel.is_active ? 'Currently active' : 'Inactive'}
              </p>
            </div>

            <div className="py-2">
              <button
                onClick={() => {
                  navigate(`/channel/${channel.name}`);
                  setShowActions(false);
                }}
                className="w-full flex items-center gap-4 px-4 py-3 text-white active:bg-gray-700"
              >
                <ChevronRight className="w-5 h-5 text-gray-400" />
                <span>View channel</span>
              </button>

              {onToggle && (
                <button
                  onClick={() => {
                    onToggle(channel);
                    setShowActions(false);
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3 text-white active:bg-gray-700"
                >
                  <Radio className={`w-5 h-5 ${channel.is_active ? 'text-yellow-400' : 'text-green-400'}`} />
                  <span>{channel.is_active ? 'Deactivate channel' : 'Activate channel'}</span>
                </button>
              )}

              {onDelete && (
                <button
                  onClick={() => {
                    onDelete(channel);
                    setShowActions(false);
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3 text-red-400 active:bg-gray-700"
                >
                  <span className="w-5 h-5">🗑️</span>
                  <span>Delete channel</span>
                </button>
              )}
            </div>

            <div className="p-4 border-t border-gray-700">
              <button
                onClick={() => setShowActions(false)}
                className="w-full py-3 rounded-xl bg-gray-700 text-white font-medium active:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default MobileChannelCard;
