import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Menu, Search, Bell, X } from 'lucide-react';
import wsService from '../../services/websocket';

function MobileNavbar({ onMenuClick, onSearchClick }) {
  const [isConnected, setIsConnected] = useState(false);
  const [showNotificationBadge, setShowNotificationBadge] = useState(false);

  useEffect(() => {
    const checkConnection = () => {
      setIsConnected(wsService.isConnected());
    };

    const interval = setInterval(checkConnection, 1000);
    checkConnection();

    return () => clearInterval(interval);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-twitch-gray border-b border-gray-700 safe-area-top">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left: Menu button */}
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 text-gray-300 hover:text-white active:bg-gray-700 rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Center: Logo */}
        <Link to="/" className="flex items-center space-x-2">
          <MessageSquare className="w-7 h-7 text-twitch-purple" />
          <span className="text-lg font-bold text-white">Chatterbox</span>
        </Link>

        {/* Right: Search & Status */}
        <div className="flex items-center space-x-1">
          <button
            onClick={onSearchClick}
            className="p-2 text-gray-300 hover:text-white active:bg-gray-700 rounded-lg transition-colors"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>
          
          {/* Connection status dot */}
          <div className="flex items-center pl-2">
            <div 
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              } animate-pulse`}
              title={isConnected ? 'Connected' : 'Disconnected'}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

export default MobileNavbar;
