const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const musicManager = require('../music/MusicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('히스토리')
    .setDescription('최근 요청하여 감상했던 최근 곡 히스토리를 확인합니다.'),

  async execute(interaction) {
    const queue = musicManager.getQueue(interaction.guild.id);
    if (!queue || !queue.player || queue.player.queue.previous.length === 0) {
      return interaction.reply({ content: '🎫 최근 재생했던 곡 히스토리가 기록되지 않았습니다.', ephemeral: true });
    }

    // Kazagumo의 player.queue.previous 배열 사용
    const historyList = queue.player.queue.previous.slice(-10).reverse().map((track, i) => {
      const reqId = track.requester?.id ? `<@${track.requester.id}>` : '자동재생';
      return `${i + 1}. [${track.title}](${track.uri}) - ${reqId}`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor('#1E90FF')
      .setTitle(`🎫 [${interaction.guild.name}] 최근 곡 재생 히스토리`)
      .setDescription(historyList)
      .setFooter({ text: 'HoneyMusic • 최근 재생 목록' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
