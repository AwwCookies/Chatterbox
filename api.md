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
  - [User Analytics](#user-analytics)
  - [Mod Actions](#mod-actions)
  - [Channels](#channels)
  - [Utilities](#utilities)
  - [System](#system)
  - [Admin](#admin)
  - [OAuth Authentication](#oauth-authentication-user-login)
  - [Chat](#chat)
  - [User Data Requests](#user-data-requests)
  - [Admin User Request Management](#admin-user-request-management)
  - [Webhooks](#webhooks-discord-notifications)
  - [Discord OAuth Integration](#discord-oauth-integration)
  - [Admin Tiers](#admin-tiers)
  - [User Self-Service](#user-self-service)
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
- `GET /api/admin/*` - All admin endpoints
- `POST /api/admin/*` - All admin actions

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

Rate limits are applied per user based on their tier level. Authenticated users have limits defined by their assigned tier. Unauthenticated requests share a global rate limit pool.

### Tier-Based Rate Limits

| Tier | API Calls/Minute | Max Webhooks | Search Results | History Access |
|------|------------------|--------------|----------------|----------------|
| Free (default) | 30 | 2 | 100 | 7 days |
| Pro | 100 | 10 | 500 | 90 days |
| Enterprise | Unlimited | Unlimited | Unlimited | Unlimited |

**Note:** Admin users bypass all rate limits.

### Global Rate Limit (Unauthenticated)

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

**Tier Limit Exceeded Response:**
```json
{
  "error": "Rate limit exceeded",
  "limit": 30,
  "reset_in": 45
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

#### Get Message Thread
`GET /api/messages/:messageId/thread`

Retrieve a message thread containing the parent message and all replies.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `messageId` | string | Twitch message ID (UUID) |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `maxReplies` | integer | No | Maximum replies to return (default: 100) |

**Response:**
```json
{
  "parent": {
    "message_id": "abc123-def456",
    "message_text": "What do you think about this?",
    "timestamp": "2025-12-04T15:45:30.123Z",
    "username": "streamer123",
    "user_display_name": "Streamer123",
    "channel_name": "pokimane",
    "is_parent": true
  },
  "replies": [
    {
      "message_id": "def456-ghi789",
      "message_text": "@streamer123 I agree!",
      "timestamp": "2025-12-04T15:45:45.123Z",
      "username": "chatuser123",
      "user_display_name": "ChatUser123",
      "channel_name": "pokimane",
      "is_parent": false
    }
  ],
  "totalReplies": 1
}
```

**Errors:**
- `404`: Message thread not found

---

#### Get User Mentions
`GET /api/messages/mentions/:username`

Retrieve messages that mention a specific user with @username.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Username to find mentions for |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channelId` | integer | No | Filter by channel ID |
| `daysBack` | integer | No | Days of history to search (default: 30) |
| `maxResults` | integer | No | Maximum results (default: 100) |

**Response:**
```json
{
  "mentions": [
    {
      "message_id": "abc123-def456",
      "message_text": "@chatuser123 great point!",
      "timestamp": "2025-12-04T15:45:30.123Z",
      "username": "streamer123",
      "user_display_name": "Streamer123",
      "channel_name": "pokimane",
      "mentioned_users": ["chatuser123"]
    }
  ],
  "total": 1
}
```

---

#### Get Replies to User
`GET /api/messages/replies/:userId`

Retrieve all messages that are direct replies to messages by a specific user.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | integer | User's database ID |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channelId` | integer | No | Filter by channel ID |
| `limit` | integer | No | Results per page (default: 50) |
| `offset` | integer | No | Skip N results |

**Response:**
```json
{
  "replies": [
    {
      "id": 12345,
      "message_text": "@streamer123 I love this stream!",
      "timestamp": "2025-12-04T15:45:30.123Z",
      "username": "chatuser123",
      "user_display_name": "ChatUser123",
      "channel_name": "pokimane",
      "parent_message_text": "Welcome to the stream!",
      "parent_username": "streamer123",
      "parent_display_name": "Streamer123"
    }
  ],
  "total": 50,
  "limit": 50,
  "offset": 0
}
```

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
| `search` | string | No | Search username/display name (fuzzy match) |
| `username` | string | No | Exact username match |
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
      "last_seen": "2025-12-04T15:45:00.000Z",
      "is_blocked": false,
      "message_count": 1250,
      "timeout_count": 2,
      "ban_count": 0
    }
  ]
}
```

---

#### Get Top Users
`GET /api/users/top`

Get users sorted by message count.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Results per page (default: 50) |
| `offset` | integer | No | Skip N results |
| `channelId` | integer | No | Filter by channel ID |
| `since` | ISO date | No | Start date filter |
| `until` | ISO date | No | End date filter |

**Response:**
```json
{
  "users": [
    {
      "id": 42,
      "username": "chatuser123",
      "display_name": "ChatUser123",
      "twitch_id": "87654321",
      "first_seen": "2025-01-15T10:30:00.000Z",
      "last_seen": "2025-12-04T15:45:00.000Z",
      "is_blocked": false,
      "message_count": 1250,
      "timeout_count": 2,
      "ban_count": 0
    }
  ],
  "total": 5000,
  "hasMore": true
}
```

---

#### Get Blocked Users
`GET /api/users/blocked`

Get all blocked users. **Requires authentication.**

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Results per page (default: 50) |
| `offset` | integer | No | Skip N results |

**Response:**
```json
{
  "users": [
    {
      "id": 42,
      "username": "baduser",
      "display_name": "BadUser",
      "twitch_id": "12345678",
      "is_blocked": true,
      "blocked_at": "2025-12-01T10:00:00.000Z",
      "blocked_reason": "Spam"
    }
  ],
  "total": 10,
  "hasMore": false
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

#### Export User Data
`GET /api/users/:username/export`

Export all data for a user including messages, mod actions, and profile. **Requires authentication.**

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Username |

**Response:**
```json
{
  "user": {
    "id": 42,
    "username": "chatuser123",
    "display_name": "ChatUser123",
    "twitch_id": "87654321",
    "first_seen": "2025-01-15T10:30:00.000Z",
    "last_seen": "2025-12-04T15:45:00.000Z",
    "is_blocked": false,
    "notes": "Friendly chatter"
  },
  "stats": {
    "total_messages": 1250,
    "total_timeouts": 2,
    "total_bans": 0
  },
  "messages": [
    {
      "id": 123,
      "content": "Hello everyone!",
      "timestamp": "2025-12-04T15:45:00.000Z",
      "channel_name": "pokimane"
    }
  ],
  "modActions": [
    {
      "id": 1,
      "action_type": "timeout",
      "channel_name": "pokimane",
      "timestamp": "2025-12-01T10:00:00.000Z"
    }
  ],
  "exportedAt": "2025-12-04T16:00:00.000Z"
}
```

---

#### Block User
`POST /api/users/:username/block`

Block a user from being logged. Their future messages will not be stored. **Requires authentication.**

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Username |

**Request Body:**
```json
{
  "reason": "Spam"
}
```

**Response:**
```json
{
  "message": "User blocked successfully",
  "user": {
    "id": 42,
    "username": "chatuser123",
    "is_blocked": true,
    "blocked_at": "2025-12-04T16:00:00.000Z",
    "blocked_reason": "Spam"
  }
}
```

---

#### Unblock User
`POST /api/users/:username/unblock`

Unblock a previously blocked user. **Requires authentication.**

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Username |

**Response:**
```json
{
  "message": "User unblocked successfully",
  "user": {
    "id": 42,
    "username": "chatuser123",
    "is_blocked": false
  }
}
```

---

#### Update User Notes
`PATCH /api/users/:username/notes`

Update admin notes for a user. **Requires authentication.**

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Username |

**Request Body:**
```json
{
  "notes": "Friendly regular viewer"
}
```

**Response:**
```json
{
  "message": "Notes updated successfully",
  "user": {
    "id": 42,
    "username": "chatuser123",
    "notes": "Friendly regular viewer"
  }
}
```

---

#### Delete User Messages
`DELETE /api/users/:username/messages`

Delete all messages from a user. **Requires authentication.**

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Username |

**Response:**
```json
{
  "message": "Deleted 1250 messages for user chatuser123",
  "deletedCount": 1250
}
```

---

#### Delete User
`DELETE /api/users/:username`

Delete a user and all their data (messages, mod actions). **Requires authentication.**

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Username |

**Response:**
```json
{
  "message": "User chatuser123 and all associated data deleted successfully",
  "deleted": {
    "messages": 1250,
    "modActionsAsTarget": 5,
    "modActionsAsModerator": 0
  }
}
```

---

### User Analytics

#### Get Activity Patterns
`GET /api/users/:username/analytics/activity`

Get hourly and daily activity patterns showing when a user is most active.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Username |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `days` | integer | No | Days to analyze (default: 30, max: 365) |

**Response:**
```json
{
  "user": { "username": "chatuser123", "display_name": "ChatUser123" },
  "period": "30 days",
  "hourly": [
    { "hour": 0, "messageCount": 45 },
    { "hour": 14, "messageCount": 250 },
    { "hour": 15, "messageCount": 310 }
  ],
  "weekday": [
    { "day": 0, "messageCount": 500 },
    { "day": 1, "messageCount": 450 }
  ],
  "daily": [
    { "day": "2025-12-04T00:00:00.000Z", "messageCount": 125 },
    { "day": "2025-12-03T00:00:00.000Z", "messageCount": 98 }
  ]
}
```

---

#### Get Channel Breakdown
`GET /api/users/:username/analytics/channels`

Get breakdown of user's activity across different channels.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Username |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `days` | integer | No | Days to analyze (default: 30, max: 365) |

**Response:**
```json
{
  "user": { "username": "chatuser123", "display_name": "ChatUser123" },
  "period": "30 days",
  "channels": [
    {
      "name": "pokimane",
      "displayName": "Pokimane",
      "messageCount": 520,
      "activeDays": 15,
      "firstMessage": "2025-11-04T12:30:00.000Z",
      "lastMessage": "2025-12-04T18:45:00.000Z"
    }
  ]
}
```

---

#### Get Most Used Emotes
`GET /api/users/:username/analytics/emotes`

Get the user's most frequently used emotes.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Username |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `days` | integer | No | Days to analyze (default: 30, max: 365) |
| `limit` | integer | No | Number of emotes to return (default: 20, max: 100) |

**Response:**
```json
{
  "user": { "username": "chatuser123", "display_name": "ChatUser123" },
  "period": "30 days",
  "emotes": [
    { "emote": "KEKW", "count": 150 },
    { "emote": "OMEGALUL", "count": 89 },
    { "emote": "PogChamp", "count": 45 }
  ]
}
```

---

#### Get Analytics Summary
`GET /api/users/:username/analytics/summary`

Get a comprehensive analytics summary for a user.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Username |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `days` | integer | No | Days to analyze (default: 30, max: 365) |

**Response:**
```json
{
  "user": { "username": "chatuser123", "display_name": "ChatUser123" },
  "period": "30 days",
  "summary": {
    "totalMessages": 1250,
    "activeDays": 22,
    "avgMessageLength": 45,
    "maxMessageLength": 280,
    "deletedMessages": 3,
    "peakHour": 15,
    "peakHourMessages": 310,
    "currentStreak": 5,
    "bans": 0,
    "timeouts": 2,
    "deletions": 1
  }
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

Get all monitored channels with their connection and streaming status.

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
      "is_joined": true,
      "is_live": true,
      "viewer_count": 15432,
      "game_name": "Just Chatting",
      "stream_title": "morning stream!",
      "profile_image_url": "https://static-cdn.jtvnw.net/jtv_user_pictures/pokimane-profile_image.png",
      "message_count": 154320
    }
  ]
}
```

**Channel Status Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `is_joined` | boolean | Whether the bot is connected to the channel's IRC chat |
| `is_live` | boolean | Whether the channel is currently streaming on Twitch |
| `viewer_count` | number | Current viewer count (only when `is_live` is true) |
| `game_name` | string | Current game/category (only when `is_live` is true) |
| `stream_title` | string | Current stream title (only when `is_live` is true) |
| `started_at` | string | ISO timestamp of when the stream started (only when `is_live` is true) |
| `profile_image_url` | string | URL to the channel's Twitch profile picture |

---

#### Get Live Status
`GET /api/channels/live/status`

Force refresh and get Twitch streaming status for all active channels.

**Response:**
```json
{
  "configured": true,
  "channels": [
    {
      "name": "pokimane",
      "is_live": true,
      "viewer_count": 15432,
      "game_name": "Just Chatting",
      "title": "morning stream!",
      "started_at": "2025-01-15T10:30:00.000Z"
    },
    {
      "name": "xqc",
      "is_live": false
    }
  ]
}
```

**Note:** If Twitch API is not configured (missing `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`), returns `configured: false` with all channels showing `is_live: false`.

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
  "is_active": true,
  "is_joined": true,
  "is_live": true,
  "viewer_count": 15432,
  "game_name": "Just Chatting",
  "stream_title": "morning stream!",
  "started_at": "2025-01-15T10:30:00.000Z",
  "profile_image_url": "https://static-cdn.jtvnw.net/jtv_user_pictures/pokimane-profile_image.png"
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

### Admin

All admin endpoints require authentication via `X-API-Key` header.

#### Get System Information
`GET /api/admin/system`

Get comprehensive system information including Node.js, memory, CPU, and OS details.

**Response:**
```json
{
  "server": {
    "nodeVersion": "v20.10.0",
    "platform": "linux",
    "arch": "x64",
    "pid": 1234,
    "uptime": 3600.5,
    "startTime": "2025-12-04T12:00:00.000Z"
  },
  "memory": {
    "rss": 67108864,
    "heapTotal": 33554432,
    "heapUsed": 25165824,
    "external": 1048576,
    "arrayBuffers": 524288,
    "systemTotal": 17179869184,
    "systemFree": 8589934592
  },
  "cpu": {
    "cores": 8,
    "model": "Intel(R) Core(TM) i7-10700K",
    "speed": 3800,
    "loadAvg": [1.5, 1.2, 0.8]
  },
  "os": {
    "type": "Linux",
    "release": "5.15.0-generic",
    "hostname": "chatterbox-server",
    "uptime": 86400
  },
  "env": {
    "nodeEnv": "production",
    "port": 3000,
    "logLevel": "info"
  }
}
```

---

#### Get Database Statistics
`GET /api/admin/database`

Get database statistics, table sizes, connection info, and query stats.

**Response:**
```json
{
  "size": 1073741824,
  "version": "PostgreSQL 15.4",
  "tables": [
    {
      "name": "messages",
      "totalSize": 536870912,
      "tableSize": 402653184,
      "indexesSize": 134217728,
      "rowCount": 1500000
    }
  ],
  "connections": {
    "total": 10,
    "active": 2,
    "idle": 8,
    "idleInTransaction": 0
  },
  "stats": {
    "transactionsCommitted": 50000,
    "transactionsRolledBack": 5,
    "cacheHitRatio": 99.5,
    "tuplesReturned": 1000000,
    "tuplesFetched": 500000,
    "tuplesInserted": 100000,
    "tuplesUpdated": 1000,
    "tuplesDeleted": 500,
    "conflicts": 0,
    "deadlocks": 0
  }
}
```

---

#### Get Analytics
`GET /api/admin/analytics`

Get detailed analytics about messages, users, and activity over a specified period.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | `24h` | Time period: `1h`, `6h`, `24h`, `7d`, `30d` |

**Response:**
```json
{
  "period": "24h",
  "messagesOverTime": [
    { "hour": "2025-12-04T12:00:00.000Z", "count": 1500 }
  ],
  "modActionsOverTime": [
    { "hour": "2025-12-04T12:00:00.000Z", "actionType": "timeout", "count": 5 }
  ],
  "topChatters": [
    { "username": "chatuser123", "displayName": "ChatUser123", "messageCount": 500 }
  ],
  "channelActivity": [
    { "name": "pokimane", "displayName": "Pokimane", "messageCount": 5000, "uniqueUsers": 500 }
  ],
  "modActionBreakdown": [
    { "actionType": "timeout", "count": 25 },
    { "actionType": "ban", "count": 5 }
  ],
  "peakHours": [
    { "hour": 20, "count": 15000 }
  ],
  "dailyMessages": [
    { "date": "2025-12-04", "count": 50000 }
  ]
}
```

---

#### Get Services Status
`GET /api/admin/services`

Get status of all services (Twitch IRC, WebSocket, Archive, Database).

**Response:**
```json
{
  "services": {
    "database": {
      "name": "PostgreSQL",
      "status": "healthy",
      "connected": true
    },
    "twitch": {
      "name": "Twitch IRC",
      "status": "healthy",
      "connected": true,
      "channels": ["pokimane", "xqc"],
      "username": "botusername"
    },
    "websocket": {
      "name": "WebSocket Server",
      "status": "healthy",
      "connectedClients": 25
    },
    "archive": {
      "name": "Archive Service",
      "status": "healthy",
      "stats": {
        "pendingMessages": 10,
        "totalArchived": 500000
      }
    }
  }
}
```

---

#### Get Server Configuration
`GET /api/admin/config`

Get current server configuration (sensitive values redacted).

**Response:**
```json
{
  "server": {
    "port": 3000,
    "nodeEnv": "production",
    "logLevel": "info"
  },
  "database": {
    "host": "postgres",
    "port": 5432,
    "name": "twitch_archive",
    "user": "twitch"
  },
  "twitch": {
    "username": "botusername",
    "channels": ["pokimane", "xqc"]
  },
  "client": {
    "url": "https://chatterbox.example.com"
  },
  "features": {
    "apiKeyConfigured": true
  }
}
```

---

#### Get Performance Metrics
`GET /api/admin/performance`

Get database performance metrics including slow queries, table bloat, and index usage.

**Response:**
```json
{
  "slowQueries": [
    {
      "query": "SELECT * FROM messages WHERE...",
      "calls": 1000,
      "totalTime": 5000.5,
      "meanTime": 5.0,
      "rows": 50000
    }
  ],
  "tableBloat": [
    {
      "tableName": "public.messages",
      "deadTuples": 5000,
      "liveTuples": 1500000,
      "deadTuplePercent": 0.33,
      "lastVacuum": null,
      "lastAutovacuum": "2025-12-04T10:00:00.000Z"
    }
  ],
  "indexUsage": [
    {
      "tableName": "public.messages",
      "indexName": "messages_channel_idx",
      "scans": 50000,
      "tuplesRead": 100000,
      "tuplesFetched": 50000,
      "indexSize": 67108864
    }
  ]
}
```

---

#### Restart Service
`POST /api/admin/services/:service/restart`

Restart a specific service.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `service` | string | Service to restart: `twitch`, `archive` |

**Response:**
```json
{
  "success": true,
  "message": "Twitch IRC reconnecting..."
}
```

**Errors:**
- `400`: Unknown service
- `404`: Service not available

---

#### Run Database Vacuum
`POST /api/admin/database/vacuum`

Run VACUUM ANALYZE on database tables to reclaim space and update statistics.

**Request Body:**
```json
{
  "table": "messages"  // Optional, omit to vacuum all tables
}
```

**Response:**
```json
{
  "success": true,
  "message": "VACUUM ANALYZE completed on messages"
}
```

**Errors:**
- `400`: Invalid table name

---

#### Get Server Settings
`GET /api/admin/settings`

Get all server configuration settings including defaults and current values. These are configurable runtime settings (rate limits, timeouts, etc.).

**Response:**
```json
{
  "configs": [
    {
      "key": "rateLimit.windowMs",
      "value": 60000,
      "defaultValue": 60000,
      "description": "Rate limit window in milliseconds",
      "type": "number"
    },
    {
      "key": "rateLimit.maxRequests",
      "value": 10000,
      "defaultValue": 10000,
      "description": "Maximum requests per rate limit window",
      "type": "number"
    }
  ]
}
```

---

#### Update Setting Value
`PUT /api/admin/settings/:key`

Update a specific server setting value.

**URL Parameters:**
- `key` - Setting key (e.g., `rateLimit.windowMs`)

**Request Body:**
```json
{
  "value": 30000,
  "description": "Optional description"
}
```

**Response:**
```json
{
  "message": "Configuration updated",
  "key": "rateLimit.windowMs",
  "value": 30000
}
```

---

#### Reset Setting to Default
`DELETE /api/admin/settings/:key`

Reset a setting value back to its default.

**URL Parameters:**
- `key` - Setting key

**Response:**
```json
{
  "message": "Configuration reset to default",
  "key": "rateLimit.windowMs",
  "value": 60000
}
```

---

#### Bulk Update Settings
`POST /api/admin/settings/bulk`

Update multiple server settings at once.

**Request Body:**
```json
{
  "configs": [
    { "key": "rateLimit.windowMs", "value": 30000 },
    { "key": "rateLimit.maxRequests", "value": 5000 }
  ]
}
```

**Response:**
```json
{
  "message": "Updated 2 configuration values"
}
```

---

#### Get System Configuration
`GET /api/admin/config`

Get system configuration info (environment, port, database info). This is read-only system information.

**Response:**
```json
{
  "server": {
    "port": 5000,
    "nodeEnv": "production"
  },
  "database": {
    "host": "localhost",
    "database": "chatterbox"
  },
  "twitch": {
    "clientIdConfigured": true,
    "callbackUrl": "https://example.com/auth/callback"
  }
}
```

---

#### Get Traffic Analytics
`GET /api/admin/traffic`

Get traffic analytics data for monitoring server activity.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `timeRange` | string | `day` | Time range: `hour`, `day`, `week` |

**Response:**
```json
{
  "stats": {
    "totalRequests": 150000,
    "uniqueIps": 1250,
    "totalErrors": 150,
    "topEndpoints": [
      { "method": "GET", "path": "/api/messages", "count": 50000 }
    ],
    "ipStats": {
      "192.168.1.100": {
        "requests": 5000,
        "errors": 5,
        "lastSeen": "2025-12-05T20:00:00.000Z"
      }
    }
  }
}
```

---

#### Cleanup Traffic Logs
`DELETE /api/admin/traffic/cleanup`

Delete old traffic logs to free up space.

**Request Body:**
```json
{
  "olderThanDays": 30
}
```

**Response:**
```json
{
  "message": "Cleaned up traffic logs older than 30 days",
  "deletedCount": 500000
}
```

---

#### Get IP Rules
`GET /api/admin/ip-rules`

Get all IP blocking/rate limiting rules.

**Response:**
```json
{
  "rules": [
    {
      "id": 1,
      "ip_address": "192.168.1.100",
      "rule_type": "block",
      "reason": "Spam abuse",
      "rate_limit_override": null,
      "expires_at": "2025-12-10T00:00:00.000Z",
      "created_at": "2025-12-05T20:00:00.000Z"
    }
  ]
}
```

---

#### Get IP Status
`GET /api/admin/ip-rules/:ip/status`

Get current status for a specific IP address.

**URL Parameters:**
- `ip` - IP address to check

**Response:**
```json
{
  "ip": "192.168.1.100",
  "blocked": false,
  "rateLimitOverride": null,
  "requests": 1500,
  "errors": 2,
  "lastSeen": "2025-12-05T20:00:00.000Z"
}
```

---

#### Block IP Address
`POST /api/admin/ip-rules/block`

Block an IP address from accessing the API.

**Request Body:**
```json
{
  "ip": "192.168.1.100",
  "reason": "Spam abuse",
  "expiresAt": "2025-12-10T00:00:00.000Z"
}
```

**Response:**
```json
{
  "message": "IP 192.168.1.100 has been blocked",
  "ip": "192.168.1.100"
}
```

---

#### Unblock IP Address
`POST /api/admin/ip-rules/unblock`

Remove a block on an IP address.

**Request Body:**
```json
{
  "ip": "192.168.1.100"
}
```

**Response:**
```json
{
  "message": "IP 192.168.1.100 has been unblocked",
  "ip": "192.168.1.100"
}
```

---

#### Set IP Rate Limit Override
`POST /api/admin/ip-rules/rate-limit`

Set a custom rate limit for a specific IP address.

**Request Body:**
```json
{
  "ip": "192.168.1.100",
  "limit": 500,
  "expiresAt": "2025-12-10T00:00:00.000Z"
}
```

**Response:**
```json
{
  "message": "Rate limit for 192.168.1.100 set to 500",
  "ip": "192.168.1.100",
  "limit": 500
}
```

**Notes:**
- Set `limit` to `null` to remove the override (whitelist)
- Without an `expiresAt`, the rule is permanent

---

#### Delete IP Rule
`DELETE /api/admin/ip-rules/:id`

Delete an IP rule by its ID.

**URL Parameters:**
- `id` - Rule ID

**Response:**
```json
{
  "message": "IP rule deleted"
}
```

---

### Server Logs

Access server logs in real-time for monitoring and debugging.

#### Get Logs
`GET /api/admin/logs`

Retrieve server logs with filtering and pagination.

**Authentication:** Bearer token (admin) or X-API-Key required

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `level` | string | - | Filter by log level(s), comma-separated (error,warn,info,debug) |
| `search` | string | - | Search term to filter logs by message or metadata |
| `since` | ISO8601 | - | Get logs after this timestamp |
| `until` | ISO8601 | - | Get logs before this timestamp |
| `limit` | number | 100 | Maximum logs to return (max 1000) |
| `offset` | number | 0 | Pagination offset |
| `order` | string | desc | Sort order: 'asc' or 'desc' |

**Response:**
```json
{
  "logs": [
    {
      "id": 12345,
      "timestamp": "2025-12-06T23:30:00.000Z",
      "level": "info",
      "message": "User xrubenxo timed out for 30s in vedal987",
      "meta": {
        "userId": 1321575,
        "channelId": 38
      }
    }
  ],
  "total": 5000,
  "limit": 100,
  "offset": 0,
  "hasMore": true
}
```

---

#### Get Log Statistics
`GET /api/admin/logs/stats`

Get summary statistics about current logs.

**Authentication:** Bearer token (admin) or X-API-Key required

**Response:**
```json
{
  "total": 10000,
  "byLevel": {
    "error": 42,
    "warn": 156,
    "info": 9500,
    "debug": 302
  },
  "recentErrors": [
    {
      "id": 9999,
      "timestamp": "2025-12-06T23:29:40.000Z",
      "level": "error",
      "message": "Query error: duplicate key value violates unique constraint"
    }
  ],
  "oldestLog": "2025-12-06T20:00:00.000Z",
  "newestLog": "2025-12-06T23:30:00.000Z"
}
```

---

#### Stream Logs
`GET /api/admin/logs/stream`

Get new logs since a given ID (for real-time polling).

**Authentication:** Bearer token (admin) or X-API-Key required

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `lastId` | number | 0 | Get logs with ID greater than this |

**Response:**
```json
{
  "logs": [
    {
      "id": 12346,
      "timestamp": "2025-12-06T23:30:01.000Z",
      "level": "info",
      "message": "Flushed 156 messages to database"
    }
  ],
  "lastId": 12346
}
```

---

#### Clear Logs
`DELETE /api/admin/logs`

Clear all in-memory logs.

**Authentication:** Bearer token (admin) or X-API-Key required

**Response:**
```json
{
  "message": "Logs cleared"
}
```

---

### OAuth Authentication (User Login)

Chatterbox supports Twitch OAuth login for users to access personalized features like viewing their followed channels.

#### Initiate OAuth Login
`GET /api/oauth/login`

Redirects the user to Twitch's OAuth authorization page.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `redirect` | string | Optional URL to redirect to after successful login |

**Response:** 302 redirect to Twitch OAuth authorization

---

#### OAuth Callback
`GET /api/oauth/callback`

Handles the OAuth callback from Twitch after user authorization.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | string | Authorization code from Twitch |
| `state` | string | State token for CSRF protection |

**Response:** 302 redirect to client with tokens in query params
```
/auth/callback?accessToken=...&refreshToken=...&user=...
```

**Error Response:** Redirect with error
```
/login?error=invalid_state
```

---

#### Refresh Access Token
`POST /api/oauth/refresh`

Refresh an expired access token using a valid refresh token.

**Request Body:**
```json
{
  "refreshToken": "your-refresh-token"
}
```

**Response:**
```json
{
  "accessToken": "new-jwt-access-token",
  "expiresIn": 900
}
```

**Errors:**
- `400`: Refresh token required
- `401`: Invalid or expired refresh token

---

#### Logout
`POST /api/oauth/logout`

**Authentication:** Bearer token required

Invalidate the current session's refresh token.

**Request Body:**
```json
{
  "refreshToken": "current-refresh-token"
}
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

---

#### Logout All Sessions
`POST /api/oauth/logout-all`

**Authentication:** Bearer token required

Invalidate all refresh tokens for the current user.

**Response:**
```json
{
  "message": "All sessions logged out"
}
```

---

#### Get Current User
`GET /api/oauth/me`

**Authentication:** Bearer token required

Get the current authenticated user's profile and pending requests.

**Response:**
```json
{
  "user": {
    "id": 1,
    "twitch_id": "12345678",
    "username": "cooluser",
    "display_name": "CoolUser",
    "email": "user@example.com",
    "profile_image_url": "https://static-cdn.jtvnw.net/...",
    "is_admin": false,
    "created_at": "2025-01-15T10:30:00.000Z"
  },
  "requests": [
    {
      "id": 1,
      "request_type": "export",
      "status": "pending",
      "created_at": "2025-01-15T12:00:00.000Z"
    }
  ]
}
```

---

#### Get Followed Streams
`GET /api/oauth/followed-streams`

**Authentication:** Bearer token required

Get live streams from channels the authenticated user follows on Twitch.

**Response:**
```json
{
  "streams": [
    {
      "id": "123456789",
      "user_id": "87654321",
      "user_login": "pokimane",
      "user_name": "Pokimane",
      "game_id": "509658",
      "game_name": "Just Chatting",
      "title": "chill stream!",
      "viewer_count": 25000,
      "started_at": "2025-01-15T18:00:00.000Z",
      "language": "en",
      "thumbnail_url": "https://static-cdn.jtvnw.net/...",
      "tags": ["English", "Chill"],
      "is_mature": false
    }
  ],
  "total": 5
}
```

---

### Chat

Send chat messages to Twitch channels on behalf of the authenticated user.

> **Note:** This endpoint requires the user to have authorized the following OAuth scopes: `user:write:chat`, `user:bot`, `channel:bot`. Users may need to re-login to grant these permissions if they logged in before these scopes were added.

#### Send Chat Message
`POST /api/chat/send`

**Authentication:** Bearer token required

Send a message to a Twitch channel's chat. The message will be sent as the authenticated user.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `channel` | string | Yes | The channel name to send the message to (without #) |
| `message` | string | Yes | The message content (max 500 characters) |

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/chat/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "channel": "pokimane",
    "message": "Hello chat!"
  }'
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Message sent successfully"
}
```

**Error Responses:**

*Missing Fields (400):*
```json
{
  "error": "Channel and message are required"
}
```

*Message Too Long (400):*
```json
{
  "error": "Message must be 500 characters or less"
}
```

*Channel Not Found (404):*
```json
{
  "error": "Channel not found"
}
```

*Token Expired/Invalid (401):*
```json
{
  "error": "Failed to send message - token may need refresh"
}
```

*Twitch API Error (500):*
```json
{
  "error": "Twitch API error: <error_message>"
}
```

---

### User Data Requests

Users can request export or deletion of their data. These requests require admin approval.

#### Create Data Request
`POST /api/oauth/requests`

**Authentication:** Bearer token required

Create a new data export or deletion request.

**Request Body:**
```json
{
  "type": "export",  // or "delete"
  "notes": "Optional notes about the request"
}
```

**Response:**
```json
{
  "request": {
    "id": 1,
    "user_id": 1,
    "request_type": "export",
    "status": "pending",
    "user_notes": "Optional notes about the request",
    "created_at": "2025-01-15T12:00:00.000Z"
  }
}
```

**Errors:**
- `400`: Invalid request type or duplicate pending request
- `401`: Not authenticated

---

#### Cancel Data Request
`DELETE /api/oauth/requests/:id`

**Authentication:** Bearer token required

Cancel a pending data request (only the owner can cancel).

**Response:**
```json
{
  "message": "Request cancelled"
}
```

**Errors:**
- `400`: Cannot cancel non-pending requests
- `403`: Not authorized to cancel this request
- `404`: Request not found

---

### Admin User Request Management

Admin endpoints for managing user data requests. Require both Bearer token (admin user) and API key.

#### List All User Requests
`GET /api/admin/user-requests`

**Authentication:** Bearer token (admin) + X-API-Key

Get all user requests with filtering and pagination.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | - | Filter by status: `pending`, `approved`, `denied`, `completed`, `cancelled` |
| `type` | string | - | Filter by type: `export`, `delete` |
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Results per page |

**Response:**
```json
{
  "requests": [
    {
      "id": 1,
      "user_id": 1,
      "request_type": "export",
      "status": "pending",
      "user_notes": "I need my data",
      "admin_notes": null,
      "created_at": "2025-01-15T12:00:00.000Z",
      "username": "cooluser",
      "display_name": "CoolUser",
      "profile_image_url": "https://..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

---

#### Get Pending Requests
`GET /api/admin/user-requests/pending`

**Authentication:** Bearer token (admin) + X-API-Key

Get only pending requests for quick admin review.

**Response:**
```json
{
  "requests": [...],
  "count": 3
}
```

---

#### Get Request Details
`GET /api/admin/user-requests/:id`

**Authentication:** Bearer token (admin) + X-API-Key

Get detailed information about a specific request, including user stats.

**Response:**
```json
{
  "request": {
    "id": 1,
    "user_id": 1,
    "request_type": "export",
    "status": "pending",
    "user_notes": "I need my data",
    "admin_notes": null,
    "created_at": "2025-01-15T12:00:00.000Z",
    "updated_at": "2025-01-15T12:00:00.000Z"
  },
  "user": {
    "id": 1,
    "twitch_id": "12345678",
    "username": "cooluser",
    "display_name": "CoolUser",
    "profile_image_url": "https://..."
  },
  "stats": {
    "messageCount": 1500,
    "modActionCount": 2,
    "channelCount": 5
  }
}
```

---

#### Approve Request
`POST /api/admin/user-requests/:id/approve`

**Authentication:** Bearer token (admin) + X-API-Key

Approve a pending request. For export requests, generates a data download URL. For delete requests, executes the deletion.

**Request Body:**
```json
{
  "notes": "Optional admin notes"
}
```

**Response (Export):**
```json
{
  "message": "Export request approved",
  "request": {
    "id": 1,
    "status": "completed",
    "download_url": "data:application/json;base64,..."
  }
}
```

**Response (Delete):**
```json
{
  "message": "Delete request approved and executed",
  "request": {
    "id": 1,
    "status": "completed"
  },
  "deleted": {
    "messages": 1500,
    "modActions": 2,
    "user": true
  }
}
```

**Errors:**
- `400`: Request not pending
- `404`: Request not found

---

#### Deny Request
`POST /api/admin/user-requests/:id/deny`

**Authentication:** Bearer token (admin) + X-API-Key

Deny a pending request with optional explanation.

**Request Body:**
```json
{
  "notes": "Reason for denial"
}
```

**Response:**
```json
{
  "message": "Request denied",
  "request": {
    "id": 1,
    "status": "denied",
    "admin_notes": "Reason for denial"
  }
}
```

---

#### List OAuth Users
`GET /api/admin/oauth-users`

**Authentication:** Bearer token (admin) + X-API-Key

List all users who have logged in via OAuth.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Results per page |

**Response:**
```json
{
  "users": [
    {
      "id": 1,
      "twitch_id": "12345678",
      "username": "cooluser",
      "display_name": "CoolUser",
      "profile_image_url": "https://...",
      "is_admin": false,
      "created_at": "2025-01-15T10:30:00.000Z",
      "last_login": "2025-01-16T08:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 10,
    "pages": 1
  }
}
```

---

#### Set User Admin Status
`POST /api/admin/oauth-users/:id/admin`

**Authentication:** Bearer token (admin) + X-API-Key

Grant or revoke admin status for an OAuth user.

**Request Body:**
```json
{
  "isAdmin": true
}
```

**Response:**
```json
{
  "message": "Admin status updated",
  "user": {
    "id": 1,
    "username": "cooluser",
    "is_admin": true
  }
}
```

---

#### Delete OAuth User
`DELETE /api/admin/oauth-users/:id`

**Authentication:** Bearer token (admin) + X-API-Key

Delete an OAuth user and all their associated data (sessions, requests).

**URL Parameters:**
- `id` - User ID

**Response:**
```json
{
  "message": "User deleted successfully"
}
```

**Error Responses:**
- `400`: Cannot delete your own account
- `404`: User not found

---

### Webhooks (Discord Notifications)

Webhooks allow users and admins to receive Discord notifications for various events. Users can create webhooks for their tracked users, mod actions, and stream events. Admins can create webhooks for system events.

#### List User Webhooks
`GET /api/webhooks`

**Authentication:** Bearer token required

Get all webhooks for the authenticated user.

**Response:**
```json
{
  "webhooks": [
    {
      "id": 1,
      "name": "My Tracked Users",
      "event_type": "tracked_user_message",
      "config": {
        "tracked_usernames": ["streamer1", "streamer2"]
      },
      "enabled": true,
      "muted": false,
      "folder": "Alerts",
      "trigger_count": 42,
      "consecutive_failures": 0,
      "last_triggered_at": "2025-01-16T10:30:00.000Z",
      "created_at": "2025-01-15T08:00:00.000Z"
    }
  ],
  "limits": {
    "maxPerUser": 10,
    "maxUrlsPerUser": 20,
    "maxTrackedUsernames": 50
  }
}
```

**Webhook Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `muted` | boolean | If true, webhook won't trigger but remains configured |
| `folder` | string | Optional folder name for organization |
| `trigger_count` | number | Total times this webhook has fired |
| `last_triggered_at` | timestamp | When the webhook last fired |

---

#### Create User Webhook
`POST /api/webhooks`

**Authentication:** Bearer token required

Create a new webhook for the authenticated user. Maximum 10 webhooks per user.

**Request Body:**
```json
{
  "name": "My Mod Action Alerts",
  "event_type": "mod_action",
  "webhook_url": "https://discord.com/api/webhooks/123456789/token",
  "config": {
    "action_types": ["ban", "timeout"],
    "channels": ["streamer1", "streamer2"]
  }
}
```

**Event Types:**

| Type | Description | Config Options |
|------|-------------|----------------|
| `tracked_user_message` | Messages from specific users | `tracked_usernames`: array of usernames |
| `mod_action` | Bans and timeouts | `action_types`: ["ban", "timeout"], `channels`: array or null for all |
| `channel_live` | Channel goes live | `channels`: array of channel names |
| `channel_offline` | Channel goes offline | `channels`: array of channel names |
| `channel_game_change` | Game/category changes | `channels`: array of channel names |

**Response:**
```json
{
  "message": "Webhook created",
  "webhook": {
    "id": 1,
    "name": "My Mod Action Alerts",
    "event_type": "mod_action",
    "enabled": true
  }
}
```

**Errors:**
- `400`: Invalid event type or missing required fields
- `400`: Invalid Discord webhook URL format
- `400`: Maximum 10 webhooks allowed

---

#### Update User Webhook
`PUT /api/webhooks/:id`

**Authentication:** Bearer token required

Update an existing webhook. Cannot change webhook URL after creation.

**Request Body:**
```json
{
  "name": "Updated Name",
  "config": {
    "action_types": ["ban"],
    "channels": null
  },
  "enabled": true
}
```

**Response:**
```json
{
  "message": "Webhook updated",
  "webhook": { ... }
}
```

---

#### Delete User Webhook
`DELETE /api/webhooks/:id`

**Authentication:** Bearer token required

**Response:**
```json
{
  "message": "Webhook deleted"
}
```

---

#### Test User Webhook
`POST /api/webhooks/:id/test`

**Authentication:** Bearer token required

Send a test notification to verify the webhook is working.

**Response:**
```json
{
  "message": "Test notification sent"
}
```

**Errors:**
- `400`: Webhook is disabled
- `500`: Failed to send test notification

---

#### Duplicate Webhook
`POST /api/webhooks/:id/duplicate`

**Authentication:** Bearer token required

Create a copy of an existing webhook with a new name.

**Request Body:**
```json
{
  "name": "Copy of My Webhook"
}
```

**Response:**
```json
{
  "webhook": {
    "id": 2,
    "name": "Copy of My Webhook",
    "webhook_type": "mod_action",
    "webhook_url_masked": "****abcd1234",
    "enabled": true,
    "muted": false,
    "folder": null,
    "trigger_count": 0,
    "last_triggered_at": null,
    "created_at": "2025-01-15T08:00:00.000Z"
  }
}
```

**Errors:**
- `404`: Webhook not found

---

#### Toggle Webhook Mute
`POST /api/webhooks/:id/mute`

**Authentication:** Bearer token required

Toggle the mute status of a webhook. Muted webhooks remain configured but won't send notifications.

**Response:**
```json
{
  "success": true,
  "muted": true,
  "webhook": {
    "id": 1,
    "name": "My Webhook",
    "muted": true,
    "webhook_url_masked": "****abcd1234"
  }
}
```

**Errors:**
- `404`: Webhook not found

---

#### Reset Trigger Count
`POST /api/webhooks/:id/reset-count`

**Authentication:** Bearer token required

Reset the trigger count for a webhook back to zero.

**Response:**
```json
{
  "success": true,
  "webhook": {
    "id": 1,
    "name": "My Webhook",
    "trigger_count": 0,
    "webhook_url_masked": "****abcd1234"
  }
}
```

**Errors:**
- `404`: Webhook not found

---

#### Set Webhook Folder
`POST /api/webhooks/:id/folder`

**Authentication:** Bearer token required

Assign a webhook to a folder for organization. Folders are created implicitly when assigned.

**Request Body:**
```json
{
  "folder": "Mod Alerts"
}
```

To remove from folder, pass `null` or empty string:
```json
{
  "folder": null
}
```

**Response:**
```json
{
  "success": true,
  "folder": "Mod Alerts",
  "webhook": {
    "id": 1,
    "name": "My Webhook",
    "folder": "Mod Alerts",
    "webhook_url_masked": "****abcd1234"
  }
}
```

**Errors:**
- `404`: Webhook not found

---

#### List User Folders
`GET /api/webhooks/folders`

**Authentication:** Bearer token required

Get all unique folder names used by the user's webhooks.

**Response:**
```json
{
  "folders": ["Mod Alerts", "Stream Notifications", "Tracked Users"]
}
```

---

### Webhook URL Bank

Saved webhook URLs allow users to store Discord webhook URLs for quick reuse when creating webhooks.

#### List Saved URLs
`GET /api/webhooks/urls`

**Authentication:** Bearer token required

Get all saved webhook URLs for the authenticated user.

**Response:**
```json
{
  "urls": [
    {
      "id": 1,
      "name": "Mod Alerts Channel",
      "webhook_url_masked": "****abcd1234",
      "created_at": "2025-01-15T08:00:00.000Z",
      "last_used_at": "2025-01-16T10:30:00.000Z"
    }
  ],
  "limits": {
    "maxUrlsPerUser": 20
  }
}
```

---

#### Save Webhook URL
`POST /api/webhooks/urls`

**Authentication:** Bearer token required

Save a webhook URL to the user's bank. Maximum 20 URLs per user (configurable).

**Request Body:**
```json
{
  "name": "Mod Alerts Channel",
  "webhookUrl": "https://discord.com/api/webhooks/123456789/token"
}
```

**Response:**
```json
{
  "url": {
    "id": 1,
    "name": "Mod Alerts Channel",
    "webhook_url_masked": "****token"
  }
}
```

**Errors:**
- `400`: Invalid Discord webhook URL
- `400`: Maximum URLs limit reached

---

#### Update Saved URL
`PUT /api/webhooks/urls/:id`

**Authentication:** Bearer token required

Update the name of a saved webhook URL.

**Request Body:**
```json
{
  "name": "New Name"
}
```

---

#### Delete Saved URL
`DELETE /api/webhooks/urls/:id`

**Authentication:** Bearer token required

Delete a saved webhook URL from the bank.

---

#### List Admin Webhooks
`GET /api/webhooks/admin`

**Authentication:** Bearer token (admin required)

Get all admin webhooks for system events.

**Response:**
```json
{
  "webhooks": [
    {
      "id": 1,
      "name": "Signup Alerts",
      "event_type": "user_signup",
      "enabled": true,
      "last_triggered_at": "2025-01-16T10:30:00.000Z"
    }
  ]
}
```

---

#### Create Admin Webhook
`POST /api/webhooks/admin`

**Authentication:** Bearer token (admin required)

**Request Body:**
```json
{
  "name": "Admin Alerts",
  "event_type": "user_signup",
  "webhook_url": "https://discord.com/api/webhooks/123456789/token"
}
```

**Admin Event Types:**

| Type | Description |
|------|-------------|
| `user_signup` | New user registers via OAuth |
| `data_request` | User requests data export or deletion |
| `system_event` | Important system events |
| `error_alert` | Critical errors |

**Response:**
```json
{
  "message": "Admin webhook created",
  "webhook": { ... }
}
```

---

#### Update Admin Webhook
`PUT /api/webhooks/admin/:id`

**Authentication:** Bearer token (admin required)

**Request Body:**
```json
{
  "name": "Updated Name",
  "enabled": true
}
```

---

#### Delete Admin Webhook
`DELETE /api/webhooks/admin/:id`

**Authentication:** Bearer token (admin required)

---

#### Test Admin Webhook
`POST /api/webhooks/admin/:id/test`

**Authentication:** Bearer token (admin required)

Send a test notification to verify the webhook.

---

### Discord OAuth Integration

Discord OAuth allows users to connect their Discord accounts and automatically create webhooks in their Discord servers without manually copying webhook URLs.

#### Prerequisites

**1. Environment Variables Required:**
```
DISCORD_CLIENT_ID=your_discord_app_client_id
DISCORD_CLIENT_SECRET=your_discord_app_secret
DISCORD_REDIRECT_URI=https://your-domain.com/api/discord/callback
DISCORD_BOT_TOKEN=your_discord_bot_token
```

**2. Discord Bot Setup:**

The Discord integration requires a bot to be added to servers for fetching channels and creating webhooks. Users must add the Chatterbox bot to their Discord server before they can use the auto-create webhook feature.

**Bot Invite URL:**
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=536870912&scope=bot
```

Replace `YOUR_CLIENT_ID` with your Discord application's client ID.

**Required Bot Permissions:**
- `Manage Webhooks` (permission value: 536870912)

**How to Add the Bot to a Discord Server:**
1. Open the bot invite URL in a web browser
2. Select the Discord server you want to add the bot to (you must have "Manage Server" permission)
3. Ensure the "Manage Webhooks" permission is enabled
4. Click "Authorize"
5. Complete the CAPTCHA if prompted

**Note:** The bot only needs to be in servers where users want to create webhooks. It does not read messages or have any other permissions.

---

#### Get Discord Connection Status
`GET /api/discord/status`

**Authentication:** Bearer token required

Check if the current user has Discord connected and get connection details.

**Response (Not Connected):**
```json
{
  "connected": false
}
```

**Response (Connected):**
```json
{
  "connected": true,
  "discordId": "123456789012345678",
  "username": "User#1234",
  "discriminator": "1234",
  "avatar": "a_abc123",
  "avatarUrl": "https://cdn.discordapp.com/avatars/123456789012345678/a_abc123.png",
  "connectedAt": "2025-01-15T10:30:00.000Z",
  "guildsCount": 5,
  "channelsCount": 25
}
```

---

#### Connect Discord Account
`GET /api/discord/connect`

**Authentication:** Bearer token required

Initiates Discord OAuth flow. Redirects to Discord's authorization page.

**Query Parameters:**
- `returnUrl` (optional): URL to return to after connection (default: `/webhooks`)

**Response:** 302 Redirect to Discord OAuth

---

#### Discord OAuth Callback
`GET /api/discord/callback`

**Internal endpoint** - handles Discord OAuth callback. Do not call directly.

**Query Parameters:**
- `code`: Authorization code from Discord
- `state`: CSRF state token

**Success:** Redirects to `{CLIENT_URL}{returnUrl}?discord=connected`
**Error:** Redirects to `{CLIENT_URL}/webhooks?error={error_message}`

---

#### Disconnect Discord
`POST /api/discord/disconnect`

**Authentication:** Bearer token required

Disconnects Discord account and optionally deletes webhooks created via Discord OAuth.

**Request Body:**
```json
{
  "deleteWebhooks": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `deleteWebhooks` | boolean | If true, also deletes webhooks created via Discord OAuth from both Chatterbox and Discord |

**Response:**
```json
{
  "success": true,
  "message": "Discord disconnected"
}
```

---

#### Get Discord Servers (Guilds)
`GET /api/discord/guilds`

**Authentication:** Bearer token required + Discord connected

Returns list of Discord servers where the user has "Manage Webhooks" permission.

**Query Parameters:**
- `refresh` (optional): Set to `true` to force refresh from Discord API

**Response:**
```json
{
  "guilds": [
    {
      "id": "123456789012345678",
      "name": "My Cool Server",
      "icon": "a_abc123",
      "iconUrl": "https://cdn.discordapp.com/icons/123456789012345678/a_abc123.png",
      "hasWebhookPermission": true,
      "owner": false,
      "permissions": "2147483647",
      "cachedAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

**Errors:**
- `400`: Discord is not connected
- `401`: Discord session expired - please reconnect (code: `DISCORD_EXPIRED`)

---

#### Get Discord Channels
`GET /api/discord/guilds/:guildId/channels`

**Authentication:** Bearer token required + Discord connected

Returns list of text and announcement channels in a Discord server.

**Query Parameters:**
- `refresh` (optional): Set to `true` to force refresh from Discord API

**Response:**
```json
{
  "channels": [
    {
      "id": "987654321098765432",
      "name": "general",
      "type": 0,
      "position": 0,
      "parentId": null,
      "parentName": null,
      "cachedAt": "2025-01-15T10:30:00.000Z"
    },
    {
      "id": "876543210987654321",
      "name": "announcements",
      "type": 5,
      "position": 1,
      "parentId": "111222333444555666",
      "parentName": "Info",
      "cachedAt": "2025-01-15T10:30:00.000Z"
    }
  ],
  "categorized": [
    {
      "id": "111222333444555666",
      "name": "Info",
      "channels": [...]
    }
  ],
  "uncategorized": [...]
}
```

**Channel Types:**
- `0`: GUILD_TEXT (text channel)
- `5`: GUILD_ANNOUNCEMENT (announcement channel)

**Errors:**
- `400`: Discord is not connected
- `403`: You do not have access to this server
- `403`: Missing access to this server (lost permissions)
- `401`: Discord session expired - please reconnect

---

#### Create Webhook via Discord OAuth
`POST /api/discord/guilds/:guildId/channels/:channelId/webhook`

**Authentication:** Bearer token required + Discord connected

Creates a webhook in the specified Discord channel and saves it to Chatterbox.

**Request Body:**
```json
{
  "name": "Tracked Users Alert",
  "webhookType": "tracked_user_message",
  "config": {
    "tracked_usernames": ["streamer1", "streamer2"]
  },
  "embedColor": "#5865F2",
  "customUsername": "Chatterbox",
  "customAvatarUrl": null,
  "includeTimestamp": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | **Required.** Webhook name in Chatterbox |
| `webhookType` | string | **Required.** One of: `tracked_user_message`, `mod_action`, `channel_live`, `channel_offline`, `channel_game_change` |
| `config` | object | Configuration based on webhook type |
| `embedColor` | string | Hex color for Discord embeds (default: `#5865F2`) |
| `customUsername` | string | Custom bot username for webhook |
| `customAvatarUrl` | string | Custom avatar URL |
| `includeTimestamp` | boolean | Include timestamps in embeds (default: `true`) |

**Response:**
```json
{
  "webhook": {
    "id": 1,
    "name": "Tracked Users Alert",
    "webhook_type": "tracked_user_message",
    "webhook_url_masked": "****abcd1234",
    "discord_guild_id": "123456789012345678",
    "discord_guild_name": "My Cool Server",
    "discord_channel_id": "987654321098765432",
    "discord_channel_name": "general",
    "discord_webhook_id": "111222333444555666",
    "created_via_oauth": true,
    "created_at": "2025-01-15T10:30:00.000Z"
  },
  "discordWebhookId": "111222333444555666"
}
```

**Errors:**
- `400`: Name and webhook type are required
- `400`: Invalid webhook type
- `400`: Discord is not connected
- `403`: You do not have access to this server
- `403`: Missing permissions to create webhooks in this channel
- `400`: Maximum webhooks reached for this channel (Discord limit)
- `401`: Discord session expired - please reconnect

---

#### Refresh Discord Connection
`POST /api/discord/refresh`

**Authentication:** Bearer token required + Discord connected

Refreshes the Discord guilds cache and checks webhook status.

**Response:**
```json
{
  "success": true,
  "guildsCount": 5,
  "webhooksCount": 3
}
```

---

### Admin Tiers

Manage user tiers and API usage limits. Admins can create, update, and delete tiers, as well as assign users to different tiers.

#### Tier Data Model
```json
{
  "id": 1,
  "name": "Free",
  "display_name": "Free Tier",
  "max_webhooks": 2,
  "max_api_calls_per_minute": 30,
  "max_search_results": 100,
  "message_history_days": 7,
  "features": {
    "exports": false,
    "websocket": true
  },
  "is_default": true,
  "created_at": "2025-01-15T10:30:00.000Z",
  "updated_at": "2025-01-15T10:30:00.000Z"
}
```

**Note:** A value of `-1` for any limit means unlimited.

#### List All Tiers
`GET /api/admin/tiers`

**Authentication:** Bearer token (admin required)

Returns all available tiers with user counts.

**Response:**
```json
{
  "tiers": [
    {
      "id": 1,
      "name": "Free",
      "display_name": "Free Tier",
      "max_webhooks": 2,
      "max_api_calls_per_minute": 30,
      "max_search_results": 100,
      "message_history_days": 7,
      "features": { "exports": false, "websocket": true },
      "is_default": true,
      "user_count": 150
    },
    {
      "id": 2,
      "name": "Pro",
      "display_name": "Pro Tier",
      "max_webhooks": 10,
      "max_api_calls_per_minute": 100,
      "max_search_results": 500,
      "message_history_days": 90,
      "features": { "exports": true, "websocket": true },
      "is_default": false,
      "user_count": 25
    }
  ]
}
```

---

#### Create Tier
`POST /api/admin/tiers`

**Authentication:** Bearer token (admin required)

Create a new tier.

**Request Body:**
```json
{
  "name": "Enterprise",
  "display_name": "Enterprise Tier",
  "max_webhooks": -1,
  "max_api_calls_per_minute": -1,
  "max_search_results": -1,
  "message_history_days": -1,
  "features": { "exports": true, "websocket": true, "priority_support": true },
  "is_default": false
}
```

**Response:**
```json
{
  "tier": {
    "id": 3,
    "name": "Enterprise",
    "display_name": "Enterprise Tier",
    "max_webhooks": -1,
    "max_api_calls_per_minute": -1,
    "max_search_results": -1,
    "message_history_days": -1,
    "features": { "exports": true, "websocket": true, "priority_support": true },
    "is_default": false,
    "created_at": "2025-01-15T10:30:00.000Z"
  }
}
```

---

#### Update Tier
`PATCH /api/admin/tiers/:id`

**Authentication:** Bearer token (admin required)

Update an existing tier.

**Request Body:** (all fields optional)
```json
{
  "display_name": "Updated Name",
  "max_webhooks": 5,
  "max_api_calls_per_minute": 50
}
```

**Response:**
```json
{
  "tier": { /* updated tier object */ }
}
```

---

#### Delete Tier
`DELETE /api/admin/tiers/:id`

**Authentication:** Bearer token (admin required)

Delete a tier. Cannot delete the default tier.

**Response:**
```json
{
  "message": "Tier deleted successfully"
}
```

**Error Responses:**
- `400`: Cannot delete the default tier
- `404`: Tier not found

---

#### Get User's Tier
`GET /api/admin/users/:username/tier`

**Authentication:** Bearer token (admin required)

Get tier information for a specific user.

**Response:**
```json
{
  "user": {
    "id": 42,
    "username": "chatuser123",
    "is_admin": false
  },
  "tier": {
    "id": 1,
    "name": "Free",
    "display_name": "Free Tier",
    "max_webhooks": 2,
    "max_api_calls_per_minute": 30,
    "max_search_results": 100,
    "message_history_days": 7,
    "features": { "exports": false, "websocket": true }
  },
  "assigned_at": "2025-01-15T10:30:00.000Z"
}
```

---

#### Assign User to Tier
`PUT /api/admin/users/:username/tier`

**Authentication:** Bearer token (admin required)

Assign a user to a specific tier.

**Request Body:**
```json
{
  "tier_id": 2
}
```

**Response:**
```json
{
  "message": "User assigned to tier successfully",
  "tier": {
    "id": 2,
    "name": "Pro",
    "display_name": "Pro Tier"
  }
}
```

---

#### Get User's Usage Stats
`GET /api/admin/users/:username/usage`

**Authentication:** Bearer token (admin required)

Get API usage statistics for a specific user.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | integer | 7 | Number of days to look back (1-90) |

**Response:**
```json
{
  "user": {
    "id": 42,
    "username": "chatuser123"
  },
  "usage": {
    "total_calls": 1234,
    "period_start": "2025-01-08T00:00:00.000Z",
    "period_end": "2025-01-15T00:00:00.000Z",
    "daily_breakdown": [
      { "date": "2025-01-08", "calls": 150 },
      { "date": "2025-01-09", "calls": 200 },
      { "date": "2025-01-10", "calls": 175 }
    ],
    "endpoints": [
      { "endpoint": "GET /api/messages", "count": 450 },
      { "endpoint": "GET /api/users/:username", "count": 320 },
      { "endpoint": "GET /api/messages/search", "count": 210 }
    ]
  }
}
```

---

#### Get System Usage Analytics
`GET /api/admin/usage`

**Authentication:** Bearer token (admin required)

Get system-wide API usage analytics.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | integer | 7 | Number of days to look back (1-90) |

**Response:**
```json
{
  "period": {
    "start": "2025-01-08T00:00:00.000Z",
    "end": "2025-01-15T00:00:00.000Z"
  },
  "totals": {
    "total_calls": 125000,
    "unique_users": 450,
    "avg_response_time_ms": 45
  },
  "daily": [
    { "date": "2025-01-08", "calls": 18000 },
    { "date": "2025-01-09", "calls": 17500 }
  ],
  "top_users": [
    { "user_id": 42, "username": "chatuser123", "calls": 5000 },
    { "user_id": 15, "username": "poweruser", "calls": 3500 }
  ],
  "top_endpoints": [
    { "endpoint": "GET /api/messages", "count": 45000 },
    { "endpoint": "GET /api/messages/search", "count": 28000 }
  ]
}
```

---

### User Self-Service

Endpoints for authenticated users to view their own tier and usage information.

#### Get My Tier
`GET /api/me/tier`

**Authentication:** Bearer token (required)

Get the current user's tier information.

**Response:**
```json
{
  "tier": {
    "id": 1,
    "name": "Free",
    "display_name": "Free Tier",
    "max_webhooks": 2,
    "max_api_calls_per_minute": 30,
    "max_search_results": 100,
    "message_history_days": 7,
    "features": { "exports": false, "websocket": true }
  },
  "assigned_at": "2025-01-15T10:30:00.000Z",
  "is_admin": false
}
```

**Note:** If `is_admin` is `true`, the user bypasses all tier limits.

---

#### Get My Usage
`GET /api/me/usage`

**Authentication:** Bearer token (required)

Get the current user's API usage statistics.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | integer | 7 | Number of days to look back (1-30) |

**Response:**
```json
{
  "tier": {
    "id": 1,
    "name": "Free",
    "display_name": "Free Tier",
    "max_api_calls_per_minute": 30
  },
  "usage": {
    "total_calls": 450,
    "calls_today": 75,
    "daily_breakdown": [
      { "date": "2025-01-08", "calls": 50 },
      { "date": "2025-01-09", "calls": 65 },
      { "date": "2025-01-10", "calls": 75 }
    ]
  },
  "limits": {
    "webhooks": { "used": 1, "max": 2 },
    "api_per_minute": { "current": 5, "max": 30 }
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

#### `subscribe_global`
Subscribe to global events (stats updates, channel status changes, global mod actions). Useful for dashboard/monitoring clients that need system-wide updates without subscribing to specific channels.

**Payload:**
```javascript
socket.emit('subscribe_global');
```

**Server Response:** `subscribed_global` event with confirmation

---

#### `unsubscribe`
Unsubscribe from channel updates.

**Payload:**
```javascript
socket.emit('unsubscribe', { channels: ['pokimane'] });
```

**Server Response:** `unsubscribed` event with confirmation

---

#### `unsubscribe_global`
Unsubscribe from global events.

**Payload:**
```javascript
socket.emit('unsubscribe_global');
```

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

#### `subscribed_global`
Confirmation of global subscription (for dashboard real-time updates). No payload.

---

#### `stats_update`
Real-time system statistics update (sent to global subscribers when messages are flushed).

**Payload:**
```json
{
  "totalMessages": 150000,
  "totalUsers": 5000,
  "activeChannels": 3,
  "connectedClients": 10,
  "archiveBuffer": {
    "bufferedMessages": 0,
    "isProcessing": false
  },
  "timestamp": "2025-12-04T15:45:00.000Z"
}
```

---

#### `global_mod_action`
Mod action broadcast to all global subscribers (for dashboard mod feed).

**Payload:**
```json
{
  "action_type": "timeout",
  "target_username": "spammer",
  "channel_name": "pokimane",
  "duration_seconds": 600,
  "timestamp": "2025-12-04T15:45:00.000Z"
}
```

---

#### `channel_status`
Channel streaming and connection status update. Sent when a channel goes live/offline or viewer count changes significantly.

**Payload:**
```json
{
  "name": "pokimane",
  "display_name": "Pokimane",
  "is_live": true,
  "viewer_count": 15432,
  "stream_title": "morning stream!",
  "game_name": "Just Chatting",
  "started_at": "2025-01-15T10:30:00.000Z",
  "profile_image_url": "https://static-cdn.jtvnw.net/jtv_user_pictures/pokimane-profile_image.png"
}
```

**Note:** The server polls Twitch API every 60 seconds and broadcasts updates when:
- A channel goes live or offline (`is_live` changes)
- Viewer count changes by more than 100
- Initial status is loaded after server start

---

#### `mps_update`
Global real-time messages per second statistics. Sent to global subscribers every second with system-wide MPS and per-channel MPS data. Useful for dashboards and monitoring.

**Payload:**
```json
{
  "mps": 125.5,
  "channelMps": {
    "xqc": 45.2,
    "pokimane": 38.7,
    "forsen": 41.6
  },
  "timestamp": "2025-12-04T15:45:30.000Z"
}
```

**Example Handler:**
```javascript
socket.on('mps_update', (data) => {
  console.log(`Global MPS: ${data.mps} msg/sec`);
  console.log(`Top channel: ${Object.entries(data.channelMps).sort((a, b) => b[1] - a[1])[0][0]}`);
});
```

**Note:** 
- Only sent to clients subscribed via `subscribe_global`
- Updates every 1 second with a snapshot of message counts per channel
- Useful for real-time dashboards, monitoring systems, and activity visualizations

---

#### `channel_mps`
Channel-specific real-time messages per second. Sent to clients subscribed to a specific channel every second.

**Payload:**
```json
{
  "channel": "xqc",
  "mps": 45.2,
  "timestamp": "2025-12-04T15:45:30.000Z"
}
```

**Example Handler:**
```javascript
socket.emit('subscribe', { channels: ['xqc'] });

socket.on('channel_mps', (data) => {
  console.log(`[${data.channel}] ${data.mps} messages/sec`);
});
```

**Note:**
- Sent to each channel room every 1 second
- Clients must be subscribed to that specific channel to receive this event
- Complements the global `mps_update` with per-channel granularity
- Can be used to display activity indicators, load bars, or sparkline charts on channel pages

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
| GET | `/api/users/top` | Get top users by message count |
| GET | `/api/users/blocked` | Get blocked users (auth) |
| GET | `/api/users/:username` | Get user profile |
| GET | `/api/users/:username/messages` | Get user's messages |
| GET | `/api/users/:username/mod-actions` | Get mod actions against user |
| GET | `/api/users/:username/stats` | Get user statistics |
| GET | `/api/users/:username/export` | Export user data (auth) |
| POST | `/api/users/:username/block` | Block user (auth) |
| POST | `/api/users/:username/unblock` | Unblock user (auth) |
| PATCH | `/api/users/:username/notes` | Update user notes (auth) |
| DELETE | `/api/users/:username/messages` | Delete user messages (auth) |
| DELETE | `/api/users/:username` | Delete user and data (auth) |
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
| GET | `/api/oauth/login` | Initiate Twitch OAuth login |
| GET | `/api/oauth/callback` | OAuth callback handler |
| POST | `/api/oauth/refresh` | Refresh access token |
| POST | `/api/oauth/logout` | Logout current session |
| POST | `/api/oauth/logout-all` | Logout all sessions |
| GET | `/api/oauth/me` | Get current user (Bearer auth) |
| GET | `/api/oauth/followed-streams` | Get followed live streams (Bearer auth) |
| POST | `/api/oauth/requests` | Create data request (Bearer auth) |
| DELETE | `/api/oauth/requests/:id` | Cancel data request (Bearer auth) |
| GET | `/api/admin/user-requests` | List user requests (Admin) |
| GET | `/api/admin/user-requests/pending` | Get pending requests (Admin) |
| GET | `/api/admin/user-requests/:id` | Get request details (Admin) |
| POST | `/api/admin/user-requests/:id/approve` | Approve request (Admin) |
| POST | `/api/admin/user-requests/:id/deny` | Deny request (Admin) |
| GET | `/api/admin/oauth-users` | List OAuth users (Admin) |
| POST | `/api/admin/oauth-users/:id/admin` | Set user admin status (Admin) |
| GET | `/api/webhooks` | List user webhooks (Bearer auth) |
| POST | `/api/webhooks` | Create user webhook (Bearer auth) |
| PUT | `/api/webhooks/:id` | Update user webhook (Bearer auth) |
| DELETE | `/api/webhooks/:id` | Delete user webhook (Bearer auth) |
| POST | `/api/webhooks/:id/test` | Test user webhook (Bearer auth) |
| GET | `/api/webhooks/admin` | List admin webhooks (Admin) |
| POST | `/api/webhooks/admin` | Create admin webhook (Admin) |
| PUT | `/api/webhooks/admin/:id` | Update admin webhook (Admin) |
| DELETE | `/api/webhooks/admin/:id` | Delete admin webhook (Admin) |
| POST | `/api/webhooks/admin/:id/test` | Test admin webhook (Admin) |

### WebSocket Events Quick Reference

| Event | Direction | Description |
|-------|-----------|-------------|
| `subscribe` | Client → Server | Subscribe to channel updates |
| `subscribe_global` | Client → Server | Subscribe to global/dashboard updates |
| `unsubscribe` | Client → Server | Unsubscribe from channels |
| `unsubscribe_global` | Client → Server | Unsubscribe from global updates |
| `ping` | Client → Server | Health check |
| `chat_message` | Server → Client | New chat message |
| `message_deleted` | Server → Client | Message was deleted |
| `mod_action` | Server → Client | Mod action in subscribed channel |
| `messages_flushed` | Server → Client | Messages saved to database |
| `stats_update` | Server → Client | Real-time stats (global subscribers) |
| `global_mod_action` | Server → Client | Mod action across all channels |
| `channel_status` | Server → Client | Channel connect/disconnect |
| `subscribed` | Server → Client | Subscription confirmation |
| `subscribed_global` | Server → Client | Global subscription confirmation |
| `pong` | Server → Client | Ping response |

### Date Format

All dates use ISO 8601 format: `YYYY-MM-DDTHH:mm:ss.sssZ`

Example: `2025-12-04T15:45:30.123Z`

---

## Future Features & Roadmap

### Planned Features

#### 🔍 Advanced Search & Analytics
- **Semantic search** - Natural language queries like "find toxic messages" or "show hype moments"
- **Sentiment analysis dashboard** - Track chat mood over time with visualizations
- **Trend detection** - Identify viral moments, copypastas, and emerging memes
- **Custom alerts** - Get notified when specific patterns or users appear

#### 📊 Enhanced Analytics
- **Stream session analysis** - Compare chat engagement across different streams
- **Viewer behavior insights** - Message frequency patterns, peak activity times
- **Moderator effectiveness reports** - Track timeout/ban rates, false positive estimates
- **Word clouds & n-gram analysis** - Visual representation of chat vocabulary

#### 🛡️ Advanced Moderation Tools
- **Predictive moderation** - Flag potentially problematic users before they cause issues
- **Cross-channel reputation system** - Share ban lists and user notes across channels
- **Automod rule builder** - Create custom regex patterns with preview and testing
- **Appeal management** - Track and manage user appeals

#### 🔗 Integrations
- **Discord webhooks** - Send mod actions and highlights to Discord
- **OBS integration** - Display chat stats on stream
- **Streamlabs/StreamElements** - Sync with existing moderation tools
- **Twitch EventSub** - Real-time stream events (live/offline, title changes)

#### 📱 User Experience
- **Custom themes** - Light mode, OLED dark, custom colors
- **Keyboard shortcuts** - Power user navigation
- **Saved searches** - Quick access to frequent queries
- **Export formats** - CSV, JSON, PDF reports

---

### Support

For issues or questions, refer to the project repository or documentation.
