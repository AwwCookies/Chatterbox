# Chatterbox - Twitch Chat Archive System

A comprehensive solution for archiving Twitch chat messages and moderation actions with real-time monitoring and a beautiful web dashboard.

## Features

- **Real-time Chat Archiving**: Archive all chat messages from multiple Twitch channels
- **Mod Action Tracking**: Record bans, timeouts, message deletions, and more
- **Live Feed**: Watch messages and mod actions in real-time via WebSocket
- **Powerful Search**: Full-text search across all archived messages
- **User Profiles**: View user history, statistics, and mod actions
- **Channel Management**: Add, remove, and manage monitored channels
- **Docker Deployment**: Easy deployment with Docker Compose

## Tech Stack

### Server
- Node.js with Express
- PostgreSQL database
- Socket.io for real-time communication
- tmi.js for Twitch IRC connection

### Client
- React with Vite
- TanStack Query for data fetching
- Tailwind CSS for styling
- Socket.io-client for real-time updates

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Twitch account with OAuth token (get from https://twitchapps.com/tmi/)

### Setup

1. **Clone the repository**
   ```bash
   cd Chatterbox
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Configure your `.env` file**
   ```env
   DB_PASSWORD=your_secure_password
   TWITCH_USERNAME=your_bot_username
   TWITCH_PASSWORD=oauth:your_oauth_token
   CHANNELS=channel1,channel2,channel3
   ```

4. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

5. **Access the application**
   - Web Dashboard: http://localhost:5173
   - API: http://localhost:3000

## Development

### Running locally (without Docker)

**Server:**
```bash
cd server
npm install
cp .env.example .env
# Configure your .env file
npm run dev
```

**Client:**
```bash
cd client
npm install
npm run dev
```

### Database Migrations

Run migrations manually:
```bash
cd server
npm run migrate
```

## API Endpoints

### Messages
- `GET /api/messages` - List messages with filters
- `GET /api/messages/search` - Full-text search
- `GET /api/messages/:id` - Get specific message

### Users
- `GET /api/users` - List users
- `GET /api/users/:username` - Get user profile
- `GET /api/users/:username/messages` - User's message history
- `GET /api/users/:username/mod-actions` - Actions against user
- `GET /api/users/:username/stats` - User statistics

### Mod Actions
- `GET /api/mod-actions` - List mod actions
- `GET /api/mod-actions/recent` - Recent actions
- `GET /api/mod-actions/stats` - Aggregate statistics

### Channels
- `GET /api/channels` - List all channels
- `GET /api/channels/:name` - Get channel info
- `GET /api/channels/:name/stats` - Channel statistics
- `POST /api/channels` - Add new channel
- `PATCH /api/channels/:name` - Update channel
- `DELETE /api/channels/:name` - Remove channel
- `POST /api/channels/:name/rejoin` - Rejoin IRC

### WebSocket
Connect to `ws://localhost:3000/api/live` and send:
```json
{ "action": "subscribe", "channels": ["channel1", "channel2"] }
```

## Project Structure

```
Chatterbox/
├── server/
│   ├── src/
│   │   ├── config/         # Database & Twitch config
│   │   ├── models/         # Data models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   └── utils/          # Utilities
│   ├── migrations/         # Database migrations
│   └── Dockerfile
├── client/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # API & WebSocket
│   │   └── utils/          # Utilities
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_PASSWORD` | PostgreSQL password | - |
| `TWITCH_USERNAME` | Twitch bot username | - |
| `TWITCH_PASSWORD` | OAuth token (oauth:xxx) | - |
| `CHANNELS` | Comma-separated channels | - |
| `PORT` | Server port | 3000 |
| `LOG_LEVEL` | Log level | info |
| `CLIENT_URL` | Client URL for CORS | http://localhost:5173 |
| `VITE_API_URL` | API URL for client | http://localhost:3000 |
| `VITE_WS_URL` | WebSocket URL | ws://localhost:3000 |

## Performance Notes

- Messages are batched (5 seconds or 1000 messages) before database insertion
- PostgreSQL full-text search for efficient message searching
- WebSocket for real-time updates without polling
- Connection pooling for database (max 20 connections)

## License

MIT
