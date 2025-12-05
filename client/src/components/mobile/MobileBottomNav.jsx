import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, 
  MessageSquare, 
  Shield, 
  Radio, 
  Hash,
  MoreHorizontal 
} from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/live', icon: Radio, label: 'Live' },
  { path: '/messages', icon: MessageSquare, label: 'Messages' },
  { path: '/moderation', icon: Shield, label: 'Mod' },
  { path: '/channels', icon: Hash, label: 'Channels' },
];

function MobileBottomNav({ onMoreClick }) {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-twitch-gray border-t border-gray-700 safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.slice(0, 4).map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path || 
            (path !== '/' && location.pathname.startsWith(path));
          
          return (
            <NavLink
              key={path}
              to={path}
              className={`flex flex-col items-center justify-center py-2 px-4 min-w-[64px] transition-colors ${
                isActive
                  ? 'text-twitch-purple'
                  : 'text-gray-400 active:text-gray-300'
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'scale-110' : ''} transition-transform`} />
              <span className="text-xs mt-1 font-medium">{label}</span>
              {isActive && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-twitch-purple" />
              )}
            </NavLink>
          );
        })}
        
        {/* More button for additional items */}
        <button
          onClick={onMoreClick}
          className="flex flex-col items-center justify-center py-2 px-4 min-w-[64px] text-gray-400 active:text-gray-300 transition-colors"
        >
          <MoreHorizontal className="w-6 h-6" />
          <span className="text-xs mt-1 font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}

export default MobileBottomNav;
