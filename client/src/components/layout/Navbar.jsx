import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Search, Command } from 'lucide-react';
import wsService from '../../services/websocket';

function Navbar() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Just check connection status without subscribing to anything
    const checkConnection = () => {
      setIsConnected(wsService.isConnected());
    };

    const interval = setInterval(checkConnection, 1000);
    checkConnection();

    return () => clearInterval(interval);
  }, []);

  const handleSearchClick = () => {
    // Trigger Command Palette via keyboard event
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      ctrlKey: true,
      bubbles: true,
    }));
  };

  return (
    <nav className="bg-twitch-gray border-b border-gray-700 h-14 fixed top-0 left-0 right-0 z-50">
      <div className="h-full px-4 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <MessageSquare className="w-8 h-8 text-twitch-purple" />
          <span className="text-xl font-bold text-white">Chatterbox</span>
        </Link>

        <div className="flex items-center space-x-4">
          {/* Search Button / Command Palette Trigger */}
          <button
            onClick={handleSearchClick}
            className="flex items-center gap-2 bg-twitch-dark border border-gray-600 rounded-lg py-1.5 px-3 text-sm text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-colors w-64"
          >
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-800 rounded text-xs">
              <Command className="w-3 h-3" />K
            </kbd>
          </button>

          {/* Connection Status */}
          <div className="flex items-center space-x-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
