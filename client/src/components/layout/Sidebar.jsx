import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { channelsApi } from '../../services/api';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUIStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { 
  Home, 
  MessageSquare, 
  Shield, 
  Radio, 
  Hash,
  Users,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Code,
  Server,
  Heart,
  Webhook
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { path: '/', icon: Home, label: 'Dashboard' },
  { path: '/live', icon: Radio, label: 'Live Feed' },
  { path: '/messages', icon: MessageSquare, label: 'Messages' },
  { path: '/users', icon: Users, label: 'Users' },
  { path: '/moderation', icon: Shield, label: 'Moderation' },
  { path: '/channels', icon: Hash, label: 'Channels' },
];

function Sidebar() {
  const [channelsExpanded, setChannelsExpanded] = useState(true);
  const sidebarCollapsed = useSettingsStore(state => state.sidebarCollapsed);
  const toggleSidebar = useSettingsStore(state => state.toggleSetting);
  const openSettingsModal = useUIStore(state => state.openSettingsModal);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const isAdmin = useAuthStore(state => state.isAdmin);
  const user = useAuthStore(state => state.user);
  
  const { data: channelsData } = useQuery({
    queryKey: ['channels', { active: true }],
    queryFn: () => channelsApi.getAll({ active: true }).then(res => res.data),
    staleTime: 60000, // Cache for 1 minute
  });

  const activeChannels = channelsData?.channels || [];

  return (
    <aside className={`bg-twitch-gray border-r border-gray-700 fixed left-0 top-14 bottom-0 overflow-y-auto transition-all duration-300 ${
      sidebarCollapsed ? 'w-16' : 'w-64'
    }`}>
      {/* Collapse Toggle */}
      <button
        onClick={() => toggleSidebar('sidebarCollapsed')}
        className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors z-10"
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? (
          <PanelLeft className="w-4 h-4" />
        ) : (
          <PanelLeftClose className="w-4 h-4" />
        )}
      </button>

      <nav className={`p-4 ${sidebarCollapsed ? 'pt-12' : ''}`}>
        <ul className="space-y-1">
          {navItems.map(({ path, icon: Icon, label }) => (
            <li key={path}>
              <NavLink
                to={path}
                title={sidebarCollapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-2 rounded-md transition-colors ${
                    isActive
                      ? 'bg-twitch-purple text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`
                }
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>{label}</span>}
              </NavLink>
            </li>
          ))}
          
          {/* Following - only show when authenticated */}
          {isAuthenticated && (
            <li>
              <NavLink
                to="/following"
                title={sidebarCollapsed ? 'Following' : undefined}
                className={({ isActive }) =>
                  `flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-2 rounded-md transition-colors ${
                    isActive
                      ? 'bg-twitch-purple text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`
                }
              >
                <Heart className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>Following</span>}
              </NavLink>
            </li>
          )}
          
          {/* Webhooks - only show when authenticated */}
          {isAuthenticated && (
            <li>
              <NavLink
                to="/webhooks"
                title={sidebarCollapsed ? 'Webhooks' : undefined}
                className={({ isActive }) =>
                  `flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-2 rounded-md transition-colors ${
                    isActive
                      ? 'bg-twitch-purple text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`
                }
              >
                <Webhook className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>Webhooks</span>}
              </NavLink>
            </li>
          )}
        </ul>

        {/* Active Channels */}
        {activeChannels.length > 0 && !sidebarCollapsed && (
          <div className="mt-6">
            <button
              onClick={() => setChannelsExpanded(!channelsExpanded)}
              className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-white"
            >
              <span>Active Channels</span>
              {channelsExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            
            {channelsExpanded && (
              <ul className="mt-1 space-y-0.5">
                {activeChannels.map(channel => (
                  <li key={channel.id}>
                    <NavLink
                      to={`/channel/${channel.name}`}
                      className={({ isActive }) =>
                        `flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                          isActive
                            ? 'bg-twitch-purple/50 text-white'
                            : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                        }`
                      }
                    >
                      <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                      <span className="truncate">#{channel.display_name || channel.name}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Collapsed channels indicator */}
        {activeChannels.length > 0 && sidebarCollapsed && (
          <div className="mt-6 flex flex-col items-center">
            <div className="w-8 h-px bg-gray-700 mb-4" />
            {activeChannels.slice(0, 5).map(channel => (
              <NavLink
                key={channel.id}
                to={`/channel/${channel.name}`}
                title={channel.display_name || channel.name}
                className={({ isActive }) =>
                  `w-8 h-8 rounded-full flex items-center justify-center mb-1 transition-colors ${
                    isActive
                      ? 'bg-twitch-purple text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                  }`
                }
              >
                <span className="text-xs font-bold">
                  {(channel.display_name || channel.name).charAt(0).toUpperCase()}
                </span>
              </NavLink>
            ))}
          </div>
        )}

        {/* Settings & Debug */}
        <div className={`mt-auto pt-4 border-t border-gray-700 ${sidebarCollapsed ? 'mt-6' : 'mt-8'}`}>
          <button
            onClick={openSettingsModal}
            title={sidebarCollapsed ? 'Settings' : undefined}
            className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-2 rounded-md transition-colors text-gray-300 hover:bg-gray-700 hover:text-white`}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span>Settings</span>}
          </button>
          
          {/* Admin-only links */}
          {user?.is_admin && (
            <>
              <NavLink
                to="/admin"
                title={sidebarCollapsed ? 'Server Admin' : undefined}
                className={({ isActive }) =>
                  `w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-2 rounded-md transition-colors ${
                    isActive
                      ? 'bg-twitch-purple text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`
                }
              >
                <Server className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>Server Admin</span>}
              </NavLink>

              <NavLink
                to="/api-explorer"
                title={sidebarCollapsed ? 'API Explorer' : undefined}
                className={({ isActive }) =>
                  `w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'space-x-3'} px-3 py-2 rounded-md transition-colors ${
                    isActive
                      ? 'bg-twitch-purple text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`
                }
              >
                <Code className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>API Explorer</span>}
              </NavLink>
            </>
          )}
        </div>
      </nav>
    </aside>
  );
}

export default Sidebar;
