# Twitch Chat Archive System - Implementation Plan

## Project Overview
Build a two-part application that archives all Twitch chat messages and moderation actions with a comprehensive API for querying historical and real-time data.

### Components
1. **Server (Docker)**: Archive service with PostgreSQL database and REST/WebSocket API
2. **Client**: Web dashboard for viewing and analyzing archived data

---

## Technology Stack

### Server
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js for REST API, Socket.io for WebSocket
- **Database**: PostgreSQL 15+
- **Twitch Integration**: tmi.js (Twitch IRC client)
- **ORM**: Knex.js or Prisma (for migrations and queries)
- **Containerization**: Docker & Docker Compose

### Client
- **Framework**: React with Vite
- **UI Library**: shadcn/ui or Material-UI
- **State Management**: React Query for API calls
- **Real-time**: Socket.io-client
- **Styling**: Tailwind CSS

---

## Database Schema

### Tables

#### `channels`
```sql
CREATE TABLE channels (
    id SERIAL PRIMARY KEY,
    twitch_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);
```

#### `users`
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    twitch_id VARCHAR(50) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(100),
    first_seen TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_twitch_id ON users(twitch_id);
```

#### `messages`
```sql
CREATE TABLE messages (
    id BIGSERIAL PRIMARY KEY,
    channel_id INT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    message_id VARCHAR(100) UNIQUE, -- Twitch's message UUID
    badges JSONB DEFAULT '[]', -- [{type: "moderator", version: "1"}]
    emotes JSONB DEFAULT '[]', -- [{id: "25", start: 0, end: 4}]
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by_id INT REFERENCES users(id)
);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_channel_id ON messages(channel_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_messages_user_channel ON messages(user_id, channel_id, timestamp DESC);
CREATE INDEX idx_messages_deleted ON messages(is_deleted, channel_id);
CREATE INDEX idx_messages_text_search ON messages USING gin(to_tsvector('english', message_text));
```

#### `mod_actions`
```sql
CREATE TABLE mod_actions (
    id BIGSERIAL PRIMARY KEY,
    channel_id INT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    moderator_id INT NOT NULL REFERENCES users(id),
    target_user_id INT NOT NULL REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL, -- ban, timeout, delete, unban, untimeout, clear, etc
    duration_seconds INT, -- for timeouts
    reason TEXT,
    timestamp TIMESTAMP NOT NULL,
    related_message_id BIGINT REFERENCES messages(id),
    metadata JSONB DEFAULT '{}' -- additional action-specific data
);
CREATE INDEX idx_mod_actions_target ON mod_actions(target_user_id, timestamp DESC);
CREATE INDEX idx_mod_actions_moderator ON mod_actions(moderator_id, timestamp DESC);
CREATE INDEX idx_mod_actions_channel ON mod_actions(channel_id, timestamp DESC);
CREATE INDEX idx_mod_actions_type ON mod_actions(action_type, channel_id);
```

---

## Server Implementation

### Directory Structure
```
server/
├── src/
│   ├── index.js                 # Entry point
│   ├── config/
│   │   ├── database.js          # PostgreSQL connection
│   │   └── twitch.js            # Twitch client config
│   ├── services/
│   │   ├── twitchService.js     # IRC connection & event handling
│   │   ├── archiveService.js    # Batch insert logic
│   │   └── websocketService.js  # Real-time broadcasting
│   ├── routes/
│   │   ├── messages.js          # Message endpoints
│   │   ├── users.js             # User endpoints
│   │   ├── modActions.js        # Mod action endpoints
│   │   └── channels.js          # Channel endpoints
│   ├── models/
│   │   ├── Message.js
│   │   ├── User.js
│   │   ├── ModAction.js
│   │   └── Channel.js
│   └── utils/
│       ├── logger.js
│       └── validators.js
├── migrations/
│   └── 001_initial_schema.sql
├── Dockerfile
├── docker-compose.yml
├── package.json
└── .env.example
```

### Core Functionality

#### 1. Twitch IRC Connection (`twitchService.js`)
```javascript
// Connect to multiple channels
// Listen for events:
// - message: Store chat messages
// - messagedeleted: Mark message as deleted
// - ban: Record ban action
// - timeout: Record timeout action
// - clearchat: Record clear action
// Handle reconnection logic
// Update user last_seen timestamps
```

#### 2. Archive Service (`archiveService.js`)
```javascript
// Batch message insertion (every 5 seconds or 1000 messages)
// User upsert logic (create if not exists, update last_seen)
// Channel upsert logic
// Handle duplicate message_id gracefully
```

#### 3. WebSocket Broadcasting (`websocketService.js`)
```javascript
// Rooms per channel
// Emit events: 'message', 'mod_action', 'message_deleted'
// Allow clients to subscribe to specific channels
// Include rate limiting per connection
```

### API Endpoints

#### Messages
- `GET /api/messages` - List messages with filters
  - Query params: `channel`, `user`, `limit`, `offset`, `since`, `until`, `search`, `includeDeleted`
  - Returns: `{messages: [], total: number, hasMore: boolean}`
  
- `GET /api/messages/:id` - Get specific message
  
- `GET /api/messages/search` - Full-text search
  - Query params: `q`, `channel`, `user`, `limit`, `offset`

#### Users
- `GET /api/users` - List users
  - Query params: `search`, `channel`, `limit`, `offset`
  
- `GET /api/users/:username` - Get user profile
  - Returns: User info + stats (message count, first/last seen)
  
- `GET /api/users/:username/messages` - User's message history
  - Query params: `channel`, `limit`, `offset`, `since`, `until`
  
- `GET /api/users/:username/mod-actions` - Actions taken against user
  
- `GET /api/users/:username/stats` - User statistics
  - Returns: Total messages, channels active in, ban/timeout counts

#### Mod Actions
- `GET /api/mod-actions` - List mod actions
  - Query params: `type`, `channel`, `moderator`, `target`, `since`, `until`, `limit`, `offset`
  
- `GET /api/mod-actions/recent` - Recent actions (last 100)
  
- `GET /api/mod-actions/stats` - Aggregate statistics
  - Query params: `channel`, `since`, `until`
  - Returns: Action counts by type, most active mods

#### Channels
- `GET /api/channels` - List all channels (monitored and inactive)
  - Query params: `active` (boolean, filter by is_active status)
  - Returns: `{channels: [{id, name, display_name, is_active, created_at, message_count}]}`
  
- `GET /api/channels/:name` - Get specific channel info
  - Returns: Channel details + stats
  
- `GET /api/channels/:name/stats` - Channel statistics
  - Query params: `since`, `until`
  - Returns: Total messages, active users, mod action counts, messages per hour
  
- `POST /api/channels` - Add new channel to monitor
  - Body: `{name: string}` (Twitch channel name)
  - Action: Joins IRC channel, sets is_active=true
  - Returns: Created channel object
  
- `PATCH /api/channels/:name` - Update channel status
  - Body: `{is_active: boolean}`
  - Action: Joins or parts IRC channel based on is_active
  - Returns: Updated channel object
  
- `DELETE /api/channels/:name` - Remove channel (soft delete)
  - Action: Parts IRC channel, sets is_active=false
  - Note: Historical data is preserved
  
- `POST /api/channels/:name/rejoin` - Rejoin a channel's IRC
  - Action: Parts and rejoins IRC (useful for fixing connection issues)
  - Returns: Success status

#### Live/WebSocket
- `WS /api/live` - WebSocket connection
  - Client sends: `{action: 'subscribe', channels: ['channel1', 'channel2']}`
  - Server emits: `{type: 'message'|'mod_action'|'delete', data: {...}}`

---

## Client Implementation

### Directory Structure
```
client/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── chat/
│   │   │   ├── MessageList.jsx
│   │   │   ├── MessageItem.jsx
│   │   │   └── LiveFeed.jsx
│   │   ├── users/
│   │   │   ├── UserProfile.jsx
│   │   │   ├── UserTimeline.jsx
│   │   │   └── UserStats.jsx
│   │   ├── moderation/
│   │   │   ├── ModActionList.jsx
│   │   │   ├── ModActionItem.jsx
│   │   │   └── ModStats.jsx
│   │   └── common/
│   │       ├── SearchBar.jsx
│   │       ├── DateRangePicker.jsx
│   │       ├── Pagination.jsx
│   │       └── LoadingSpinner.jsx
│   ├── pages/
│   │   ├── Home.jsx              # Dashboard overview
│   │   ├── Messages.jsx          # Message search/browse
│   │   ├── User.jsx              # User detail page
│   │   ├── Moderation.jsx        # Mod actions view
│   │   └── Live.jsx              # Real-time feed
│   ├── hooks/
│   │   ├── useMessages.js
│   │   ├── useUsers.js
│   │   ├── useModActions.js
│   │   └── useWebSocket.js
│   ├── services/
│   │   ├── api.js                # Axios instance
│   │   └── websocket.js          # Socket.io connection
│   └── utils/
│       ├── formatters.js         # Date/time formatting
│       └── constants.js
├── package.json
└── vite.config.js
```

### Key Features

#### 1. Live Feed (`/live`)
- Connect to WebSocket on mount
- Display messages in real-time as they arrive
- Show mod actions with visual indicators (bans, timeouts highlighted)
- Auto-scroll with option to pause
- Filter by channel

#### 2. Message Search (`/messages`)
- Full-text search input
- Filters: channel, user, date range, include deleted
- Paginated results
- Click user to see profile
- Show if message was deleted + when/by whom

#### 3. User Profile (`/user/:username`)
- User stats: total messages, first seen, last seen, channels
- Recent messages timeline
- Mod actions history (bans, timeouts received)
- Message frequency chart

#### 4. Moderation Dashboard (`/moderation`)
- Filter mod actions by type, channel, moderator, target user
- Timeline view of actions
- Statistics: actions per hour/day, most active mods
- Quick links to target user profiles

#### 5. Dashboard (`/`)
- Overview stats: total messages archived, active channels, users tracked
- Recent mod actions
- Most active channels/users
- Archive health (messages per hour chart)

---

## Docker Setup

### `docker-compose.yml`
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: twitch_archive
      POSTGRES_USER: twitch
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./server/migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U twitch"]
      interval: 10s
      timeout: 5s
      retries: 5

  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://twitch:${DB_PASSWORD}@postgres:5432/twitch_archive
      TWITCH_USERNAME: ${TWITCH_USERNAME}
      TWITCH_PASSWORD: ${TWITCH_PASSWORD}
      CHANNELS: ${CHANNELS} # comma-separated
      PORT: 3000
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    volumes:
      - ./server/logs:/app/logs

  client:
    build:
      context: ./client
      dockerfile: Dockerfile
    environment:
      VITE_API_URL: http://localhost:3000
      VITE_WS_URL: ws://localhost:3000
    ports:
      - "5173:80"
    depends_on:
      - server

volumes:
  pgdata:
```

### Server `Dockerfile`
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src
COPY migrations ./migrations

CMD ["node", "src/index.js"]
```

### Client `Dockerfile`
```dockerfile
FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## Environment Variables

### `.env.example`
```bash
# Database
DB_PASSWORD=your_secure_password

# Twitch
TWITCH_USERNAME=your_bot_username
TWITCH_PASSWORD=oauth:your_oauth_token
CHANNELS=channel1,channel2,channel3

# Server
PORT=3000
LOG_LEVEL=info

# Client
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

---

## Implementation Steps

### Phase 1: Server Foundation
1. Set up Node.js project with Express
2. Configure PostgreSQL connection with connection pooling
3. Create database migrations with all tables and indexes
4. Implement basic CRUD models for Message, User, Channel, ModAction
5. Set up tmi.js client to connect to Twitch IRC
6. Implement message archival with batch inserts (buffer 5 seconds or 1000 messages)
7. Handle user upsert logic (create or update last_seen)

### Phase 2: Server API
1. Implement REST endpoints for messages (list, get, search)
2. Implement REST endpoints for users (list, get, messages, stats)
3. Implement REST endpoints for mod actions (list, stats)
4. Implement REST endpoints for channels (list, get, stats)
5. Add input validation and error handling
6. Add request logging middleware
7. Set up CORS for client access

### Phase 3: Real-time Features
1. Set up Socket.io server
2. Implement channel subscription logic
3. Broadcast message events to subscribed clients
4. Broadcast mod action events
5. Add rate limiting per connection
6. Handle client disconnections gracefully

### Phase 4: Client Foundation
1. Set up React + Vite project
2. Configure Tailwind CSS and UI component library
3. Set up React Router with main routes
4. Create API service layer with axios
5. Implement useMessages, useUsers, useModActions hooks with React Query
6. Create basic layout (Navbar, Sidebar, main content area)

### Phase 5: Client Features
1. Build Live Feed page with WebSocket connection
2. Build Message Search page with filters and pagination
3. Build User Profile page with timeline and stats
4. Build Moderation Dashboard with action filters
5. Build Home Dashboard with overview stats
6. Add date range pickers and search inputs
7. Implement proper loading and error states

### Phase 6: Polish & Optimization
1. Add database indexes for common queries
2. Implement query result caching
3. Add comprehensive error logging
4. Write API documentation
5. Add health check endpoint
6. Implement graceful shutdown for server
7. Add metrics/monitoring (optional: Prometheus)
8. Create admin endpoints for channel management

### Phase 7: Deployment
1. Test docker-compose setup locally
2. Document deployment process
3. Set up automatic database backups
4. Configure reverse proxy (nginx) if needed
5. Set up SSL certificates for production
6. Document API endpoints with examples

---

## Performance Considerations

### Database
- Use connection pooling (max 20 connections)
- Batch insert messages (reduces DB load by 95%)
- Partition messages table by month for very high volume (optional)
- Regular VACUUM and ANALYZE for query optimization

### Server
- Implement in-memory message buffer before DB insert
- Use worker threads for CPU-intensive operations (if needed)
- Rate limit API endpoints (100 req/min per IP)
- Cache frequently accessed data (channel stats, user counts)

### Client
- Virtual scrolling for large message lists (react-window)
- Debounce search inputs (300ms)
- Pagination with reasonable page sizes (50-100 items)
- Lazy load user profiles and stats

---

## Security Considerations

1. **Authentication**: Add JWT-based auth for API access (optional, depends on use case)
2. **Rate Limiting**: Prevent API abuse with express-rate-limit
3. **Input Validation**: Sanitize all user inputs
4. **SQL Injection**: Use parameterized queries (Knex/Prisma handles this)
5. **CORS**: Configure appropriate CORS headers
6. **Secrets**: Never commit tokens/passwords, use .env files
7. **Admin Actions**: Require authentication for channel management endpoints

---

## Testing Strategy

### Server
- Unit tests for models and services
- Integration tests for API endpoints
- Test Twitch IRC event handling with mock events
- Load testing for batch insert performance

### Client
- Component tests with React Testing Library
- E2E tests with Playwright for critical user flows
- Test WebSocket reconnection logic

---

## Future Enhancements

1. **Analytics Dashboard**: Charts for message frequency, user activity patterns
2. **Export Functionality**: Download chat logs as JSON/CSV
3. **User Annotations**: Add notes to users (known trolls, VIPs, etc.)
4. **Webhook Notifications**: Alert on specific events (certain users banned, etc.)
5. **Multi-platform Support**: Extend to YouTube, Discord, etc.
6. **Machine Learning**: Sentiment analysis, toxicity detection
7. **Admin Panel**: Web UI for managing monitored channels
8. **Historical Import**: Import old chat logs from Twitch API

---

## Resources & Documentation

- **tmi.js**: https://tmijs.com/
- **PostgreSQL Full-text Search**: https://www.postgresql.org/docs/current/textsearch.html
- **Socket.io**: https://socket.io/docs/v4/
- **React Query**: https://tanstack.com/query/latest
- **Twitch IRC**: https://dev.twitch.tv/docs/irc

---

## Success Metrics

- Successfully archive 1000+ messages per minute without lag
- API response times under 200ms for common queries
- Zero message loss during archival
- Real-time feed latency under 1 second
- Support for at least 10 concurrent channels
- Database query performance remains fast with 1M+ messages

---

## Notes for Implementation

- Start with a single channel for testing, then scale to multiple
- Monitor memory usage during batch inserts
- Use PM2 or similar for process management in production
- Set up logging to file and console for debugging
- Consider Redis for caching if query load becomes high
- Test with both small and large channels to ensure scalability