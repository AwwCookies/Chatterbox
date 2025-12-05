import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { channelsApi } from '../../services/api';
import { MobileChannelCard, PullToRefresh } from '../../components/mobile';
import { Hash, Plus, X, Radio, RefreshCw } from 'lucide-react';
import LoadingSpinner from '../../components/common/LoadingSpinner';

function MobileChannels() {
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [addError, setAddError] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['channels'],
    queryFn: () => channelsApi.getAll().then(res => res.data),
  });

  const addMutation = useMutation({
    mutationFn: (name) => channelsApi.add(name),
    onSuccess: () => {
      queryClient.invalidateQueries(['channels']);
      setNewChannelName('');
      setShowAddChannel(false);
      setAddError('');
    },
    onError: (error) => {
      setAddError(error.response?.data?.error || 'Failed to add channel');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }) => channelsApi.update(id, { is_active: !isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries(['channels']);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => channelsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['channels']);
    },
  });

  const handleAddChannel = (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    setAddError('');
    addMutation.mutate(newChannelName.trim().replace('#', ''));
  };

  const handleToggle = (channel) => {
    toggleMutation.mutate({ id: channel.id, isActive: channel.is_active });
  };

  const handleDelete = (channel) => {
    if (confirm(`Are you sure you want to delete #${channel.name}?`)) {
      deleteMutation.mutate(channel.id);
    }
  };

  const handleRefresh = async () => {
    await refetch();
  };

  const channels = data?.channels || [];
  const activeChannels = channels.filter(c => c.is_active);
  const inactiveChannels = channels.filter(c => !c.is_active);

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)]">
      {/* Header */}
      <div className="px-4 py-3 bg-twitch-gray border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-twitch-purple" />
            <h1 className="text-lg font-bold text-white">Channels</h1>
          </div>
          <button
            onClick={() => setShowAddChannel(true)}
            className="flex items-center gap-2 px-4 py-2 bg-twitch-purple text-white rounded-lg font-medium active:bg-twitch-purple-dark"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
        
        {/* Stats */}
        <div className="flex gap-4 mt-3 text-sm">
          <span className="text-gray-400">
            <span className="text-white font-medium">{channels.length}</span> total
          </span>
          <span className="text-gray-400">
            <span className="text-green-400 font-medium">{activeChannels.length}</span> active
          </span>
          <span className="text-gray-400">
            <span className="text-gray-500 font-medium">{inactiveChannels.length}</span> inactive
          </span>
        </div>
      </div>

      {/* Add Channel Modal */}
      {showAddChannel && (
        <>
          <div 
            className="fixed inset-0 z-50 bg-black/60"
            onClick={() => setShowAddChannel(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-twitch-gray rounded-t-2xl safe-area-bottom animate-slide-up">
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>
            
            <div className="px-4 pb-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Add Channel</h2>
              <p className="text-sm text-gray-400 mt-1">Enter a Twitch channel name to start archiving</p>
            </div>

            <form onSubmit={handleAddChannel} className="p-4 space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Channel Name</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">#</span>
                  <input
                    type="text"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="channel_name"
                    className="w-full pl-8 pr-4 py-3 bg-twitch-dark border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-twitch-purple"
                    autoFocus
                  />
                </div>
                {addError && (
                  <p className="text-sm text-red-400 mt-2">{addError}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddChannel(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-700 text-white font-medium active:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newChannelName.trim() || addMutation.isPending}
                  className="flex-1 py-3 rounded-xl bg-twitch-purple text-white font-medium active:bg-twitch-purple-dark disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addMutation.isPending ? 'Adding...' : 'Add Channel'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Channels list */}
      <PullToRefresh onRefresh={handleRefresh} className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-400">
            <p>Error loading channels</p>
            <button onClick={() => refetch()} className="mt-2 text-twitch-purple">
              Try again
            </button>
          </div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Hash className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-center">No channels added yet</p>
            <button 
              onClick={() => setShowAddChannel(true)}
              className="mt-4 px-6 py-2 bg-twitch-purple text-white rounded-lg font-medium"
            >
              Add your first channel
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Active Channels */}
            {activeChannels.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-green-400" />
                  Active ({activeChannels.length})
                </h2>
                <div className="space-y-3">
                  {activeChannels.map(channel => (
                    <MobileChannelCard
                      key={channel.id}
                      channel={channel}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Inactive Channels */}
            {inactiveChannels.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Inactive ({inactiveChannels.length})
                </h2>
                <div className="space-y-3">
                  {inactiveChannels.map(channel => (
                    <MobileChannelCard
                      key={channel.id}
                      channel={channel}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading indicator */}
        {isFetching && !isLoading && (
          <div className="flex justify-center py-4">
            <RefreshCw className="w-5 h-5 text-twitch-purple animate-spin" />
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}

export default MobileChannels;
