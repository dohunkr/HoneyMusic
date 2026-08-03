const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../music/MusicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('컨트롤')
    .setDescription('재생, 일시정지, 스킵, 정지, 배속, 볼륨 등 재생 관리')
    .addSubcommand(sub => sub.setName('스킵').setDescription('현재 곡을 넘깁니다.'))
    .addSubcommand(sub => sub.setName('일시정지').setDescription('재생을 일시정지합니다.'))
    .addSubcommand(sub => sub.setName('재개').setDescription('일시정지된 재생을 다시 시작합니다.'))
    .addSubcommand(sub => sub.setName('정지').setDescription('재생을 정지하고 대기열을 비웁니다.'))
    .addSubcommand(sub => sub.setName('반복').setDescription('반복 모드를 변경합니다.')
      .addStringOption(opt => opt.setName('모드').setDescription('반복 옵션').setRequired(true)
        .addChoices(
          { name: '➡️ 끄기', value: 'off' },
          { name: '🔂 한 곡 반복', value: 'track' },
          { name: '🔁 전체 반복', value: 'queue' }
        )))
    .addSubcommand(sub => sub.setName('배속').setDescription('재생 속도를 설정합니다. (0.5x ~ 2.0x)')
      .addNumberOption(opt => opt.setName('속도').setDescription('속도 값').setRequired(true).setMinValue(0.5).setMaxValue(2.0)))
    .addSubcommand(sub => sub.setName('볼륨').setDescription('재생 볼륨을 설정합니다. (0% ~ 200%)')
      .addIntegerOption(opt => opt.setName('크기').setDescription('볼륨 크기').setRequired(true).setMinValue(0).setMaxValue(200))),

  async execute(interaction) {
    const queue = musicManager.queues.get(interaction.guild.id);
    if (!queue || (!queue.currentSong && queue.songs.length === 0)) {
      return interaction.reply({ content: '❌ 현재 실행 중인 음악 서비스가 없습니다.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === '스킵') {
      queue.player.stop();
      return interaction.reply({ content: '⏭ **현재 곡을 스킵했습니다.**', ephemeral: true });
    }

    if (sub === '일시정지') {
      queue.player.pause();
      queue.lastPauseTime = Date.now();
      queue._updateNowPlayingMessage();
      return interaction.reply({ content: '⏸ **재생을 일시정지했습니다.**', ephemeral: true });
    }

    if (sub === '재개') {
      queue.player.unpause();
      if (queue.lastPauseTime) {
        queue.pausedDuration += (Date.now() - queue.lastPauseTime);
        queue.lastPauseTime = 0;
      }
      queue._updateNowPlayingMessage();
      return interaction.reply({ content: '▶ **재생을 재개합니다.**', ephemeral: true });
    }

    if (sub === '정지') {
      queue.destroy();
      return interaction.reply({ content: '⏹ **재생을 정지하고 채널에서 퇴장했습니다.**', ephemeral: true });
    }

    if (sub === '반복') {
      const mode = interaction.options.getString('모드');
      queue.loopMode = mode;
      queue._updateNowPlayingMessage();
      return interaction.reply({ content: `🔁 **반복 모드가 [ ${mode} ](으)로 변경되었습니다.**`, ephemeral: true });
    }

    if (sub === '배속') {
      const speed = interaction.options.getNumber('속도');
      queue.speed = speed;
      queue._updateNowPlayingMessage();
      return interaction.reply({ content: `⏩ **재생 속도가 ${speed}x 로 설정되었습니다. (다음 곡부터 바로 적용)**`, ephemeral: true });
    }

    if (sub === '볼륨') {
      const vol = interaction.options.getInteger('크기');
      queue.volume = vol;
      if (queue.player.state.status === 'playing' && queue.player.state.resource?.volume) {
        queue.player.state.resource.volume.setVolume(vol / 100);
      }
      queue._updateNowPlayingMessage();
      return interaction.reply({ content: `🔊 **볼륨이 ${vol}% 로 설정되었습니다.**`, ephemeral: true });
    }
  }
};
