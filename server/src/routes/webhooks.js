import express from 'express';
import Webhook from '../models/Webhook.js';
import Tier from '../models/Tier.js';
import discordWebhookService from '../services/discordWebhookService.js';
import { requireUserAuth, requireAdmin } from '../middleware/auth.js';
import { attachTier, checkWebhookLimit } from '../middleware/tierLimits.js';
import ConfigService from '../services/configService.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Validate Discord webhook URL
const isValidWebhookUrl = (url) => {
  return /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url) ||
         /^https:\/\/discordapp\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url) ||
         /^https:\/\/canary\.discord\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url) ||
         /^https:\/\/ptb\.discord\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url);
};

// ============ User Webhooks ============

/**
 * GET /api/webhooks - Get user's webhooks
 */
router.get('/', requireUserAuth, attachTier, async (req, res) => {
  try {
    const webhooks = await Webhook.getUserWebhooks(req.user.id);
    
    // Mask webhook URLs for security (only show last 8 chars)
    const maskedWebhooks = webhooks.map(w => ({
      ...w,
      webhook_url_masked: '****' + w.webhook_url.slice(-8),
    }));
    
    // Get config limits (defaults)
    const [configMaxPerUser, maxUrlsPerUser, maxTrackedUsernames] = await Promise.all([
      ConfigService.get('webhooks.maxPerUser'),
      ConfigService.get('webhooks.maxUrlsPerUser'),
      ConfigService.get('webhooks.maxTrackedUsernames'),
    ]);
    
    // Use tier-based limit if available
    const tier = req.tier;
    let maxPerUser = configMaxPerUser;
    
    if (tier) {
      if (Tier.isUnlimited(tier.max_webhooks)) {
        maxPerUser = -1; // -1 means unlimited
      } else {
        maxPerUser = tier.max_webhooks;
      }
    }
    
    res.json({ 
      webhooks: maskedWebhooks,
      limits: {
        maxPerUser,
        maxUrlsPerUser,
        maxTrackedUsernames,
      },
      tier: tier ? {
        name: tier.name,
        display_name: tier.display_name,
      } : null,
    });
  } catch (error) {
    logger.error('Error fetching webhooks:', error);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

/**
 * POST /api/webhooks - Create a webhook
 */
router.post('/', requireUserAuth, attachTier, checkWebhookLimit, async (req, res) => {
  try {
    const {
      name,
      webhookUrl,
      webhookType,
      config,
      embedColor,
      customUsername,
      customAvatarUrl,
      includeTimestamp,
    } = req.body;

    // Validation
    if (!name || !webhookUrl || !webhookType) {
      return res.status(400).json({ error: 'Name, webhook URL, and type are required' });
    }

    if (!isValidWebhookUrl(webhookUrl)) {
      return res.status(400).json({ error: 'Invalid Discord webhook URL' });
    }

    const validTypes = ['tracked_user_message', 'mod_action', 'channel_live', 'channel_offline', 'channel_game_change'];
    if (!validTypes.includes(webhookType)) {
      return res.status(400).json({ error: 'Invalid webhook type' });
    }

    // Check user webhook limit - use tier-based limit if available, fall back to config
    const tier = req.tier;
    let maxWebhooks;
    
    if (tier && !Tier.isUnlimited(tier.max_webhooks)) {
      maxWebhooks = tier.max_webhooks;
    } else if (tier && Tier.isUnlimited(tier.max_webhooks)) {
      maxWebhooks = Infinity; // Unlimited
    } else {
      maxWebhooks = await ConfigService.get('webhooks.maxPerUser');
    }
    
    const existingWebhooks = await Webhook.getUserWebhooks(req.user.id);
    if (existingWebhooks.length >= maxWebhooks) {
      return res.status(400).json({ error: `Maximum of ${maxWebhooks} webhooks allowed` });
    }

    // Validate config based on type
    const maxTrackedUsernames = await ConfigService.get('webhooks.maxTrackedUsernames');
    if (webhookType === 'tracked_user_message') {
      if (!config?.tracked_usernames || !Array.isArray(config.tracked_usernames) || config.tracked_usernames.length === 0) {
        return res.status(400).json({ error: 'At least one tracked username is required' });
      }
      if (config.tracked_usernames.length > maxTrackedUsernames) {
        return res.status(400).json({ error: `Maximum of ${maxTrackedUsernames} tracked usernames allowed` });
      }
    }

    const webhook = await Webhook.createUserWebhook({
      oauthUserId: req.user.id,
      name,
      webhookUrl,
      webhookType,
      config: config || {},
      embedColor,
      customUsername,
      customAvatarUrl,
      includeTimestamp,
    });

    res.status(201).json({ 
      webhook: {
        ...webhook,
        webhook_url_masked: '****' + webhook.webhook_url.slice(-8),
      }
    });
  } catch (error) {
    logger.error('Error creating webhook:', error);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

/**
 * PUT /api/webhooks/:id - Update a webhook
 */
router.put('/:id', requireUserAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // If updating URL, validate it
    if (updates.webhookUrl && !isValidWebhookUrl(updates.webhookUrl)) {
      return res.status(400).json({ error: 'Invalid Discord webhook URL' });
    }

    // Map frontend field names to database field names
    const mappedUpdates = {};
    if (updates.name !== undefined) mappedUpdates.name = updates.name;
    if (updates.webhookUrl !== undefined) mappedUpdates.webhook_url = updates.webhookUrl;
    if (updates.config !== undefined) mappedUpdates.config = updates.config;
    if (updates.embedColor !== undefined) mappedUpdates.embed_color = updates.embedColor;
    if (updates.customUsername !== undefined) mappedUpdates.custom_username = updates.customUsername;
    if (updates.customAvatarUrl !== undefined) mappedUpdates.custom_avatar_url = updates.customAvatarUrl;
    if (updates.includeTimestamp !== undefined) mappedUpdates.include_timestamp = updates.includeTimestamp;
    if (updates.enabled !== undefined) mappedUpdates.enabled = updates.enabled;

    const webhook = await Webhook.updateUserWebhook(id, req.user.id, mappedUpdates);
    
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({ 
      webhook: {
        ...webhook,
        webhook_url_masked: '****' + webhook.webhook_url.slice(-8),
      }
    });
  } catch (error) {
    logger.error('Error updating webhook:', error);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

/**
 * DELETE /api/webhooks/:id - Delete a webhook
 */
router.delete('/:id', requireUserAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Webhook.deleteUserWebhook(id, req.user.id);
    
    if (!result) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting webhook:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

/**
 * POST /api/webhooks/:id/test - Test a webhook
 */
router.post('/:id/test', requireUserAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const webhook = await Webhook.getUserWebhookById(id, req.user.id);
    
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const result = await discordWebhookService.sendTest(webhook, false);
    
    if (result.success) {
      res.json({ success: true, message: 'Test webhook sent successfully' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    logger.error('Error testing webhook:', error);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

// ============ Webhook URL Bank ============

/**
 * GET /api/webhooks/urls - Get saved webhook URLs
 */
router.get('/urls', requireUserAuth, async (req, res) => {
  try {
    const urls = await Webhook.getSavedUrls(req.user.id);
    
    // Mask URLs for security (only show last 8 chars)
    const maskedUrls = urls.map(u => ({
      ...u,
      webhook_url_masked: '****' + u.webhook_url.slice(-8),
    }));
    
    const maxUrlsPerUser = await ConfigService.get('webhooks.maxUrlsPerUser');
    
    res.json({ 
      urls: maskedUrls,
      limits: {
        maxUrlsPerUser,
      }
    });
  } catch (error) {
    logger.error('Error fetching saved URLs:', error);
    res.status(500).json({ error: 'Failed to fetch saved URLs' });
  }
});

/**
 * POST /api/webhooks/urls - Save a webhook URL
 */
router.post('/urls', requireUserAuth, async (req, res) => {
  try {
    const { name, webhookUrl } = req.body;

    if (!name || !webhookUrl) {
      return res.status(400).json({ error: 'Name and webhook URL are required' });
    }

    if (!isValidWebhookUrl(webhookUrl)) {
      return res.status(400).json({ error: 'Invalid Discord webhook URL' });
    }

    // Check limit
    const maxUrls = await ConfigService.get('webhooks.maxUrlsPerUser');
    const count = await Webhook.countSavedUrls(req.user.id);
    if (count >= maxUrls) {
      return res.status(400).json({ error: `Maximum of ${maxUrls} saved URLs allowed` });
    }

    const url = await Webhook.saveUrl(req.user.id, name, webhookUrl);
    
    res.status(201).json({ 
      url: {
        ...url,
        webhook_url_masked: '****' + url.webhook_url.slice(-8),
      }
    });
  } catch (error) {
    logger.error('Error saving URL:', error);
    res.status(500).json({ error: 'Failed to save URL' });
  }
});

/**
 * PUT /api/webhooks/urls/:id - Update a saved URL name
 */
router.put('/urls/:id', requireUserAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const url = await Webhook.updateSavedUrl(id, req.user.id, name);
    
    if (!url) {
      return res.status(404).json({ error: 'Saved URL not found' });
    }

    res.json({ 
      url: {
        ...url,
        webhook_url_masked: '****' + url.webhook_url.slice(-8),
      }
    });
  } catch (error) {
    logger.error('Error updating saved URL:', error);
    res.status(500).json({ error: 'Failed to update saved URL' });
  }
});

/**
 * DELETE /api/webhooks/urls/:id - Delete a saved URL
 */
router.delete('/urls/:id', requireUserAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Webhook.deleteSavedUrl(id, req.user.id);
    
    if (!result) {
      return res.status(404).json({ error: 'Saved URL not found' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting saved URL:', error);
    res.status(500).json({ error: 'Failed to delete saved URL' });
  }
});

// ============ Admin Webhooks ============

/**
 * GET /api/admin/webhooks - Get all admin webhooks
 */
router.get('/admin', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    const webhooks = await Webhook.getAdminWebhooks();
    
    const maskedWebhooks = webhooks.map(w => ({
      ...w,
      webhook_url_masked: '****' + w.webhook_url.slice(-8),
    }));
    
    res.json({ webhooks: maskedWebhooks });
  } catch (error) {
    logger.error('Error fetching admin webhooks:', error);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

/**
 * POST /api/admin/webhooks - Create an admin webhook
 */
router.post('/admin', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    const {
      name,
      webhookUrl,
      webhookType,
      config,
      embedColor,
      customUsername,
      customAvatarUrl,
    } = req.body;

    if (!name || !webhookUrl || !webhookType) {
      return res.status(400).json({ error: 'Name, webhook URL, and type are required' });
    }

    if (!isValidWebhookUrl(webhookUrl)) {
      return res.status(400).json({ error: 'Invalid Discord webhook URL' });
    }

    const validTypes = ['user_signup', 'data_request', 'system_event', 'error_alert'];
    if (!validTypes.includes(webhookType)) {
      return res.status(400).json({ error: 'Invalid webhook type' });
    }

    const webhook = await Webhook.createAdminWebhook({
      name,
      webhookUrl,
      webhookType,
      config: config || {},
      embedColor,
      customUsername,
      customAvatarUrl,
      createdBy: req.user.id,
    });

    res.status(201).json({ 
      webhook: {
        ...webhook,
        webhook_url_masked: '****' + webhook.webhook_url.slice(-8),
      }
    });
  } catch (error) {
    logger.error('Error creating admin webhook:', error);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

/**
 * PUT /api/admin/webhooks/:id - Update an admin webhook
 */
router.put('/admin/:id', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.webhookUrl && !isValidWebhookUrl(updates.webhookUrl)) {
      return res.status(400).json({ error: 'Invalid Discord webhook URL' });
    }

    const mappedUpdates = {};
    if (updates.name !== undefined) mappedUpdates.name = updates.name;
    if (updates.webhookUrl !== undefined) mappedUpdates.webhook_url = updates.webhookUrl;
    if (updates.config !== undefined) mappedUpdates.config = updates.config;
    if (updates.embedColor !== undefined) mappedUpdates.embed_color = updates.embedColor;
    if (updates.customUsername !== undefined) mappedUpdates.custom_username = updates.customUsername;
    if (updates.customAvatarUrl !== undefined) mappedUpdates.custom_avatar_url = updates.customAvatarUrl;
    if (updates.enabled !== undefined) mappedUpdates.enabled = updates.enabled;

    const webhook = await Webhook.updateAdminWebhook(id, mappedUpdates);
    
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({ 
      webhook: {
        ...webhook,
        webhook_url_masked: '****' + webhook.webhook_url.slice(-8),
      }
    });
  } catch (error) {
    logger.error('Error updating admin webhook:', error);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

/**
 * DELETE /api/admin/webhooks/:id - Delete an admin webhook
 */
router.delete('/admin/:id', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Webhook.deleteAdminWebhook(id);
    
    if (!result) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting admin webhook:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

/**
 * POST /api/admin/webhooks/:id/test - Test an admin webhook
 */
router.post('/admin/:id/test', requireUserAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const webhook = await Webhook.getAdminWebhookById(id);
    
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const result = await discordWebhookService.sendTest(webhook, true);
    
    if (result.success) {
      res.json({ success: true, message: 'Test webhook sent successfully' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    logger.error('Error testing admin webhook:', error);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

export default router;
