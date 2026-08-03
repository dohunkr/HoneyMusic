require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  youtubeApiKey: process.env.YOUTUBE_API_KEY,
  geniusApiKey: process.env.GENIUS_API_KEY,
  defaultVolume: parseInt(process.env.DEFAULT_VOLUME || '100', 10),
  autoLeaveCooldownMinutes: parseInt(process.env.AUTO_LEAVE_COOLDOWN_MINUTES || '5', 10),
  chartChannelUrl: 'https://www.youtube.com/@chartdoong2/videos',
  chartChannelHandle: '@chartdoong2',
};
