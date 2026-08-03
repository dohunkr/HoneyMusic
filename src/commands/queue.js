const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const musicManager = require('../music/MusicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('큐')
    .setDescription('현재 대기열 목록을 확인합니다.'),

  async execute(interaction) {
    const queue = musicManager.queues.get(interaction.guild.id);
    if (!queue || (!queue.currentSong && queue.songs.length === 0)) {
      return interaction.reply({ content: '📜 대기열이 비어 있습니다.', ephemeral: true });
    }

    const currentText = queue.currentSong
      ? `**지금 재생 중:** [${queue.currentSong.title}](${queue.currentSong.url}) (<@${queue.currentSong.requestedBy}>)`
      : '현재 재생 중인 곡 없음';

    const queueList = queue.songs.slice(0, 10).map((song, i) => `${i + 1}. [${song.title}](${song.url}) - <@${song.requestedBy}>`).join('\n');
    const remainingCount = queue.songs.length > 10 ? `\n\n...외 ${queue.songs.length - 10}곡` : '';

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle(`📜 [${interaction.guild.name}] 음악 대기열`)
      .setDescription(`${currentText}\n\n**[다음 대기 목록]**\n${queueList || '대기 중인 다음 곡이 없습니다.'}${remainingCount}`)
      .setFooter({ text: `총 ${queue.songs.length}곡 대기 중` });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
