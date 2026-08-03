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
      
      let videoUrl = query;
      let videoTitle = query;
      
      const isUrl = query.startsWith('http://') || query.startsWith('https://');
      if (!isUrl) {
        const searchResult = await play.search(query, { limit: 1 });
        if (!searchResult || searchResult.length === 0) {
          return interaction.editReply(`❌ 검색 결과가 없습니다: ${query}`);
        }
        videoUrl = searchResult[0].url;
        videoTitle = searchResult[0].title;
      } else {
        if (play.yt_validate(query) === 'video') {
          const info = await play.video_info(query);
          videoUrl = info.video_details.url;
          videoTitle = info.video_details.title;
        }
      }

      const songItem = {
        query: videoUrl,
        title: videoTitle,
        url: videoUrl,
        requestedBy: interaction.user.id,
        duration: 0
      };

      queue.songs.push(songItem);

      if (queue.player.state.status !== 'playing' && !queue.currentSong) {
        queue.playNext();
        await interaction.editReply(`🎵 **재생을 시작합니다**: [${videoTitle}](${videoUrl})`);
      } else {
        await interaction.editReply(`📥 **대기열에 추가되었습니다** (${queue.songs.length}번째): [${videoTitle}](${videoUrl})`);
      }
    } catch (err) {
      await interaction.editReply(`❌ **재생 요청 실패**: ${err.message}`);
    }
  }
};
