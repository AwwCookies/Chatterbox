import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { channelsApi } from '../services/api';
import { formatNumber, formatDateTime } from '../utils/formatters';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Hash, Plus, Trash2, RefreshCw, Power, PowerOff, MessageSquare, ExternalLink } from 'lucide-react';

function Channels() {
  const [newChannelName, setNewChannelName] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['channels'],
    queryFn: () => channelsApi.getAll().then(res => res.data),
  });

  const addChannelMutation = useMutation({
    mutationFn: (name) => channelsApi.create(name),
    onSuccess: () => {
      queryClient.invalidateQueries(['channels']);
      setNewChannelName('');
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Failed to add channel');
    },
  });

  const updateChannelMutation = useMutation({
    mutationFn: ({ name, is_active }) => channelsApi.update(name, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries(['channels']);
    },
  });

  const deleteChannelMutation = useMutation({
    mutationFn: (name) => channelsApi.delete(name),
    onSuccess: () => {
      queryClient.invalidateQueries(['channels']);
    },
  });

  const rejoinChannelMutation = useMutation({
    mutationFn: (name) => channelsApi.rejoin(name),
    onSuccess: () => {
      queryClient.invalidateQueries(['channels']);
    },
  });

  const handleAddChannel = (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    addChannelMutation.mutate(newChannelName.trim());
  };

  const channels = data?.channels || [];
  const activeChannels = channels.filter(c => c.is_active);
  const inactiveChannels = channels.filter(c => !c.is_active);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center">
          <Hash className="w-6 h-6 mr-2 text-blue-400" />
          Channels
        </h1>
        <p className="text-gray-400">Manage monitored Twitch channels</p>
      </div>

      {/* Add Channel */}
      <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Add New Channel</h3>
        <form onSubmit={handleAddChannel} className="flex gap-3">
          <div className="flex-1 relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="Channel name"
              className="w-full bg-twitch-dark border border-gray-600 rounded-md py-2 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none focus:border-twitch-purple"
            />
          </div>
          <button
            type="submit"
            disabled={addChannelMutation.isLoading || !newChannelName.trim()}
            className="px-4 py-2 bg-twitch-purple text-white rounded-md hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>
        </form>
        {error && (
          <p className="mt-2 text-sm text-red-400">{error}</p>
        )}
      </div>

      {/* Active Channels */}
      <div className="bg-twitch-gray rounded-lg border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white flex items-center">
            <Power className="w-5 h-5 mr-2 text-green-400" />
            Active Channels ({activeChannels.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-700">
          {activeChannels.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              No active channels
            </div>
          ) : (
            activeChannels.map(channel => (
              <ChannelRow 
                key={channel.id}
                channel={channel}
                onToggle={() => updateChannelMutation.mutate({ name: channel.name, is_active: false })}
                onRejoin={() => rejoinChannelMutation.mutate(channel.name)}
                onDelete={() => deleteChannelMutation.mutate(channel.name)}
                isUpdating={updateChannelMutation.isLoading || rejoinChannelMutation.isLoading}
              />
            ))
          )}
        </div>
      </div>

      {/* Inactive Channels */}
      {inactiveChannels.length > 0 && (
        <div className="bg-twitch-gray rounded-lg border border-gray-700">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white flex items-center">
              <PowerOff className="w-5 h-5 mr-2 text-gray-400" />
              Inactive Channels ({inactiveChannels.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-700">
            {inactiveChannels.map(channel => (
              <ChannelRow 
                key={channel.id}
                channel={channel}
                onToggle={() => updateChannelMutation.mutate({ name: channel.name, is_active: true })}
                onDelete={() => deleteChannelMutation.mutate(channel.name)}
                isUpdating={updateChannelMutation.isLoading}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChannelRow({ channel, onToggle, onRejoin, onDelete, isUpdating }) {
  return (
    <div className="p-4 flex items-center justify-between hover:bg-gray-800/50">
      <div className="flex items-center space-x-4">
        <div className={`w-2 h-2 rounded-full ${channel.is_active ? 'bg-green-500' : 'bg-gray-500'}`} />
        <div>
          <Link 
            to={`/channel/${channel.name}`}
            className="font-medium text-white hover:text-twitch-purple hover:underline flex items-center space-x-1"
          >
            <span>#{channel.display_name || channel.name}</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
          <div className="flex items-center space-x-3 text-xs text-gray-400 mt-1">
            <span className="flex items-center">
              <MessageSquare className="w-3 h-3 mr-1" />
              {formatNumber(channel.message_count || 0)} messages
            </span>
            <span>Added {formatDateTime(channel.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {channel.is_active && onRejoin && (
          <button
            onClick={onRejoin}
            disabled={isUpdating}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-md disabled:opacity-50"
            title="Rejoin channel"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
        
        <button
          onClick={onToggle}
          disabled={isUpdating}
          className={`p-2 rounded-md disabled:opacity-50 ${
            channel.is_active 
              ? 'text-yellow-400 hover:bg-yellow-400/10' 
              : 'text-green-400 hover:bg-green-400/10'
          }`}
          title={channel.is_active ? 'Deactivate' : 'Activate'}
        >
          {channel.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
        </button>

        <button
          onClick={onDelete}
          disabled={isUpdating}
          className="p-2 text-red-400 hover:bg-red-400/10 rounded-md disabled:opacity-50"
          title="Remove channel"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default Channels;
