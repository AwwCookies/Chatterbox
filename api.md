# Chatterbox API Documentation

> Complete API reference for the Chatterbox Twitch Chat Archive System

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Pagination](#pagination)
- [Data Models](#data-models)
- [REST API Endpoints](#rest-api-endpoints)
  - [Messages](#messages)
  - [Users](#users)
  - [Mod Actions](#mod-actions)
  - [Channels](#channels)
  - [Utilities](#utilities)
  - [System](#system)
- [WebSocket API](#websocket-api)
- [Error Handling](#error-handling)
- [Examples](#examples)
- [LLM Integration Guide](#llm-integration-guide)

---

## Overview

Chatterbox is a Twitch chat archival and moderation tracking system. It provides:

- **REST API** for querying archived messages, user data, mod actions, and channel management
- **WebSocket API** for real-time chat messages and moderation events
- **Full-text search** across archived messages
- **Comprehensive statistics** for users, channels, and moderation activity

**Base URL:** `http://localhost:3000/api`

**WebSocket URL:** `ws://localhost:3000/api/live`

---

## Quick Start

### Fetch Recent Messages
```bash
curl "http://localhost:3000/api/messages?limit=10"
```

### Search Messages
```bash
curl "http://localhost:3000/api/messages/search?q=hello&channel=pokimane"
```

### Get User Profile
```bash
curl "http://localhost:3000/api/users/chatuser123"
```

### Connect to Live Feed
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  path: '/api/live',
  transports: ['websocket', 'polling']
});

socket.emit('subscribe', { channels: ['pokimane', 'xqc'] });

socket.on('chat_message', (event) => {
  console.log(`${event.data.username}: ${event.data.message_text}`);
});
```

---

## Authentication

Most read endpoints (GET requests) are **publicly accessible** without authentication.

**Sensitive endpoints require API key authentication:**
- `POST /api/channels` - Add new channel
- `PATCH /api/channels/:name` - Update channel
- `DELETE /api/channels/:name` - Remove channel
- `POST /api/channels/:name/rejoin` - Rejoin IRC

### Using API Key Authentication

Include the `X-API-Key` header in your request:

```bash
curl -X POST "https://api.example.com/api/channels" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key" \
  -d '{"name": "channelname"}'
```

### Authentication Errors

**Missing API Key (401):**
```json
{
  "error": "API key required",
  "hint": "Include X-API-Key header"
}
```

**Invalid API Key (403):**
```json
{
  "error": "Invalid API key"
}
```

---

## Rate Limiting

| Setting | Value |
|---------|-------|
| Window | 60 seconds |
| Max Requests | 100 per minute |
| Status Code | 429 (Too Many Requests) |

**Rate Limit Response:**
```json
{
  "error": "Too many requests, please try again later"
}
```

---

## Pagination

Most list endpoints support pagination with these query parameters:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | integer | 50 | 100 | Number of results to return |
| `offset` | integer | 0 | - | Number of results to skip |

**Paginated Response Structure:**
```json
{
  "messages": [...],
  "total": 1500,
  "hasMore": true
}
```

**Example: Page through results**
```bash
# Page 1 (items 1-50)
curl "http://localhost:3000/api/messages?limit=50&offset=0"

# Page 2 (items 51-100)
curl "http://localhost:3000/api/messages?limit=50&offset=50"
```

---

## Data Models

### Channel
```json
{
  "id": 1,
  "twitch_id": "12345678",
  "name": "pokimane",
  "display_name": "Pokimane",
  "created_at": "2025-01-15T10:30:00.000Z",
  "is_active": true,
  "message_count": 15432
}
```

### User
```json
{
  "id": 1,
  "twitch_id": "87654321",
  "username": "chatuser123",
  "display_name": "ChatUser123",
  "first_seen": "2025-01-15T10:30:00.000Z",
  "last_seen": "2025-12-04T15:45:00.000Z",
  "total_messages": 1250,
  "channels_count": 5,
  "ban_count": 0,
  "timeout_count": 2
}
```

### Message
```json
{
  "id": 12345,
  "channel_id": 1,
  "user_id": 42,
  "message_text": "Hello chat! Kappa",
  "timestamp": "2025-12-04T15:45:30.123Z",
  "message_id": "abc123-def456-ghi789",
  "badges": [
    { "type": "subscriber", "version": "12" },
    { "type": "vip", "version": "1" }
  ],
  "emotes": [
    { "id": "25", "start": 12, "end": 16 }
  ],
  "is_deleted": false,
  "deleted_at": null,
  "deleted_by_id": null,
  "username": "chatuser123",
  "user_display_name": "ChatUser123",
  "channel_name": "pokimane",
  "channel_display_name": "Pokimane",
  "channel_twitch_id": "12345678"
}
```

### ModAction
```json
{
  "id": 100,
  "channel_id": 1,
  "moderator_id": 5,
  "target_user_id": 42,
  "action_type": "timeout",
  "duration_seconds": 600,
  "reason": "Spam",
  "timestamp": "2025-12-04T15:50:00.000Z",
  "related_message_id": 12345,
  "metadata": {},
  "channel_name": "pokimane",
  "moderator_username": "mod_user",
  "moderator_display_name": "Mod_User",
  "target_username": "chatuser123",
  "target_display_name": "ChatUser123"
}
```

**Action Types:**
| Type | Description |
|------|-------------|
| `ban` | Permanent ban |
| `timeout` | Temporary timeout (has `duration_seconds`) |
| `delete` | Single message deletion |
| `clear` | Chat cleared |
| `unban` | User unbanned |
| `untimeout` | Timeout removed |

---

## REST API Endpoints

### Messages

#### List Messages
`GET /api/messages`

Retrieve messages with optional filters.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Results per page (1-100, default: 50) |
| `offset` | integer | No | Skip N results (default: 0) |
| `channel` | string | No | Filter by channel name |
| `user` | string | No | Filter by username |
| `since` | ISO date | No | Messages after this date |
| `until` | ISO date | No | Messages before this date |
| `search` | string | No | Full-text search in message content |
| `includeDeleted` | boolean | No | Include deleted messages (default: false) |

**Response:**
```json
{
  "messages": [
    {
      "id": 12345,
      "channel_id": 1,
      "user_id": 42,
      "message_text": "Hello chat!",
      "timestamp": "2025-12-04T15:45:30.123Z",
      "message_id": "abc123-def456",
      "badges": [{ "type": "subscriber", "version": "12" }],
      "emotes": [],
      "is_deleted": false,
      "deleted_at": null,
      "deleted_by_id": null,
      "username": "chatuser123",
      "user_display_name": "ChatUser123",
      "channel_name": "pokimane",
      "channel_display_name": "Pokimane",
      "channel_twitch_id": "12345678",
      "deleted_by_username": null
    }
  ],
  "total": 1500,
  "hasMore": true
}
```

**Example:**
```bash
# Get messages from a specific channel and user
curl "http://localhost:3000/api/messages?channel=pokimane&user=chatuser123&limit=20"

# Get messages from the last hour
curl "http://localhost:3000/api/messages?since=2025-12-04T14:45:00.000Z"
```

---

#### Search Messages
`GET /api/messages/search`

Full-text search across message content with relevance ranking.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | **Yes** | Search query (min 2 characters) |
| `limit` | integer | No | Results per page (default: 50) |
| `offset` | integer | No | Skip N results |
| `channel` | string | No | Filter by channel name |
| `user` | string | No | Filter by username |

**Response:**
```json
{
  "messages": [
    {
      "id": 12345,
      "message_text": "Hello everyone!",
      "username": "chatuser123",
      "channel_name": "pokimane",
      "timestamp": "2025-12-04T15:45:30.123Z",
      "rank": 0.0607927
    }
  ],
  "total": 1523,
  "hasMore": true
}
```

**Example:**
```bash
# Search for "hello" in all channels
curl "http://localhost:3000/api/messages/search?q=hello"

# Search in specific channel
curl "http://localhost:3000/api/messages/search?q=LUL&channel=xqc"
```

---

#### Get Message by ID
`GET /api/messages/:id`

Retrieve a specific message by its database ID.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Message ID |

**Response:**
```json
{
  "id": 12345,
  "channel_id": 1,
  "user_id": 42,
  "message_text": "Hello chat!",
  "timestamp": "2025-12-04T15:45:30.123Z",
  "message_id": "abc123-def456",
  "badges": [],
  "emotes": [],
  "is_deleted": false,
  "username": "chatuser123",
  "user_display_name": "ChatUser123",
  "channel_name": "pokimane",
  "channel_twitch_id": "12345678"
}
```

**Errors:**
- `404`: Message not found

---

### Users

#### List Users
`GET /api/users`

Retrieve users with optional search/filter.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Results per page (default: 50) |
| `offset` | integer | No | Skip N results |
| `search` | string | No | Search username/display name |
| `channel` | string | No | Filter users active in channel |

**Response:**
```json
{
  "users": [
    {
      "id": 42,
      "twitch_id": "87654321",
      "username": "chatuser123",
      "display_name": "ChatUser123",
      "first_seen": "2025-01-15T10:30:00.000Z",
      "last_seen": "2025-12-04T15:45:00.000Z"
    }
  ]
}
```

---

#### Get User Profile
`GET /api/users/:username`

Get user profile with statistics and active channels.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Username (case-insensitive) |

**Response:**
```json
{
  "id": 42,
  "twitch_id": "87654321",
  "username": "chatuser123",
  "display_name": "ChatUser123",
  "first_seen": "2025-01-15T10:30:00.000Z",
  "last_seen": "2025-12-04T15:45:00.000Z",
  "total_messages": 1250,
  "channels_count": 5,
  "ban_count": 0,
  "timeout_count": 2,
  "active_channels": [
    {
      "name": "pokimane",
      "display_name": "Pokimane",
      "message_count": 500
    },
    {
      "name": "xqc",
      "display_name": "xQc",
      "message_count": 350
    }
  ]
}
```

**Errors:**
- `404`: User not found

---

#### Get User Messages
`GET /api/users/:username/messages`

Get a user's message history.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Username |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Results per page (default: 50) |
| `offset` | integer | No | Skip N results |
| `channel` | string | No | Filter by channel |
| `since` | ISO date | No | Messages after date |
| `until` | ISO date | No | Messages before date |

**Response:**
```json
{
  "messages": [
    {
      "id": 12345,
      "message_text": "Hello!",
      "timestamp": "2025-12-04T15:45:30.123Z",
      "channel_name": "pokimane",
      "channel_twitch_id": "12345678",
      "emotes": [],
      "badges": []
    }
  ],
  "total": 1250,
  "hasMore": true,
  "user": {
    "id": 42,
    "username": "chatuser123",
    "display_name": "ChatUser123"
  }
}
```

---

#### Get User Mod Actions
`GET /api/users/:username/mod-actions`

Get moderation actions taken against a user.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Username |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Results per page (default: 50) |
| `offset` | integer | No | Skip N results |

**Response:**
```json
{
  "actions": [
    {
      "id": 100,
      "action_type": "timeout",
      "duration_seconds": 600,
      "reason": "Spam",
      "timestamp": "2025-12-04T15:50:00.000Z",
      "channel_name": "pokimane",
      "moderator_username": "mod_user"
    }
  ],
  "total": 45,
  "hasMore": false,
  "user": {
    "id": 42,
    "username": "chatuser123"
  }
}
```

---

#### Get User Statistics
`GET /api/users/:username/stats`

Get detailed statistics for a user.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Username |

**Response:**
```json
{
  "id": 42,
  "username": "chatuser123",
  "display_name": "ChatUser123",
  "twitch_id": "87654321",
  "first_seen": "2025-01-15T10:30:00.000Z",
  "last_seen": "2025-12-04T15:45:00.000Z",
  "total_messages": 1250,
  "channels_count": 5,
  "ban_count": 0,
  "timeout_count": 2,
  "active_channels": [
    {
      "name": "pokimane",
      "display_name": "Pokimane",
      "message_count": 500
    }
  ]
}
```

---

### Mod Actions

#### List Mod Actions
`GET /api/mod-actions`

Retrieve moderation actions with filters.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Results per page (default: 50) |
| `offset` | integer | No | Skip N results |
| `type` | string | No | Filter by action type (`ban`, `timeout`, `delete`, etc.) |
| `channel` | string | No | Filter by channel name |
| `moderator` | string | No | Filter by moderator username |
| `target` | string | No | Filter by target username |
| `since` | ISO date | No | Actions after date |
| `until` | ISO date | No | Actions before date |

**Response:**
```json
{
  "actions": [
    {
      "id": 100,
      "channel_id": 1,
      "moderator_id": 5,
      "target_user_id": 42,
      "action_type": "timeout",
      "duration_seconds": 600,
      "reason": "Spam",
      "timestamp": "2025-12-04T15:50:00.000Z",
      "related_message_id": null,
      "metadata": {},
      "channel_name": "pokimane",
      "moderator_username": "mod_user",
      "moderator_display_name": "Mod_User",
      "target_username": "chatuser123",
      "target_display_name": "ChatUser123"
    }
  ],
  "total": 500,
  "hasMore": true
}
```

**Example:**
```bash
# Get all bans in a channel
curl "http://localhost:3000/api/mod-actions?channel=pokimane&type=ban"

# Get actions against a specific user
curl "http://localhost:3000/api/mod-actions?target=baduser"
```

---

#### Get Recent Mod Actions
`GET /api/mod-actions/recent`

Get the most recent moderation actions across all channels.

**Query Parameters:**

| Parameter | Type | Required | Default | Max | Description |
|-----------|------|----------|---------|-----|-------------|
| `limit` | integer | No | 100 | 500 | Number of actions |

**Response:**
```json
{
  "actions": [
    {
      "id": 100,
      "action_type": "ban",
      "timestamp": "2025-12-04T15:50:00.000Z",
      "channel_name": "pokimane",
      "moderator_username": "mod_user",
      "target_username": "baduser"
    }
  ]
}
```

---

#### Get Mod Action Statistics
`GET /api/mod-actions/stats`

Get aggregate statistics for moderation actions.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channel` | string | No | Filter by channel |
| `since` | ISO date | No | Stats after date |
| `until` | ISO date | No | Stats before date |

**Response:**
```json
{
  "action_counts": [
    { "action_type": "timeout", "count": 150 },
    { "action_type": "ban", "count": 25 },
    { "action_type": "delete", "count": 10 }
  ],
  "top_moderators": [
    {
      "username": "mod_user",
      "display_name": "Mod_User",
      "action_count": 85
    },
    {
      "username": "another_mod",
      "display_name": "Another_Mod",
      "action_count": 42
    }
  ]
}
```

---

### Channels

#### List Channels
`GET /api/channels`

Get all monitored channels.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `active` | boolean | No | Filter by active status (`true` = only active) |

**Response:**
```json
{
  "channels": [
    {
      "id": 1,
      "twitch_id": "12345678",
      "name": "pokimane",
      "display_name": "Pokimane",
      "created_at": "2025-01-15T10:30:00.000Z",
      "is_active": true,
      "message_count": 15432
    }
  ]
}
```

---

#### Get Channel
`GET /api/channels/:name`

Get a specific channel by name.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Channel name (case-insensitive) |

**Response:**
```json
{
  "id": 1,
  "twitch_id": "12345678",
  "name": "pokimane",
  "display_name": "Pokimane",
  "created_at": "2025-01-15T10:30:00.000Z",
  "is_active": true
}
```

**Errors:**
- `404`: Channel not found

---

#### Get Channel Statistics
`GET /api/channels/:name/stats`

Get detailed statistics for a channel.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Channel name |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `since` | ISO date | No | Stats after date |
| `until` | ISO date | No | Stats before date |

**Response:**
```json
{
  "channel": {
    "id": 1,
    "name": "pokimane",
    "display_name": "Pokimane",
    "is_active": true
  },
  "stats": {
    "total_messages": 15432,
    "unique_users": 2500,
    "deleted_messages": 150,
    "mod_actions": [
      { "action_type": "timeout", "count": 50 },
      { "action_type": "ban", "count": 5 }
    ]
  }
}
```

---

#### Add Channel
`POST /api/channels`

Add a new channel to monitor.

**Request Body:**
```json
{
  "name": "newstreamer"
}
```

**Response (201 Created):**
```json
{
  "id": 5,
  "twitch_id": null,
  "name": "newstreamer",
  "display_name": "newstreamer",
  "created_at": "2025-12-04T16:00:00.000Z",
  "is_active": true
}
```

**Errors:**
- `400`: Channel name is required
- `409`: Channel already exists

---

#### Update Channel
`PATCH /api/channels/:name`

Update channel status (activate/deactivate).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Channel name |

**Request Body:**
```json
{
  "is_active": false
}
```

**Response:**
```json
{
  "id": 1,
  "name": "pokimane",
  "is_active": false
}
```

**Errors:**
- `400`: is_active field is required
- `404`: Channel not found

---

#### Remove Channel
`DELETE /api/channels/:name`

Remove a channel (soft delete - deactivates it).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Channel name |

**Response:**
```json
{
  "message": "Channel removed successfully"
}
```

**Errors:**
- `404`: Channel not found

---

#### Rejoin Channel
`POST /api/channels/:name/rejoin`

Rejoin a channel's IRC connection (useful for fixing connection issues).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Channel name |

**Response:**
```json
{
  "message": "Channel rejoined successfully"
}
```

**Errors:**
- `400`: Failed to rejoin channel
- `404`: Channel not found

---

#### Get Top Users
`GET /api/channels/:name/top-users`

Get the top chatters in a channel by message count.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Channel name |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 10 | Number of users to return (max 100) |
| `since` | ISO 8601 date | - | Only count messages after this date |
| `until` | ISO 8601 date | - | Only count messages before this date |

**Response:**
```json
{
  "users": [
    {
      "id": 1,
      "username": "topchatuser",
      "display_name": "TopChatUser",
      "twitch_id": "123456789",
      "message_count": 5420,
      "last_message_at": "2024-01-15T12:00:00.000Z"
    }
  ]
}
```

**Errors:**
- `404`: Channel not found

---

#### Get Channel Links
`GET /api/channels/:name/links`

Get all messages containing links/URLs posted in a channel.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Channel name |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 50 | Number of messages to return (max 100) |
| `offset` | integer | 0 | Pagination offset |
| `since` | ISO 8601 date | - | Only include messages after this date |
| `until` | ISO 8601 date | - | Only include messages before this date |

**Response:**
```json
{
  "messages": [
    {
      "id": 1,
      "message_id": "abc-123-def",
      "channel_id": 1,
      "user_id": 42,
      "message_text": "Check out this video https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "timestamp": "2024-01-15T14:30:00.000Z",
      "is_deleted": false,
      "badges": [],
      "emotes": [],
      "username": "chatuser123",
      "user_display_name": "ChatUser123",
      "channel_name": "streamer",
      "channel_twitch_id": "123456789"
    }
  ],
  "total": 150,
  "channel": {
    "id": 1,
    "name": "streamer",
    "display_name": "Streamer",
    "twitch_id": "123456789",
    "is_active": true
  }
}
```

**Errors:**
- `404`: Channel not found

---

### Utilities

#### Link Preview
`GET /api/utils/link-preview`

Fetch Open Graph metadata for a URL. Used for generating rich link previews in chat messages. Supports special handling for YouTube, TikTok, Twitter/X, and generic websites.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | **Yes** | The URL to fetch metadata for |

**Response:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up (Official Music Video)",
  "description": "The official video for "Never Gonna Give You Up" by Rick Astley...",
  "image": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "siteName": "YouTube",
  "type": "video.other",
  "favicon": "https://www.youtube.com/favicon.ico"
}
```

**Response for Direct Image URLs:**
```json
{
  "url": "https://example.com/image.png",
  "type": "image",
  "image": "https://example.com/image.png",
  "title": "image.png"
}
```

**Features:**
- Extracts Open Graph (`og:`) meta tags
- Falls back to Twitter Card meta tags
- Falls back to standard `<title>` and `<meta name="description">`
- Extracts favicon
- 30-minute server-side cache
- 5-second timeout for external requests

**Errors:**
- `400`: URL is required
- `400`: Invalid URL
- `400`: Failed to fetch URL
- `400`: URL does not return HTML
- `408`: Request timeout
- `500`: Failed to fetch link metadata

**Example:**
```bash
# Get metadata for a YouTube video
curl "http://localhost:3000/api/utils/link-preview?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Get metadata for a tweet
curl "http://localhost:3000/api/utils/link-preview?url=https://x.com/elonmusk/status/123456789"
```

**Supported Platforms with Special Handling (Client-Side):**

| Platform | Detection | Features |
|----------|-----------|----------|
| YouTube | `youtube.com`, `youtu.be` | Video ID extraction, thumbnail URLs, embedded player, title & description on left, video on right |
| TikTok | `tiktok.com` | Video ID extraction, embedded player |
| Twitter/X | `twitter.com`, `x.com` | Tweet ID extraction, embedded tweet with dark theme |
| Generic | All other URLs | Standard Open Graph metadata card |

---

### System

#### Health Check
`GET /api/health`

Check system health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-04T16:00:00.000Z",
  "uptime": 3600.5,
  "archive": {
    "bufferedMessages": 25,
    "isProcessing": false
  }
}
```

Status will be `"unhealthy"` if database connection fails.

---

#### System Statistics
`GET /api/stats`

Get system-wide statistics.

**Response:**
```json
{
  "totalMessages": 50000,
  "totalUsers": 5000,
  "activeChannels": 10,
  "connectedClients": 25,
  "archiveBuffer": {
    "bufferedMessages": 25,
    "isProcessing": false
  }
}
```

---

## WebSocket API

The WebSocket API provides real-time updates for chat messages and moderation events using Socket.IO.

**URL:** `ws://localhost:3000/api/live`

### Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  path: '/api/live',
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('Connected to Chatterbox');
});

socket.on('disconnect', () => {
  console.log('Disconnected from Chatterbox');
});
```

### Client → Server Events

#### `subscribe`
Subscribe to channel updates.

**Payload:**
```javascript
// Multiple channels
socket.emit('subscribe', { channels: ['pokimane', 'xqc', 'forsen'] });

// Single channel
socket.emit('subscribe', { channels: 'pokimane' });
```

**Server Response:** `subscribed` event with confirmation

---

#### `unsubscribe`
Unsubscribe from channel updates.

**Payload:**
```javascript
socket.emit('unsubscribe', { channels: ['pokimane'] });
```

**Server Response:** `unsubscribed` event with confirmation

---

#### `ping`
Health check ping.

**Usage:**
```javascript
socket.emit('ping');
```

**Server Response:** `pong` event

---

### Server → Client Events

#### `chat_message`
New chat message received.

**Payload:**
```json
{
  "type": "message",
  "data": {
    "channelId": 1,
    "userId": 42,
    "message_text": "Hello chat! Kappa",
    "timestamp": "2025-12-04T15:45:30.123Z",
    "messageId": "abc123-def456-ghi789",
    "badges": [
      { "type": "subscriber", "version": "12" }
    ],
    "emotes": [
      { "id": "25", "start": 12, "end": 16 }
    ],
    "username": "chatuser123",
    "displayName": "ChatUser123",
    "user_display_name": "ChatUser123",
    "channel_name": "pokimane",
    "channelName": "pokimane",
    "channel_twitch_id": "12345678",
    "channelTwitchId": "12345678"
  },
  "timestamp": "2025-12-04T15:45:30.500Z"
}
```

**Example Handler:**
```javascript
socket.on('chat_message', (event) => {
  const { data } = event;
  console.log(`[${data.channel_name}] ${data.username}: ${data.message_text}`);
});
```

---

#### `message_deleted`
A message was deleted.

**Payload:**
```json
{
  "type": "delete",
  "data": {
    "messageId": "abc123-def456",
    "deletedAt": "2025-12-04T15:46:00.000Z"
  },
  "timestamp": "2025-12-04T15:46:00.500Z"
}
```

---

#### `mod_action`
A moderation action occurred.

**Ban Payload:**
```json
{
  "type": "mod_action",
  "data": {
    "id": 100,
    "channelId": 1,
    "moderatorId": null,
    "targetUserId": 42,
    "actionType": "ban",
    "action_type": "ban",
    "reason": "Spam",
    "timestamp": "2025-12-04T15:50:00.000Z",
    "target_username": "baduser",
    "targetUsername": "baduser",
    "target_display_name": "BadUser",
    "channel_name": "pokimane",
    "channelName": "pokimane",
    "channel_twitch_id": "12345678"
  },
  "timestamp": "2025-12-04T15:50:00.500Z"
}
```

**Timeout Payload:**
```json
{
  "type": "mod_action",
  "data": {
    "id": 101,
    "channelId": 1,
    "targetUserId": 42,
    "actionType": "timeout",
    "action_type": "timeout",
    "durationSeconds": 600,
    "duration_seconds": 600,
    "reason": null,
    "timestamp": "2025-12-04T15:51:00.000Z",
    "target_username": "spammer",
    "targetUsername": "spammer",
    "target_display_name": "Spammer",
    "channel_name": "pokimane",
    "channelName": "pokimane",
    "channel_twitch_id": "12345678"
  },
  "timestamp": "2025-12-04T15:51:00.500Z"
}
```

**Example Handler:**
```javascript
socket.on('mod_action', (event) => {
  const { data } = event;
  if (data.action_type === 'ban') {
    console.log(`${data.target_username} was banned in ${data.channel_name}`);
  } else if (data.action_type === 'timeout') {
    console.log(`${data.target_username} was timed out for ${data.duration_seconds}s`);
  }
});
```

---

#### `subscribed`
Confirmation of channel subscription.

**Payload:**
```json
{
  "channels": ["pokimane", "xqc"]
}
```

---

#### `unsubscribed`
Confirmation of channel unsubscription.

**Payload:**
```json
{
  "channels": ["pokimane"]
}
```

---

#### `pong`
Response to `ping` event (no payload).

---

## Error Handling

All error responses follow this format:

```json
{
  "error": "Error message description"
}
```

### HTTP Status Codes

| Status | Description |
|--------|-------------|
| `200` | Success |
| `201` | Created (for POST requests) |
| `400` | Bad Request - Invalid parameters |
| `404` | Not Found - Resource doesn't exist |
| `409` | Conflict - Resource already exists |
| `429` | Too Many Requests - Rate limited |
| `500` | Internal Server Error |

### Common Errors

**Missing required parameter:**
```json
{
  "error": "Search query is required"
}
```

**Resource not found:**
```json
{
  "error": "User not found"
}
```

**Duplicate resource:**
```json
{
  "error": "Channel already exists"
}
```

---

## Examples

### Example 1: Build a User Dashboard

```javascript
async function getUserDashboard(username) {
  // Get user profile
  const profile = await fetch(`/api/users/${username}`).then(r => r.json());
  
  // Get recent messages
  const messages = await fetch(`/api/users/${username}/messages?limit=10`)
    .then(r => r.json());
  
  // Get mod actions
  const modActions = await fetch(`/api/users/${username}/mod-actions?limit=5`)
    .then(r => r.json());
  
  return {
    profile,
    recentMessages: messages.messages,
    modActions: modActions.actions
  };
}
```

### Example 2: Real-time Chat Monitor

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  path: '/api/live'
});

// Subscribe to channels
socket.emit('subscribe', { channels: ['pokimane', 'xqc'] });

// Handle messages
socket.on('chat_message', (event) => {
  const msg = event.data;
  console.log(`[${msg.channel_name}] ${msg.username}: ${msg.message_text}`);
});

// Handle mod actions
socket.on('mod_action', (event) => {
  const action = event.data;
  const actionText = action.action_type === 'ban' 
    ? 'permanently banned'
    : `timed out for ${action.duration_seconds}s`;
  console.log(`⚠️ ${action.target_username} was ${actionText} in #${action.channel_name}`);
});
```

### Example 3: Search and Filter Messages

```javascript
async function searchMessages(options) {
  const params = new URLSearchParams();
  
  if (options.query) params.set('q', options.query);
  if (options.channel) params.set('channel', options.channel);
  if (options.user) params.set('user', options.user);
  if (options.limit) params.set('limit', options.limit);
  
  const response = await fetch(`/api/messages/search?${params}`);
  return response.json();
}

// Usage
const results = await searchMessages({
  query: 'LUL',
  channel: 'xqc',
  limit: 20
});
```

### Example 4: Moderation Analytics

```javascript
async function getChannelModerationReport(channelName, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  // Get mod action stats
  const stats = await fetch(
    `/api/mod-actions/stats?channel=${channelName}&since=${since.toISOString()}`
  ).then(r => r.json());
  
  // Get recent actions
  const actions = await fetch(
    `/api/mod-actions?channel=${channelName}&since=${since.toISOString()}&limit=100`
  ).then(r => r.json());
  
  return {
    summary: stats.action_counts,
    topModerators: stats.top_moderators,
    recentActions: actions.actions,
    totalActions: actions.total
  };
}
```

---

## LLM Integration Guide

This section provides structured information for Large Language Models to understand and build clients for the Chatterbox API.

### API Summary for LLMs

```yaml
name: Chatterbox API
version: 1.0.0
description: Twitch chat archival and moderation tracking system
base_url: http://localhost:3000/api
websocket_url: ws://localhost:3000/api/live
authentication: none
rate_limit: 100 requests/minute
```

### Endpoint Reference Table

| Method | Endpoint | Purpose | Key Parameters |
|--------|----------|---------|----------------|
| GET | `/messages` | List archived messages | `channel`, `user`, `since`, `until`, `search`, `limit`, `offset` |
| GET | `/messages/search` | Full-text search | `q` (required), `channel`, `user` |
| GET | `/messages/:id` | Get single message | - |
| GET | `/users` | List users | `search`, `channel` |
| GET | `/users/:username` | Get user profile | - |
| GET | `/users/:username/messages` | Get user's messages | `channel`, `since`, `until` |
| GET | `/users/:username/mod-actions` | Get user's mod history | - |
| GET | `/users/:username/stats` | Get user statistics | - |
| GET | `/mod-actions` | List mod actions | `type`, `channel`, `moderator`, `target`, `since`, `until` |
| GET | `/mod-actions/recent` | Get recent actions | `limit` (max 500) |
| GET | `/mod-actions/stats` | Get action statistics | `channel`, `since`, `until` |
| GET | `/channels` | List channels | `active` |
| GET | `/channels/:name` | Get channel info | - |
| GET | `/channels/:name/stats` | Get channel stats | `since`, `until` |
| GET | `/channels/:name/top-users` | Get top chatters | `limit`, `since`, `until` |
| GET | `/channels/:name/links` | Get messages with links | `limit`, `offset`, `since`, `until` |
| POST | `/channels` | Add channel | Body: `{ "name": "..." }` |
| PATCH | `/channels/:name` | Update channel | Body: `{ "is_active": bool }` |
| DELETE | `/channels/:name` | Remove channel | - |
| POST | `/channels/:name/rejoin` | Rejoin IRC | - |
| GET | `/utils/link-preview` | Get URL metadata | `url` (required) |
| GET | `/health` | Health check | - |
| GET | `/stats` | System stats | - |

### WebSocket Events Reference

**Client → Server:**
| Event | Payload | Description |
|-------|---------|-------------|
| `subscribe` | `{ channels: string[] }` | Subscribe to channel updates |
| `unsubscribe` | `{ channels: string[] }` | Unsubscribe from channels |
| `ping` | - | Health check |

**Server → Client:**
| Event | Description |
|-------|-------------|
| `message` | New message in subscribed channel |
| `message_deleted` | Message was deleted |
| `mod_action` | Ban/timeout occurred |
| `messages_flushed` | Messages batch saved to database (for cache invalidation) |
| `subscribed` | Subscription confirmed |
| `unsubscribed` | Unsubscription confirmed |
| `pong` | Response to ping |

#### messages_flushed Event

Emitted when a batch of messages is flushed from the server's buffer to the database. Useful for invalidating cached message queries after a mod action to ensure the latest messages are fetched.

**Payload:**
```json
{
  "usernames": ["user1", "user2"],
  "channels": ["channel1", "channel2"],
  "count": 42,
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `usernames` | `string[]` | Lowercase usernames of users whose messages were saved |
| `channels` | `string[]` | Lowercase channel names where messages were saved |
| `count` | `number` | Total number of messages flushed |
| `timestamp` | `string` | ISO 8601 timestamp of the flush |

**Use Case:** When a mod action (ban/timeout) occurs, the triggering message may still be in the server's buffer. Listen for `messages_flushed` and check if the target user is in the `usernames` array before fetching their messages to ensure you get the complete history.

### Data Type Reference

```typescript
// TypeScript interfaces for LLMs

interface Message {
  id: number;
  channel_id: number;
  user_id: number;
  message_text: string;
  timestamp: string; // ISO 8601
  message_id: string;
  badges: Badge[];
  emotes: Emote[];
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by_id: number | null;
  username: string;
  user_display_name: string;
  channel_name: string;
  channel_twitch_id: string;
}

interface User {
  id: number;
  twitch_id: string;
  username: string;
  display_name: string;
  first_seen: string;
  last_seen: string;
  total_messages?: number;
  channels_count?: number;
  ban_count?: number;
  timeout_count?: number;
  active_channels?: ChannelActivity[];
}

interface ModAction {
  id: number;
  channel_id: number;
  moderator_id: number | null;
  target_user_id: number;
  action_type: 'ban' | 'timeout' | 'delete' | 'clear' | 'unban' | 'untimeout';
  duration_seconds: number | null;
  reason: string | null;
  timestamp: string;
  channel_name: string;
  moderator_username: string | null;
  target_username: string;
}

interface Channel {
  id: number;
  twitch_id: string;
  name: string;
  display_name: string;
  created_at: string;
  is_active: boolean;
  message_count?: number;
}

interface Badge {
  type: string;
  version: string;
}

interface Emote {
  id: string;
  start: number;
  end: number;
}

interface ChannelActivity {
  name: string;
  display_name: string;
  message_count: number;
}
```

### Common Query Patterns

**Get all messages from a user in a specific channel:**
```
GET /api/users/{username}/messages?channel={channelName}&limit=100
```

**Find users who were banned:**
```
GET /api/mod-actions?type=ban&limit=100
```

**Get channel activity for the last 24 hours:**
```
GET /api/messages?channel={channelName}&since={isoDate24HoursAgo}
```

**Search for specific content:**
```
GET /api/messages/search?q={searchTerm}&channel={channelName}
```

### Building a Client: Step by Step

1. **Initialize REST client** with base URL `http://localhost:3000/api`
2. **Handle pagination** - use `limit` and `offset`, check `hasMore` in response
3. **Handle errors** - check for `error` field in JSON response
4. **For real-time features:**
   - Connect to WebSocket at `ws://localhost:3000/api/live`
   - Subscribe to channels with `subscribe` event
   - Listen for `chat_message`, `mod_action`, `message_deleted` events

### Code Generation Template

```javascript
// Template for generating API client code

class ChatterboxClient {
  constructor(baseUrl = 'http://localhost:3000/api') {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data;
  }

  // Messages
  getMessages(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/messages${query ? `?${query}` : ''}`);
  }

  searchMessages(q, params = {}) {
    const query = new URLSearchParams({ q, ...params }).toString();
    return this.request(`/messages/search?${query}`);
  }

  getMessage(id) {
    return this.request(`/messages/${id}`);
  }

  // Users
  getUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/users${query ? `?${query}` : ''}`);
  }

  getUser(username) {
    return this.request(`/users/${username}`);
  }

  getUserMessages(username, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/users/${username}/messages${query ? `?${query}` : ''}`);
  }

  getUserModActions(username, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/users/${username}/mod-actions${query ? `?${query}` : ''}`);
  }

  // Mod Actions
  getModActions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/mod-actions${query ? `?${query}` : ''}`);
  }

  getRecentModActions(limit = 100) {
    return this.request(`/mod-actions/recent?limit=${limit}`);
  }

  getModActionStats(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/mod-actions/stats${query ? `?${query}` : ''}`);
  }

  // Channels
  getChannels(active) {
    return this.request(`/channels${active !== undefined ? `?active=${active}` : ''}`);
  }

  getChannel(name) {
    return this.request(`/channels/${name}`);
  }

  getChannelStats(name, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/channels/${name}/stats${query ? `?${query}` : ''}`);
  }

  addChannel(name) {
    return this.request('/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
  }

  updateChannel(name, isActive) {
    return this.request(`/channels/${name}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive })
    });
  }

  removeChannel(name) {
    return this.request(`/channels/${name}`, { method: 'DELETE' });
  }

  // System
  getHealth() {
    return this.request('/health');
  }

  getStats() {
    return this.request('/stats');
  }
}
```

### WebSocket Client Template

```javascript
import { io } from 'socket.io-client';

class ChatterboxWebSocket {
  constructor(baseUrl = 'http://localhost:3000') {
    this.socket = io(baseUrl, {
      path: '/api/live',
      transports: ['websocket', 'polling']
    });
    
    this.handlers = {
      message: [],
      modAction: [],
      delete: []
    };

    this.socket.on('chat_message', (event) => {
      this.handlers.message.forEach(h => h(event.data));
    });

    this.socket.on('mod_action', (event) => {
      this.handlers.modAction.forEach(h => h(event.data));
    });

    this.socket.on('message_deleted', (event) => {
      this.handlers.delete.forEach(h => h(event.data));
    });
  }

  subscribe(channels) {
    this.socket.emit('subscribe', { 
      channels: Array.isArray(channels) ? channels : [channels] 
    });
  }

  unsubscribe(channels) {
    this.socket.emit('unsubscribe', { 
      channels: Array.isArray(channels) ? channels : [channels] 
    });
  }

  onMessage(handler) {
    this.handlers.message.push(handler);
  }

  onModAction(handler) {
    this.handlers.modAction.push(handler);
  }

  onDelete(handler) {
    this.handlers.delete.push(handler);
  }

  disconnect() {
    this.socket.disconnect();
  }
}
```

---

## Appendix

### Complete Endpoint List

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages` | List messages with filters |
| GET | `/api/messages/search` | Full-text search messages |
| GET | `/api/messages/:id` | Get message by ID |
| GET | `/api/users` | List users |
| GET | `/api/users/:username` | Get user profile |
| GET | `/api/users/:username/messages` | Get user's messages |
| GET | `/api/users/:username/mod-actions` | Get mod actions against user |
| GET | `/api/users/:username/stats` | Get user statistics |
| GET | `/api/mod-actions` | List mod actions |
| GET | `/api/mod-actions/recent` | Get recent mod actions |
| GET | `/api/mod-actions/stats` | Get mod action statistics |
| GET | `/api/channels` | List all channels |
| GET | `/api/channels/:name` | Get channel by name |
| GET | `/api/channels/:name/stats` | Get channel statistics |
| POST | `/api/channels` | Add new channel |
| PATCH | `/api/channels/:name` | Update channel status |
| DELETE | `/api/channels/:name` | Remove channel |
| POST | `/api/channels/:name/rejoin` | Rejoin channel IRC |
| GET | `/api/health` | Health check |
| GET | `/api/stats` | System statistics |

### Date Format

All dates use ISO 8601 format: `YYYY-MM-DDTHH:mm:ss.sssZ`

Example: `2025-12-04T15:45:30.123Z`

### Support

For issues or questions, refer to the project repository or documentation.
