const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const musicManager = require('../music/MusicManager');
const LyricsFetcher = require('../utils/lyricsFetcher');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('가사')
    .setDescription('현재 재생 중인 곡 또는 지정한 검색어로 가사를 검색합니다.')
    .addStringOption(opt => opt.setName('곡제목').setDescription('검색할 노래 제목 (기본값: 현재 재생 곡)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const queue = musicManager.queues.get(interaction.guild.id);
    let titleToSearch = interaction.options.getString('곡제목');

    if (!titleToSearch) {
      if (queue && queue.currentSong) {
        titleToSearch = queue.currentSong.title;
      } else {
        return interaction.editReply('❌ 검색할 곡 제목을 입력하거나 음악을 재생해 주세요.');
      }
    }

    const res = await LyricsFetcher.searchLyrics(titleToSearch);

    const embed = new EmbedBuilder()
      .setColor('#FF69B4')
      .setTitle(`🎵 가사 검색: ${res.title}`)
      .setThumbnail(res.thumbnail || 'https://cdn-icons-png.flaticon.com/512/3844/3844724.png')
      .setDescription(res.geniusUrl ? `🔗 [Genius에서 전체 가사 보기 ↗](${res.geniusUrl})\n\n아티스트: **${res.artist}**` : res.lyrics);

    return interaction.editReply({ embeds: [embed] });
  }
};
