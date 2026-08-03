const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('도움말')
    .setDescription('HoneyMusic 음악 봇의 전체 명령어 목록과 사용법을 확인합니다.'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('🍯 HoneyMusic 명령어 목록 & 도움말')
      .setDescription('고음질 라이브 공연장 오디오 보정 지원 슬래시 명령어 목록입니다.')
      .addFields(
        { name: '🎵 `/재생 [검색어/URL]`', value: '음성 채널에 접속하여 지정한 노래를 최고 음질로 재생합니다.' },
        { name: '🎚️ `/음보정 [프리셋]`', value: '공연장 / 원본 / 베이스부스트 / 선명하게 오디오 필터를 선택합니다.' },
        { name: '🛠️ `/음악채널`', value: '전용 음악 채널 (`🎵ㆍ음악채널`)을 생성하고 상단 고정 UI를 배치합니다.' },
        { name: '⏯️ `/컨트롤 [스킵/일시정지/재개/정지/반복/배속/볼륨]`', value: '오디오 재생 상태 제어' },
        { name: '📜 `/큐`', value: '현재 음원 대기열 목록 확인' },
        { name: '🎵 `/가사 [곡제목]`', value: 'Genius API 가사 검색' },
        { name: '🎫 `/히스토리`', value: '최근 재생된 곡 히스토리 확인' }
      )
      .setFooter({ text: 'HoneyMusic • 최고의 음질을 경험해 보세요!' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
