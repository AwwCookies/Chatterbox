import tmi from 'tmi.js';
import logger from '../utils/logger.js';

export const createTwitchClient = (channels = []) => {
  const options = {
    options: {
      debug: process.env.LOG_LEVEL === 'debug',
    },
    connection: {
      reconnect: true,
      secure: true,
    },
    identity: {
      username: process.env.TWITCH_USERNAME,
      password: process.env.TWITCH_PASSWORD,
    },
    channels: channels,
  };

  const client = new tmi.Client(options);

  client.on('connected', (address, port) => {
    logger.info(`Connected to Twitch IRC at ${address}:${port}`);
  });

  client.on('disconnected', (reason) => {
    logger.warn('Disconnected from Twitch IRC:', reason);
  });

  client.on('reconnect', () => {
    logger.info('Reconnecting to Twitch IRC...');
  });

  return client;
};

export const getInitialChannels = () => {
  const channelsEnv = process.env.CHANNELS || '';
  return channelsEnv.split(',').map(c => c.trim()).filter(c => c.length > 0);
};
