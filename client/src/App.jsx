import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import Sidebar from './components/layout/Sidebar'
import Home from './pages/Home'
import Messages from './pages/Messages'
import User from './pages/User'
import Channel from './pages/Channel'
import Moderation from './pages/Moderation'
import Live from './pages/Live'
import Channels from './pages/Channels'
import ProfileCardContainer from './components/user/ProfileCardContainer'
import { useEmotes } from './hooks/useEmotes'

function App() {
  // Initialize global emotes early
  const { isLoaded } = useEmotes();
  
  useEffect(() => {
    if (isLoaded) {
      console.log('Global emotes loaded (BTTV, FFZ, 7TV)');
    }
  }, [isLoaded]);

  return (
    <div className="min-h-screen bg-twitch-dark text-twitch-light">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 ml-64">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/user/:username" element={<User />} />
            <Route path="/channel/:name" element={<Channel />} />
            <Route path="/moderation" element={<Moderation />} />
            <Route path="/live" element={<Live />} />
            <Route path="/channels" element={<Channels />} />
          </Routes>
        </main>
      </div>
      
      {/* Global profile card container */}
      <ProfileCardContainer />
    </div>
  )
}

export default App
