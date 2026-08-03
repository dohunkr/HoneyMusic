const musicManager = require('../music/MusicManager');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const guildId = oldState.guild.id;
    const queue = musicManager.queues.get(guildId);

    if (!queue || !queue.connection) return;

    const botVoiceChannelId = queue.connection.joinConfig.channelId;
    const botChannel = oldState.guild.channels.cache.get(botVoiceChannelId);

    if (botChannel) {
      // 봇을 제외한 사람 수 카운트
      const nonBotMembers = botChannel.members.filter(m => !m.user.bot);
      if (nonBotMembers.size === 0) {
        // 음성 채널에 무인 상태 감지 시 즉시 또는 타이머 후 자동 퇴장
        queue.destroy();
        if (queue.textChannel) {
          queue.textChannel.send('🚪 **음성 채널에 아무도 없어 자동으로 퇴장했습니다.**')
            .then(msg => {
              setTimeout(() => msg.delete().catch(() => {}), 10000); // 10초 뒤 삭제
            })
            .catch(() => {});
        }
      }
    }
  }
};
