import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import Sidebar from './components/layout/Sidebar'
import Home from './pages/Home'
import Messages from './pages/Messages'
import User from './pages/User'
import Users from './pages/Users'
import Channel from './pages/Channel'
import Moderation from './pages/Moderation'
import Live from './pages/Live'
import Channels from './pages/Channels'
import ServerAdmin from './pages/ServerAdmin'
import ApiExplorer from './pages/ApiExplorer'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Following from './pages/Following'
import Profile from './pages/Profile'
import Watch from './pages/Watch'
import Webhooks from './pages/Webhooks'
import ProfileCardContainer from './components/user/ProfileCardContainer'
import ThreadCardContainer from './components/chat/ThreadCardContainer'
import ToastContainer from './components/common/ToastContainer'
import CommandPalette from './components/common/CommandPalette'
import ErrorBoundary from './components/common/ErrorBoundary'
import SettingsModal from './components/common/SettingsModal'
import AlphaDisclaimerModal from './components/common/AlphaDisclaimerModal'
import { useEmotes } from './hooks/useEmotes'
import { useSettingsStore } from './stores/settingsStore'
import { useUIStore } from './stores/uiStore'
import { useMobile, useViewportHeight } from './hooks/useMobile'
import { MobileNavbar, MobileBottomNav, MobileDrawer, MobileSearch } from './components/mobile'

function App() {
  // Initialize global emotes early
  const { isLoaded } = useEmotes();
  const sidebarCollapsed = useSettingsStore(state => state.sidebarCollapsed);
  const theme = useSettingsStore(state => state.theme);
  const accentColor = useSettingsStore(state => state.accentColor);
  const settingsModalOpen = useUIStore(state => state.settingsModalOpen);
  const closeSettingsModal = useUIStore(state => state.closeSettingsModal);
  
  // Mobile detection and state
  const { isMobile, isTablet } = useMobile();
  useViewportHeight(); // Sets --vh CSS variable
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  
  useEffect(() => {
    if (isLoaded) {
      console.log('Global emotes loaded (BTTV, FFZ, 7TV)');
    }
  }, [isLoaded]);

  const fontSize = useSettingsStore(state => state.fontSize);
  const compactMode = useSettingsStore(state => state.compactMode);

  // Apply theme, accent color, font size, and compact mode to root element
  useEffect(() => {
    const root = document.documentElement;
    
    // Handle theme
    root.classList.remove('dark', 'light');
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(prefersDark ? 'dark' : 'light');
    } else {
      root.classList.add(theme);
    }
    
    // Handle accent color
    root.classList.remove('accent-purple', 'accent-blue', 'accent-green', 'accent-pink', 'accent-orange', 'accent-red');
    root.classList.add(`accent-${accentColor}`);
    
    // Handle font size
    root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
    root.classList.add(`font-size-${fontSize}`);
    
    // Handle compact mode
    root.classList.toggle('compact-mode', compactMode);
  }, [theme, accentColor, fontSize, compactMode]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      const root = document.documentElement;
      root.classList.remove('dark', 'light');
      root.classList.add(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Request notification permission when enabled
  useEffect(() => {
    const enableNotifications = useSettingsStore.getState().enableNotifications;
    if (enableNotifications && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className="min-h-screen bg-twitch-dark text-twitch-light mobile-safe-area overflow-x-hidden">
      {/* Desktop Layout */}
      {!isMobile && (
        <>
          <Navbar />
          <div className="flex pt-14">
            <Sidebar />
            <main className={`flex-1 p-6 transition-all duration-300 min-w-0 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/messages" element={<Messages />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/user/:username" element={<User />} />
                  <Route path="/channel/:name" element={<Channel />} />
                  <Route path="/moderation" element={<Moderation />} />
                  <Route path="/live" element={<Live />} />
                  <Route path="/channels" element={<Channels />} />
                  <Route path="/admin" element={<ServerAdmin />} />
                  <Route path="/api-explorer" element={<ApiExplorer />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/following" element={<Following />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/webhooks" element={<Webhooks />} />
                  <Route path="/watch/:channel" element={<Watch />} />
                </Routes>
              </ErrorBoundary>
            </main>
          </div>
        </>
      )}

      {/* Mobile Layout */}
      {isMobile && (
        <>
          <MobileNavbar 
            onMenuClick={() => setMobileDrawerOpen(true)}
            onSearchClick={() => setMobileSearchOpen(true)}
          />
          <main className="pt-14 pb-16 min-h-screen">
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Home isMobile />} />
                <Route path="/messages" element={<Messages isMobile />} />
                <Route path="/user/:username" element={<User isMobile />} />
                <Route path="/channel/:name" element={<Channel isMobile />} />
                <Route path="/moderation" element={<Moderation isMobile />} />
                <Route path="/live" element={<Live isMobile />} />
                <Route path="/channels" element={<Channels isMobile />} />
                <Route path="/login" element={<Login isMobile />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/following" element={<Following isMobile />} />
                <Route path="/profile" element={<Profile isMobile />} />
                <Route path="/webhooks" element={<Webhooks />} />
                <Route path="/watch/:channel" element={<Watch />} />
              </Routes>
            </ErrorBoundary>
          </main>
          <MobileBottomNav onMoreClick={() => setMobileDrawerOpen(true)} />
          <MobileDrawer 
            isOpen={mobileDrawerOpen} 
            onClose={() => setMobileDrawerOpen(false)} 
          />
          <MobileSearch 
            isOpen={mobileSearchOpen} 
            onClose={() => setMobileSearchOpen(false)} 
          />
        </>
      )}
      
      {/* Global components */}
      <ProfileCardContainer />
      <ThreadCardContainer />
      <ToastContainer />
      {!isMobile && <CommandPalette />}
      <SettingsModal isOpen={settingsModalOpen} onClose={closeSettingsModal} />
      <AlphaDisclaimerModal />
    </div>
  )
}

export default App
