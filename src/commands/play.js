const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../music/MusicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('재생')
    .setDescription('노래 제목 또는 URL을 음성 채널에서 재생합니다.')
    .addStringOption(option =>
      option.setName('검색어')
        .setDescription('유튜브/사운드클라우드 노래 제목 또는 URL')
        .setRequired(true)
    ),

  async execute(interaction) {
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: '❌ 먼저 음성 채널에 입점해 주세요!', ephemeral: true });
    }

    const query = interaction.options.getString('검색어');
    await interaction.deferReply({ ephemeral: true });

    try {
      const queue = await musicManager.joinChannel(voiceChannel, interaction.channel);
      const songItem = {
        query,
        title: query,
        url: query,
        requestedBy: interaction.user.id,
        duration: 0
      };

      queue.songs.push(songItem);

      if (queue.player.state.status !== 'playing' && !queue.currentSong) {
        queue.playNext();
        await interaction.editReply(`🎵 **재생을 시작합니다**: ${query}`);
      } else {
        await interaction.editReply(`📥 **대기열에 추가되었습니다** (${queue.songs.length}번째): ${query}`);
      }
    } catch (err) {
      await interaction.editReply(`❌ **재생 요청 실패**: ${err.message}`);
    }
  }
};
