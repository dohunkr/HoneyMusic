const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const musicManager = require('../music/MusicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('히스토리')
    .setDescription('최근 요청하여 감상했던 최근 곡 히스토리를 확인합니다.'),

  async execute(interaction) {
    const queue = musicManager.queues.get(interaction.guild.id);
    if (!queue || queue.history.length === 0) {
      return interaction.reply({ content: '🎫 최근 재생했던 곡 히스토리가 기록되지 않았습니다.', ephemeral: true });
    }

    const historyList = queue.history.slice(0, 10).map((song, i) => `${i + 1}. [${song.title}](${song.url}) - <@${song.requestedBy}>`).join('\n');

    const embed = new EmbedBuilder()
      .setColor('#1E90FF')
      .setTitle(`🎫 [${interaction.guild.name}] 최근 곡 재생 히스토리`)
      .setDescription(historyList)
      .setFooter({ text: 'HoneyMusic • 최근 재생 목록' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
