import { NavLink } from 'react-router-dom';
import { 
  Home, 
  MessageSquare, 
  Shield, 
  Radio, 
  Hash,
  Users 
} from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Dashboard' },
  { path: '/live', icon: Radio, label: 'Live Feed' },
  { path: '/messages', icon: MessageSquare, label: 'Messages' },
  { path: '/moderation', icon: Shield, label: 'Moderation' },
  { path: '/channels', icon: Hash, label: 'Channels' },
];

function Sidebar() {
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
      </nav>
    </aside>
  );
}

export default Sidebar;
