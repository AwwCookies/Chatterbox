import ModActionCard from './ModActionCard';
import LoadingSpinner from '../common/LoadingSpinner';

function ModActionList({ 
  actions = [], 
  isLoading, 
  error,
  emptyMessage = 'No moderation actions found',
  expandFirst = false,
  compact = false
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-400">
        Error loading mod actions: {error.message}
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      {actions.map((action, index) => (
        <ModActionCard 
          key={action.id || index} 
          action={action}
          expanded={expandFirst && index === 0}
        />
      ))}
    </div>
  );
}

export default ModActionList;
