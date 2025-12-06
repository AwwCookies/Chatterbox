import { Router } from 'express';
import crypto from 'crypto';
import { OAuthUser, UserSession, UserRequest } from '../models/OAuthUser.js';
import { requireUserAuth, generateAccessToken, REFRESH_TOKEN_EXPIRES_DAYS } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import discordWebhookService from '../services/discordWebhookService.js';

const router = Router();

// OAuth configuration
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'https://api-chatterbox.calicos.art/api/oauth/callback';
const CLIENT_URL = process.env.CLIENT_URL || 'https://chatterbox.calicos.art';

// Scopes needed for the application
const TWITCH_SCOPES = [
  'user:read:email',
  'user:read:follows',
  'user:write:chat',
  'user:bot',
  'channel:bot'
].join(' ');

// Store state tokens temporarily (in production, use Redis)
const stateTokens = new Map();

/**
 * GET /api/oauth/login
 * Initiates Twitch OAuth flow - redirects to Twitch authorization
 */
router.get('/login', (req, res) => {
  if (!TWITCH_CLIENT_ID) {
    return res.status(500).json({ error: 'Twitch OAuth not configured' });
  }

  // Generate state token for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');
  stateTokens.set(state, { createdAt: Date.now(), returnUrl: req.query.returnUrl || '/' });

  // Clean up old state tokens (older than 10 minutes)
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [key, value] of stateTokens) {
    if (value.createdAt < tenMinutesAgo) {
      stateTokens.delete(key);
    }
  }

  const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
  authUrl.searchParams.set('client_id', TWITCH_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', OAUTH_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', TWITCH_SCOPES);
  authUrl.searchParams.set('state', state);

  res.redirect(authUrl.toString());
});

/**
 * GET /api/oauth/callback
 * Twitch OAuth callback - exchanges code for tokens
 */
router.get('/callback', async (req, res) => {
  logger.info('OAuth callback received', { query: req.query, headers: req.headers.host });
  
  const { code, state, error, error_description } = req.query;

  // Handle OAuth errors from Twitch
  if (error) {
    logger.warn(`Twitch OAuth error: ${error} - ${error_description}`);
    return res.redirect(`${CLIENT_URL}/login?error=${encodeURIComponent(error_description || error)}`);
  }

  // Validate state token
  if (!state || !stateTokens.has(state)) {
    logger.warn('Invalid OAuth state token');
    return res.redirect(`${CLIENT_URL}/login?error=invalid_state`);
  }

  const stateData = stateTokens.get(state);
  stateTokens.delete(state);

  if (!code) {
    return res.redirect(`${CLIENT_URL}/login?error=no_code`);
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: OAUTH_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      logger.error('Token exchange failed:', errorData);
      return res.redirect(`${CLIENT_URL}/login?error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();

    // Get user info from Twitch
    const userResponse = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Client-Id': TWITCH_CLIENT_ID,
      },
    });

    if (!userResponse.ok) {
      logger.error('Failed to get user info');
      return res.redirect(`${CLIENT_URL}/login?error=user_info_failed`);
    }

    const userData = await userResponse.json();
    const twitchUser = userData.data[0];

    // Check if this is a new user
    const existingUser = await OAuthUser.getByTwitchId(twitchUser.id);
    const isNewUser = !existingUser;

    // Create or update user in database
    const user = await OAuthUser.upsertFromTwitch(twitchUser, tokens);
    logger.info(`User ${user.username} logged in via Twitch OAuth`);

    // Trigger webhook for new user signups
    if (isNewUser) {
      discordWebhookService.sendUserSignup({
        username: user.username,
        displayName: user.display_name || user.username,
        twitchId: user.twitch_id,
        profileImageUrl: user.profile_image_url,
        email: user.email,
        timestamp: new Date()
      }).catch(err => logger.debug('Webhook error (user signup):', err.message));
    }

    // Generate our JWT access token
    const accessToken = generateAccessToken(user);

    // Generate refresh token and create session
    const refreshToken = crypto.randomBytes(64).toString('hex');
    await UserSession.create(
      user.id,
      refreshToken,
      req.headers['user-agent'],
      req.ip,
      REFRESH_TOKEN_EXPIRES_DAYS
    );

    // Redirect to client with tokens
    const returnUrl = stateData.returnUrl || '/';
    const redirectUrl = new URL(`${CLIENT_URL}/auth/callback`);
    redirectUrl.searchParams.set('accessToken', accessToken);
    redirectUrl.searchParams.set('refreshToken', refreshToken);
    redirectUrl.searchParams.set('returnUrl', returnUrl);

    res.redirect(redirectUrl.toString());
  } catch (error) {
    logger.error('OAuth callback error:', error.message);
    res.redirect(`${CLIENT_URL}/login?error=server_error`);
  }
});

/**
 * POST /api/oauth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  try {
    // Find session by refresh token
    const session = await UserSession.findByRefreshToken(refreshToken);

    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Get user from session (joined in query)
    const user = {
      id: session.oauth_user_id,
      twitch_id: session.twitch_id,
      username: session.username,
      is_admin: session.is_admin
    };

    // Update session last used
    await UserSession.updateLastUsed(session.id);

    // Generate new access token
    const accessToken = generateAccessToken(user);

    res.json({ accessToken });
  } catch (error) {
    logger.error('Token refresh error:', error.message);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

/**
 * POST /api/oauth/logout
 * Logout user - invalidates refresh token
 */
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    try {
      await UserSession.deleteByRefreshToken(refreshToken);
    } catch (error) {
      logger.error('Logout error:', error.message);
    }
  }

  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /api/oauth/me
 * Get current user profile
 */
router.get('/me', requireUserAuth, async (req, res) => {
  try {
    const user = OAuthUser.sanitize(req.user);
    
    // Get user's pending requests
    const requests = await UserRequest.getByUserId(req.user.id);

    res.json({ 
      user,
      requests: requests.map(r => ({
        id: r.id,
        type: r.request_type,
        status: r.status,
        reason: r.reason,
        adminNotes: r.admin_notes,
        downloadUrl: r.status === 'approved' && r.download_url ? r.download_url : null,
        downloadExpiresAt: r.download_expires_at,
        createdAt: r.created_at,
        processedAt: r.processed_at
      }))
    });
  } catch (error) {
    logger.error('Error fetching user profile:', error.message);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * GET /api/oauth/followed-streams
 * Get live streams from channels the user follows
 */
router.get('/followed-streams', requireUserAuth, async (req, res) => {
  try {
    const user = req.user;

    // Check if we need to refresh Twitch token
    if (OAuthUser.needsTokenRefresh(user)) {
      const refreshed = await refreshTwitchToken(user);
      if (!refreshed) {
        return res.status(401).json({ error: 'Twitch token expired, please log in again' });
      }
    }

    // Get followed streams from Twitch API
    const streamsResponse = await fetch(
      `https://api.twitch.tv/helix/streams/followed?user_id=${user.twitch_id}&first=100`,
      {
        headers: {
          'Authorization': `Bearer ${user.access_token}`,
          'Client-Id': TWITCH_CLIENT_ID,
        },
      }
    );

    if (streamsResponse.status === 401) {
      // Token invalid, try refresh
      const refreshed = await refreshTwitchToken(user);
      if (refreshed) {
        // Retry with new token
        const retryResponse = await fetch(
          `https://api.twitch.tv/helix/streams/followed?user_id=${user.twitch_id}&first=100`,
          {
            headers: {
              'Authorization': `Bearer ${refreshed.access_token}`,
              'Client-Id': TWITCH_CLIENT_ID,
            },
          }
        );
        if (!retryResponse.ok) {
          return res.status(401).json({ error: 'Failed to fetch followed streams' });
        }
        const data = await retryResponse.json();
        return res.json(formatStreamsResponse(data));
      }
      return res.status(401).json({ error: 'Twitch token expired, please log in again' });
    }

    if (!streamsResponse.ok) {
      const errorData = await streamsResponse.text();
      logger.error('Failed to fetch followed streams:', errorData);
      return res.status(500).json({ error: 'Failed to fetch followed streams' });
    }

    const data = await streamsResponse.json();
    res.json(formatStreamsResponse(data));
  } catch (error) {
    logger.error('Error fetching followed streams:', error.message);
    res.status(500).json({ error: 'Failed to fetch followed streams' });
  }
});

/**
 * POST /api/oauth/requests
 * Create a data request (deletion or export)
 */
router.post('/requests', requireUserAuth, async (req, res) => {
  try {
    const { type, reason } = req.body;

    if (!['delete', 'export'].includes(type)) {
      return res.status(400).json({ error: 'Invalid request type. Must be "delete" or "export"' });
    }

    const request = await UserRequest.create(req.user.id, type, reason);
    logger.info(`User ${req.user.username} created ${type} request`);

    // Trigger webhook for data requests (admin notification)
    discordWebhookService.sendDataRequest({
      username: req.user.username,
      displayName: req.user.display_name || req.user.username,
      requestType: type,
      reason: reason || null,
      timestamp: new Date()
    }).catch(err => logger.debug('Webhook error (data request):', err.message));

    res.status(201).json({
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} request submitted`,
      request: {
        id: request.id,
        type: request.request_type,
        status: request.status,
        reason: request.reason,
        createdAt: request.created_at
      }
    });
  } catch (error) {
    if (error.message.includes('already have a pending')) {
      return res.status(409).json({ error: error.message });
    }
    logger.error('Error creating request:', error.message);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

/**
 * DELETE /api/oauth/requests/:id
 * Cancel a pending request
 */
router.delete('/requests/:id', requireUserAuth, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const cancelled = await UserRequest.cancel(requestId, req.user.id);

    if (!cancelled) {
      return res.status(404).json({ error: 'Request not found or cannot be cancelled' });
    }

    res.json({ message: 'Request cancelled successfully' });
  } catch (error) {
    logger.error('Error cancelling request:', error.message);
    res.status(500).json({ error: 'Failed to cancel request' });
  }
});

/**
 * POST /api/oauth/logout-all
 * Logout from all devices
 */
router.post('/logout-all', requireUserAuth, async (req, res) => {
  try {
    await UserSession.deleteAllForUser(req.user.id);
    res.json({ message: 'Logged out from all devices' });
  } catch (error) {
    logger.error('Logout all error:', error.message);
    res.status(500).json({ error: 'Failed to logout from all devices' });
  }
});

// Helper function to refresh Twitch token
async function refreshTwitchToken(user) {
  try {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: user.refresh_token,
      }),
    });

    if (!response.ok) {
      logger.warn(`Failed to refresh Twitch token for user ${user.username}`);
      return null;
    }

    const tokens = await response.json();
    return await OAuthUser.updateTokens(user.id, tokens);
  } catch (error) {
    logger.error('Twitch token refresh error:', error.message);
    return null;
  }
}

// Helper function to format streams response
function formatStreamsResponse(data) {
  return {
    streams: data.data.map(stream => ({
      id: stream.id,
      userId: stream.user_id,
      userLogin: stream.user_login,
      userDisplayName: stream.user_name,
      gameId: stream.game_id,
      gameName: stream.game_name,
      title: stream.title,
      viewerCount: stream.viewer_count,
      startedAt: stream.started_at,
      language: stream.language,
      thumbnailUrl: stream.thumbnail_url
        .replace('{width}', '440')
        .replace('{height}', '248'),
      tags: stream.tags || [],
      isMature: stream.is_mature
    })),
    total: data.data.length,
    pagination: data.pagination
  };
}

export default router;
