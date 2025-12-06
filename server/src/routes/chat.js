import { Router } from 'express';
import { requireUserAuth } from '../middleware/auth.js';
import { OAuthUser } from '../models/OAuthUser.js';
import Channel from '../models/Channel.js';
import logger from '../utils/logger.js';

const router = Router();

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

/**
 * Refresh a user's access token
 */
async function refreshAccessToken(userId, refreshToken) {
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  const tokens = await response.json();
  await OAuthUser.updateTokens(userId, tokens);
  return tokens.access_token;
}

/**
 * Get valid access token for user (refresh if needed)
 */
async function getValidAccessToken(user) {
  // Check if token is expired or about to expire (within 5 minutes)
  const now = new Date();
  const expiresAt = new Date(user.token_expires_at);
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAt <= fiveMinutesFromNow) {
    // Token expired or about to expire, refresh it
    return await refreshAccessToken(user.id, user.refresh_token);
  }

  return user.access_token;
}

/**
 * POST /api/chat/send
 * Send a chat message to a channel
 */
router.post('/send', requireUserAuth, async (req, res) => {
  try {
    const { channelName, message, replyParentMessageId } = req.body;
    const userId = req.user.id;

    if (!channelName || !message) {
      return res.status(400).json({ error: 'Channel name and message are required' });
    }

    if (message.length > 500) {
      return res.status(400).json({ error: 'Message too long (max 500 characters)' });
    }

    // Get the user's OAuth data
    const user = await OAuthUser.getById(userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.access_token) {
      return res.status(401).json({ error: 'No access token available. Please re-authenticate.' });
    }

    // Get valid access token
    let accessToken;
    try {
      accessToken = await getValidAccessToken(user);
    } catch (error) {
      logger.error('Failed to get valid access token:', error);
      return res.status(401).json({ error: 'Token refresh failed. Please re-authenticate.' });
    }

    // Get channel info to get broadcaster ID
    const channel = await Channel.getByName(channelName);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Send message via Twitch Helix API
    const body = {
      broadcaster_id: channel.twitch_id,
      sender_id: user.twitch_id,
      message: message,
    };

    if (replyParentMessageId) {
      body.reply_parent_message_id = replyParentMessageId;
    }

    const response = await fetch('https://api.twitch.tv/helix/chat/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': TWITCH_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.warn('Failed to send chat message:', data);
      
      // Handle specific error cases
      if (response.status === 401) {
        return res.status(401).json({ 
          error: 'Authentication failed. Please re-login with chat permissions.',
          needsReauth: true
        });
      }
      
      if (response.status === 403) {
        return res.status(403).json({ 
          error: 'You are not permitted to send messages in this channel.',
          details: data.message
        });
      }

      return res.status(response.status).json({ 
        error: data.message || 'Failed to send message',
        details: data
      });
    }

    // Check if message was actually sent
    if (data.data?.[0]?.is_sent === false) {
      const dropReason = data.data[0].drop_reason;
      return res.status(400).json({
        error: 'Message was not sent',
        reason: dropReason?.message || 'Unknown reason',
        code: dropReason?.code
      });
    }

    logger.info(`Chat message sent by ${user.username} to ${channelName}`);

    res.json({
      success: true,
      messageId: data.data?.[0]?.message_id
    });

  } catch (error) {
    logger.error('Error sending chat message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * GET /api/chat/permissions/:channel
 * Check if user can send messages in a channel
 */
router.get('/permissions/:channel', requireUserAuth, async (req, res) => {
  try {
    const { channel: channelName } = req.params;
    const userId = req.user.id;

    const user = await OAuthUser.getById(userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if user has chat scopes
    const scopes = user.scopes || [];
    const hasChatScope = scopes.includes('user:write:chat');

    const channel = await Channel.getByName(channelName);
    
    res.json({
      canSend: hasChatScope && !!user.access_token,
      hasChatScope,
      hasToken: !!user.access_token,
      channelFound: !!channel,
      username: user.username,
      displayName: user.display_name,
    });

  } catch (error) {
    logger.error('Error checking chat permissions:', error);
    res.status(500).json({ error: 'Failed to check permissions' });
  }
});

export default router;
