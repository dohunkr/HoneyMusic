const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../music/MusicManager');
const AudioStreamer = require('../audio/AudioStreamer');

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
      const { track, metadata } = await AudioStreamer.searchTracks(interaction.client.manager, query, interaction.user.id);

      const songItem = {
        query: metadata.url,
        title: metadata.title,
        url: metadata.url,
        requestedBy: interaction.user.id,
        duration: metadata.duration,
        thumbnail: metadata.thumbnail,
        artist: metadata.artist,
        trackData: track // Lavalink raw track
      };

      // 플레이어 큐에 트랙 삽입
      queue.player.queue.add(track);

      if (!queue.player.playing && !queue.player.paused) {
        // 아이들 상태: 지금 바로 재생
        queue.player.data.set('currentSong', songItem);
        await queue.player.play();
        await interaction.editReply(`🎵 **재생을 시작합니다**: [${metadata.title}](${metadata.url})`);
      } else {
        // 이미 재생 중: 대기열에 추가
        await interaction.editReply(`📥 **대기열에 추가되었습니다** (${queue.player.queue.length}번째): [${metadata.title}](${metadata.url})`);
      }
    } catch (err) {
      await interaction.editReply(`❌ **재생 요청 실패**: ${err.message}`);
    }
  }
};
