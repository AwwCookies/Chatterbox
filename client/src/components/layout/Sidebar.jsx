import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { channelsApi } from '../../services/api';
import { 
  Home, 
  MessageSquare, 
  Shield, 
  Radio, 
  Hash,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { path: '/', icon: Home, label: 'Dashboard' },
  { path: '/live', icon: Radio, label: 'Live Feed' },
  { path: '/messages', icon: MessageSquare, label: 'Messages' },
  { path: '/moderation', icon: Shield, label: 'Moderation' },
  { path: '/channels', icon: Hash, label: 'Channels' },
];

function Sidebar() {
  const [channelsExpanded, setChannelsExpanded] = useState(true);
  
  const { data: channelsData } = useQuery({
    queryKey: ['channels', { active: true }],
    queryFn: () => channelsApi.getAll({ active: true }).then(res => res.data),
    staleTime: 60000, // Cache for 1 minute
  });

  const activeChannels = channelsData?.channels || [];

  return (
    <aside className="w-64 bg-twitch-gray border-r border-gray-700 fixed left-0 top-14 bottom-0 overflow-y-auto">
      <nav className="p-4">
        <ul className="space-y-1">
          {navItems.map(({ path, icon: Icon, label }) => (
            <li key={path}>
              <NavLink
                to={path}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                    isActive
                      ? 'bg-twitch-purple text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Active Channels */}
        {activeChannels.length > 0 && (
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
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                      <span>#{channel.display_name || channel.name}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </nav>
    </aside>
  );
}

export default Sidebar;
