import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Server, FileText, Settings, Activity, Shield, Users, Webhook, Crown, BarChart3 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import ServerStatusTab from '../components/admin/ServerStatusTab';
import ServerSettingsTab from '../components/admin/ServerSettingsTab';
import TrafficAnalyticsTab from '../components/admin/TrafficAnalyticsTab';
import IpManagementTab from '../components/admin/IpManagementTab';
import UserRequestsTab from '../components/admin/UserRequestsTab';
import UserManagementTab from '../components/admin/UserManagementTab';
import AdminWebhooksTab from '../components/admin/AdminWebhooksTab';
import TiersManagement from '../components/admin/TiersManagement';
import UsageAnalytics from '../components/admin/UsageAnalytics';

const tabs = [
  { id: 'status', label: 'Server Status', icon: Server },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'traffic', label: 'Traffic Analytics', icon: Activity },
  { id: 'usage', label: 'API Usage', icon: BarChart3 },
  { id: 'ip-management', label: 'IP Management', icon: Shield },
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'tiers', label: 'Tiers', icon: Crown },
  { id: 'requests', label: 'User Requests', icon: FileText },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
];

function ServerAdmin() {
  const [activeTab, setActiveTab] = useState('status');
  const user = useAuthStore(state => state.user);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  // Redirect non-admins to home
  if (!isAuthenticated || !user?.is_admin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-700">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === id
                ? 'text-twitch-purple border-twitch-purple'
                : 'text-gray-400 border-transparent hover:text-white hover:border-gray-600'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'status' && <ServerStatusTab />}
      {activeTab === 'settings' && <ServerSettingsTab />}
      {activeTab === 'traffic' && <TrafficAnalyticsTab />}
      {activeTab === 'usage' && <UsageAnalytics />}
      {activeTab === 'ip-management' && <IpManagementTab />}
      {activeTab === 'users' && <UserManagementTab />}
      {activeTab === 'tiers' && <TiersManagement />}
      {activeTab === 'requests' && <UserRequestsTab />}
      {activeTab === 'webhooks' && <AdminWebhooksTab />}
    </div>
  );
}

export default ServerAdmin;
