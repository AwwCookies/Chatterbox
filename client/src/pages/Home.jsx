import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { statsApi } from '../services/api';
import { useRecentModActions } from '../hooks/useModActions';
import { MessageSquare, Users, Hash, Radio, Shield } from 'lucide-react';
import { formatNumber } from '../utils/formatters';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ModActionList from '../components/moderation/ModActionList';

function StatCard({ icon: Icon, label, value, color = 'text-twitch-purple' }) {
  return (
    <div className="bg-twitch-gray rounded-lg p-6 border border-gray-700">
      <div className="flex items-center space-x-4">
        <div className={`p-3 rounded-lg bg-gray-700 ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">{formatNumber(value)}</p>
          <p className="text-sm text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

function Home() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => statsApi.getOverview().then(res => res.data),
    refetchInterval: 30000,
  });

  const { data: modActionsData, isLoading: modActionsLoading } = useRecentModActions(10);

  if (statsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Overview of your Twitch chat archive</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={MessageSquare} 
          label="Total Messages" 
          value={stats?.totalMessages || 0}
        />
        <StatCard 
          icon={Users} 
          label="Total Users" 
          value={stats?.totalUsers || 0}
          color="text-blue-400"
        />
        <StatCard 
          icon={Hash} 
          label="Active Channels" 
          value={stats?.activeChannels || 0}
          color="text-green-400"
        />
        <StatCard 
          icon={Radio} 
          label="Connected Clients" 
          value={stats?.connectedClients || 0}
          color="text-yellow-400"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-twitch-gray rounded-lg border border-gray-700">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center">
              <Shield className="w-5 h-5 mr-2 text-red-400" />
              Recent Mod Actions
            </h2>
            <Link 
              to="/moderation"
              className="text-sm text-twitch-purple hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <ModActionList 
              actions={modActionsData?.actions || []}
              isLoading={modActionsLoading}
              emptyMessage="No recent mod actions"
            />
          </div>
        </div>

        <div className="bg-twitch-gray rounded-lg border border-gray-700">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center">
              <Radio className="w-5 h-5 mr-2 text-green-400" />
              Quick Links
            </h2>
          </div>
          <div className="p-4 space-y-3">
            <Link 
              to="/live"
              className="block p-4 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Radio className="w-5 h-5 text-green-400" />
                <div>
                  <p className="font-medium text-white">Live Feed</p>
                  <p className="text-sm text-gray-400">Watch messages in real-time</p>
                </div>
              </div>
            </Link>

            <Link 
              to="/messages"
              className="block p-4 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <MessageSquare className="w-5 h-5 text-twitch-purple" />
                <div>
                  <p className="font-medium text-white">Search Messages</p>
                  <p className="text-sm text-gray-400">Browse and search archived messages</p>
                </div>
              </div>
            </Link>

            <Link 
              to="/channels"
              className="block p-4 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Hash className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="font-medium text-white">Manage Channels</p>
                  <p className="text-sm text-gray-400">Add or remove monitored channels</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Archive Status */}
      {stats?.archiveBuffer && (
        <div className="bg-twitch-gray rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Archive Status</h3>
          <div className="flex items-center space-x-4">
            <div className={`w-2 h-2 rounded-full ${
              stats.archiveBuffer.bufferedMessages > 0 ? 'bg-yellow-500' : 'bg-green-500'
            }`} />
            <span className="text-sm text-white">
              {stats.archiveBuffer.bufferedMessages} messages in buffer
              {stats.archiveBuffer.isProcessing && ' (processing...)'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
