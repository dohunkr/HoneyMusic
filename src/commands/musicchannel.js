const { SlashCommandBuilder } = require('discord.js');
const MusicChannelSetup = require('../music/MusicChannelSetup');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('음악채널')
    .setDescription('전용 음악 채널 (🎵ㆍ음악채널)을 자동 생성하고 UI를 배치합니다.'),

  async execute(interaction) {
    if (!interaction.member.permissions.has('ManageChannels')) {
      return interaction.reply({ content: '❌ 채널 관리 권한이 필요합니다.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      const channel = await MusicChannelSetup.setupChannel(interaction.guild);
      await interaction.editReply(`✅ **전용 음악 채널이 준비되었습니다**: <#${channel.id}>`);
    } catch (err) {
      await interaction.editReply(`❌ **음악 채널 생성 실패**: ${err.message}`);
    }
  }
};
