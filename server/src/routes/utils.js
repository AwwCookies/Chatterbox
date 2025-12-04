import express from 'express';
import logger from '../utils/logger.js';

const router = express.Router();

// Simple in-memory cache for URL metadata
const metadataCache = new Map();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

// Clean up old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of metadataCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      metadataCache.delete(key);
    }
  }
}, 1000 * 60 * 5); // Clean every 5 minutes

/**
 * Extract Open Graph and meta tags from HTML
 */
function extractMetadata(html, url) {
  const metadata = {
    url,
    title: null,
    description: null,
    image: null,
    siteName: null,
    type: null,
    favicon: null,
  };

  try {
    // Extract Open Graph tags
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    if (ogTitleMatch) metadata.title = ogTitleMatch[1];

    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
    if (ogDescMatch) metadata.description = ogDescMatch[1];

    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogImageMatch) metadata.image = ogImageMatch[1];

    const ogSiteMatch = html.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i);
    if (ogSiteMatch) metadata.siteName = ogSiteMatch[1];

    const ogTypeMatch = html.match(/<meta[^>]*property=["']og:type["'][^>]*content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:type["']/i);
    if (ogTypeMatch) metadata.type = ogTypeMatch[1];

    // Fallback to regular meta tags
    if (!metadata.title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) metadata.title = titleMatch[1].trim();
    }

    if (!metadata.description) {
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
      if (descMatch) metadata.description = descMatch[1];
    }

    // Twitter card fallbacks
    if (!metadata.image) {
      const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
                                html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
      if (twitterImageMatch) metadata.image = twitterImageMatch[1];
    }

    // Extract favicon
    const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i) ||
                         html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i);
    if (faviconMatch) {
      let favicon = faviconMatch[1];
      // Make favicon URL absolute
      if (favicon.startsWith('//')) {
        favicon = 'https:' + favicon;
      } else if (favicon.startsWith('/')) {
        const urlObj = new URL(url);
        favicon = urlObj.origin + favicon;
      } else if (!favicon.startsWith('http')) {
        const urlObj = new URL(url);
        favicon = urlObj.origin + '/' + favicon;
      }
      metadata.favicon = favicon;
    }

    // Decode HTML entities
    if (metadata.title) metadata.title = decodeHTMLEntities(metadata.title);
    if (metadata.description) metadata.description = decodeHTMLEntities(metadata.description);

    // Make image URL absolute if needed
    if (metadata.image && !metadata.image.startsWith('http')) {
      if (metadata.image.startsWith('//')) {
        metadata.image = 'https:' + metadata.image;
      } else if (metadata.image.startsWith('/')) {
        const urlObj = new URL(url);
        metadata.image = urlObj.origin + metadata.image;
      }
    }

  } catch (e) {
    logger.warn('Error extracting metadata:', e.message);
  }

  return metadata;
}

function decodeHTMLEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

/**
 * GET /api/utils/link-preview
 * Fetch metadata for a URL
 */
router.get('/link-preview', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // Check cache
  if (metadataCache.has(url)) {
    const cached = metadataCache.get(url);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json(cached.data);
    }
    metadataCache.delete(url);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ChatterboxBot/1.0; +https://github.com/AwwCookies/Chatterbox)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(400).json({ error: 'Failed to fetch URL' });
    }

    const contentType = response.headers.get('content-type') || '';
    
    // Handle different content types
    if (contentType.includes('image/')) {
      const metadata = {
        url,
        type: 'image',
        image: url,
        title: url.split('/').pop() || 'Image',
      };
      metadataCache.set(url, { data: metadata, timestamp: Date.now() });
      return res.json(metadata);
    }

    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return res.status(400).json({ error: 'URL does not return HTML' });
    }

    const html = await response.text();
    const metadata = extractMetadata(html, url);

    // Cache the result
    metadataCache.set(url, { data: metadata, timestamp: Date.now() });

    res.json(metadata);
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(408).json({ error: 'Request timeout' });
    }
    logger.error('Error fetching link preview:', error.message);
    res.status(500).json({ error: 'Failed to fetch link metadata' });
  }
});

export default router;
