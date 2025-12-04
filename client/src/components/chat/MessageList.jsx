import MessageItem from './MessageItem';
import LoadingSpinner from '../common/LoadingSpinner';

function MessageList({ 
  messages = [], 
  isLoading, 
  error, 
  showChannel = true,
  emptyMessage = 'No messages found' 
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
        Error loading messages: {error.message}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-700">
      {messages.map((message, index) => (
        <MessageItem 
          key={message.id || index} 
          message={message} 
          showChannel={showChannel}
          channelId={message.channel_twitch_id}
        />
      ))}
    </div>
  );
}

export default MessageList;
