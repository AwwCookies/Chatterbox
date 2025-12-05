import { useEffect, useRef } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { channelsApi } from '../../services/api';
import { useUIStore } from '../../stores/uiStore';
import { 
  X, 
  Home, 
  MessageSquare, 
  Shield, 
  Radio, 
  Hash,
  Settings,
  Bug,
  User,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Dashboard', description: 'Overview and stats' },
  { path: '/live', icon: Radio, label: 'Live Feed', description: 'Real-time messages' },
  { path: '/messages', icon: MessageSquare, label: 'Messages', description: 'Search archived messages' },
  { path: '/moderation', icon: Shield, label: 'Moderation', description: 'Mod actions log' },
  { path: '/channels', icon: Hash, label: 'Channels', description: 'Manage channels' },
];

function MobileDrawer({ isOpen, onClose }) {
  const drawerRef = useRef(null);
  const openSettingsModal = useUIStore(state => state.openSettingsModal);
  const toggleApiDebugPanel = useUIStore(state => state.toggleApiDebugPanel);

  const { data: channelsData } = useQuery({
    queryKey: ['channels', { active: true }],
    queryFn: () => channelsApi.getAll({ active: true }).then(res => res.data),
    staleTime: 60000,
  });

  const activeChannels = channelsData?.channels || [];

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle click outside
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleNavClick = () => {
    onClose();
  };

  const handleSettingsClick = () => {
    onClose();
    openSettingsModal();
  };

  const handleDebugClick = () => {
    onClose();
    toggleApiDebugPanel();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        ref={drawerRef}
        className={`fixed top-0 left-0 bottom-0 z-50 w-[85vw] max-w-sm bg-twitch-gray border-r border-gray-700 transform transition-transform duration-300 ease-out safe-area-left ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navigation drawer"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700 safe-area-top">
            <Link to="/" onClick={handleNavClick} className="flex items-center space-x-2">
              <MessageSquare className="w-7 h-7 text-twitch-purple" />
              <span className="text-lg font-bold text-white">Chatterbox</span>
            </Link>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-gray-400 hover:text-white active:bg-gray-700 rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            {/* Main Navigation */}
            <div className="px-3 mb-6">
              <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Navigation
              </h3>
              <ul className="space-y-1">
                {navItems.map(({ path, icon: Icon, label, description }) => (
                  <li key={path}>
                    <NavLink
                      to={path}
                      onClick={handleNavClick}
                      className={({ isActive }) =>
                        `flex items-center p-3 rounded-xl transition-all ${
                          isActive
                            ? 'bg-twitch-purple text-white'
                            : 'text-gray-300 hover:bg-gray-700/50 active:bg-gray-700'
                        }`
                      }
                    >
                      <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{label}</p>
                        <p className="text-xs text-gray-400 truncate">{description}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>

            {/* Active Channels */}
            {activeChannels.length > 0 && (
              <div className="px-3 mb-6">
                <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Active Channels ({activeChannels.length})
                </h3>
                <ul className="space-y-1">
                  {activeChannels.map(channel => (
                    <li key={channel.id}>
                      <NavLink
                        to={`/channel/${channel.name}`}
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                          `flex items-center p-3 rounded-xl transition-all ${
                            isActive
                              ? 'bg-twitch-purple/50 text-white'
                              : 'text-gray-300 hover:bg-gray-700/50 active:bg-gray-700'
                          }`
                        }
                      >
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-3 flex-shrink-0 animate-pulse" />
                        <span className="font-medium truncate">
                          #{channel.display_name || channel.name}
                        </span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quick Actions */}
            <div className="px-3">
              <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Quick Actions
              </h3>
              <ul className="space-y-1">
                <li>
                  <button
                    onClick={handleSettingsClick}
                    className="w-full flex items-center p-3 rounded-xl text-gray-300 hover:bg-gray-700/50 active:bg-gray-700 transition-all"
                  >
                    <Settings className="w-5 h-5 mr-3 flex-shrink-0" />
                    <span className="font-medium">Settings</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={handleDebugClick}
                    className="w-full flex items-center p-3 rounded-xl text-gray-300 hover:bg-gray-700/50 active:bg-gray-700 transition-all"
                  >
                    <Bug className="w-5 h-5 mr-3 flex-shrink-0" />
                    <span className="font-medium">API Debug</span>
                  </button>
                </li>
              </ul>
            </div>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-700 safe-area-bottom">
            <div className="text-center text-xs text-gray-500">
              <p>Chatterbox v1.0</p>
              <p className="mt-1">Twitch Chat Archive</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default MobileDrawer;
