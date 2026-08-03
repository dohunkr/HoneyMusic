const MusicChannelSetup = require('../music/MusicChannelSetup');
const musicManager = require('../music/MusicManager');
const play = require('play-dl');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    // 봇 메시지 무시
    if (message.author.bot || !message.guild) return;

    // 전용 음악 채널(🎵ㆍ음악채널) 여부 감지
    if (message.channel.name === MusicChannelSetup.CHANNEL_NAME) {
      const userVoiceChannel = message.member?.voice?.channel;

      // 작성된 유저 메시지는 깔끔한 채널 관리를 위해 2초 후 자동 삭제
      const userQuery = message.content.trim();
      setTimeout(() => message.delete().catch(() => {}), 2000);

      if (!userQuery) return;

      if (!userVoiceChannel) {
        const warnMsg = await message.channel.send(`⚠️ <@${message.author.id}>님, 음악을 재생하려면 먼저 음성 채널에 입점해 주세요!`);
        setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
        return;
      }

      try {
        const queue = await musicManager.joinChannel(userVoiceChannel, message.channel);
        
        // 검색 진행
        const searchRes = await play.search(userQuery, { limit: 1 });
        if (!searchRes || searchRes.length === 0) {
          const failMsg = await message.channel.send(`❌ **검색 결과가 없습니다**: ${userQuery}`);
          setTimeout(() => failMsg.delete().catch(() => {}), 5000);
          return;
        }

        const video = searchRes[0];
        const songItem = {
          query: video.url,
          title: video.title,
          url: video.url,
          requestedBy: message.author.id,
          duration: video.durationInSec,
          thumbnail: video.thumbnails?.[0]?.url || '',
          artist: video.channel?.name || 'YouTube'
        };

        queue.songs.push(songItem);

        if (queue.player.state.status !== 'playing' && !queue.currentSong) {
          queue.playNext();
          const infoMsg = await message.channel.send(`🎵 **[자동 재생 시작]**: [${video.title}](${video.url})`);
          setTimeout(() => infoMsg.delete().catch(() => {}), 10000); // 10초 대기
        } else {
          const infoMsg = await message.channel.send(`📥 **[대기열 추가]** (${queue.songs.length}번째): [${video.title}](${video.url})`);
          setTimeout(() => infoMsg.delete().catch(() => {}), 10000); // 10초 대기
        }
      } catch (err) {
        const errorMsg = await message.channel.send(`❌ 재생 요청 오류: ${err.message}`);
        setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
      }
    }
  }
};
