const MusicChannelSetup = require('../music/MusicChannelSetup');
const musicManager = require('../music/MusicManager');

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
        const songItem = {
          query: userQuery,
          title: userQuery,
          url: userQuery,
          requestedBy: message.author.id,
          duration: 0
        };

        queue.songs.push(songItem);

        if (queue.player.state.status !== 'playing' && !queue.currentSong) {
          queue.playNext();
          const infoMsg = await message.channel.send(`🎵 **[자동 재생 시작]**: ${userQuery}`);
          setTimeout(() => infoMsg.delete().catch(() => {}), 5000);
        } else {
          const infoMsg = await message.channel.send(`📥 **[대기열 추가]** (${queue.songs.length}번째): ${userQuery}`);
          setTimeout(() => infoMsg.delete().catch(() => {}), 5000);
        }
      } catch (err) {
        const errorMsg = await message.channel.send(`❌ 재생 요청 오류: ${err.message}`);
        setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
      }
    }
  }
};
