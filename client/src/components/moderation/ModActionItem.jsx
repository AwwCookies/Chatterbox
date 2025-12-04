import { Link } from 'react-router-dom';
import { formatDateTime, formatDuration, getActionClass, capitalize } from '../../utils/formatters';

function ModActionItem({ action }) {
  return (
    <div className="p-3 border-b border-gray-700 hover:bg-gray-800/50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <span className={`badge ${getActionClass(action.action_type)}`}>
              {capitalize(action.action_type)}
            </span>
            
            {action.channel_name && (
              <span className="text-xs text-twitch-purple">
                #{action.channel_name}
              </span>
            )}

            <span className="text-xs text-gray-400">
              {formatDateTime(action.timestamp)}
            </span>
          </div>

          <div className="text-sm text-white">
            <Link 
              to={`/user/${action.target_username}`}
              className="text-red-400 hover:underline font-medium"
            >
              {action.target_username}
            </Link>
            
            {action.action_type === 'timeout' && action.duration_seconds && (
              <span className="text-gray-400">
                {' '}for {formatDuration(action.duration_seconds)}
              </span>
            )}

            {action.moderator_username && (
              <span className="text-gray-400">
                {' '}by{' '}
                <Link 
                  to={`/user/${action.moderator_username}`}
                  className="text-green-400 hover:underline"
                >
                  {action.moderator_username}
                </Link>
              </span>
            )}
          </div>

          {action.reason && (
            <p className="text-xs text-gray-400 mt-1">
              Reason: {action.reason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ModActionItem;
