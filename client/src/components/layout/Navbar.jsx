import { Link } from 'react-router-dom';
import { MessageSquare, Search, Activity } from 'lucide-react';

function Navbar() {
  return (
    <nav className="bg-twitch-gray border-b border-gray-700 h-14 fixed top-0 left-0 right-0 z-50">
      <div className="h-full px-4 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <MessageSquare className="w-8 h-8 text-twitch-purple" />
          <span className="text-xl font-bold text-white">Chatterbox</span>
        </Link>

        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search messages..."
              className="bg-twitch-dark border border-gray-600 rounded-md py-1.5 pl-10 pr-4 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-twitch-purple w-64"
            />
          </div>

          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <Activity className="w-4 h-4 text-green-500" />
            <span>Connected</span>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
