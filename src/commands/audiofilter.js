const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../music/MusicManager');
const AudioEnhancer = require('../audio/AudioEnhancer');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('음보정')
    .setDescription('오디오 필터 프리셋 변경 또는 음보정 토글')
    .addStringOption(option =>
      option.setName('프리셋')
        .setDescription('음보정 프리셋 선택 또는 끄기')
        .setRequired(true)
        .addChoices(
          { name: '🏛️ 공연장 (기본값)', value: 'concert' },
          { name: '💿 원본 (음보정 끄기)', value: 'raw' },
          { name: '🔊 베이스부스트', value: 'bassboost' },
          { name: '✨ 선명하게', value: 'clear' }
        )
    ),

  async execute(interaction) {
    const queue = musicManager.queues.get(interaction.guild.id);
    if (!queue || !queue.currentSong) {
      return interaction.reply({ content: '❌ 현재 재생 중인 음악이 없습니다.', ephemeral: true });
    }

    const preset = interaction.options.getString('프리셋');
    queue.presetKey = preset;

    await interaction.reply({
      content: `🎚️ **음보정 프리셋이 [ ${AudioEnhancer.getPresetName(preset)} ](으)로 변경되었습니다.**\n다음 곡부터 적용되며, 현재 곡 재생을 유지합니다.`,
      ephemeral: true
    });

    queue._updateNowPlayingMessage();
  }
};
