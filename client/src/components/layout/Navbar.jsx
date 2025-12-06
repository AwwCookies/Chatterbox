import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare, Search, Command, User, LogOut, Heart, Settings, LogIn } from 'lucide-react';
import wsService from '../../services/websocket';
import { useAuthStore } from '../../stores/authStore';
import { useAuth } from '../../hooks/useAuth';

function Navbar() {
  const [isConnected, setIsConnected] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  
  const { user, isAuthenticated, isAdmin } = useAuthStore();
  const { logout, getLoginUrl } = useAuth();

  useEffect(() => {
    // Just check connection status without subscribing to anything
    const checkConnection = () => {
      setIsConnected(wsService.isConnected());
    };

    const interval = setInterval(checkConnection, 1000);
    checkConnection();

    return () => clearInterval(interval);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const handleLogin = () => {
    window.location.href = getLoginUrl();
  };

  const handleLogout = async () => {
    await logout();
    setUserMenuOpen(false);
    navigate('/');
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

          {/* User Menu */}
          {isAuthenticated ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-2 hover:bg-gray-700 rounded-lg p-1.5 transition-colors"
              >
                <img
                  src={user?.profile_image_url}
                  alt={user?.display_name}
                  className="w-8 h-8 rounded-full"
                />
              </button>
              
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-twitch-gray border border-gray-700 rounded-lg shadow-lg py-1 z-50">
                  <div className="px-4 py-3 border-b border-gray-700">
                    <p className="text-sm font-medium text-white">{user?.display_name}</p>
                    <p className="text-xs text-gray-400">@{user?.username}</p>
                    {isAdmin() && (
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-twitch-purple text-white rounded">
                        Admin
                      </span>
                    )}
                  </div>
                  
                  <Link
                    to="/following"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                  >
                    <Heart className="w-4 h-4" />
                    <span>Following</span>
                  </Link>
                  
                  <Link
                    to="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                  >
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                  </Link>
                  
                  <div className="border-t border-gray-700 mt-1 pt-1">
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="flex items-center space-x-2 bg-twitch-purple hover:bg-twitch-purple-dark text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>Login</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
