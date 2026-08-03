/**
 * embedBuilder.js
 * 전용 음악채널 고정 메시지 임베드, 재생 컨트롤러 임베드 및 버튼 팩토리 모듈
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const AudioEnhancer = require('../audio/AudioEnhancer');

class CustomEmbedBuilder {
  /**
   * 음악 채널 상단 고정 안내 임베드
   * @param {string} guildName 
   * @param {string} botIconUrl 
   */
  static buildChannelHeaderEmbed(guildName, botIconUrl) {
    const embed = new EmbedBuilder()
      .setColor('#FFA500') // 꿀색/주황색
      .setTitle(`🍯 [${guildName}] - 음악채널`)
      .setDescription(
        '**HoneyMusic 고음질 라이브 공연장 사운드 봇에 오신 것을 환영합니다!**\n\n' +
        '📌 **이 채널에서 이용 가능한 기능:**\n' +
        '• **노래 제목 또는 URL 입력**: 별도 명령어 없이 이 채널에 메시지로 입력하면 자동 재생됩니다.\n' +
        '• **기본 음보정 (공연장 사운드)**: 꽉 차고 입체적인 라이브 사운드 필터 체인이 기본 적용되어 있습니다.\n' +
        '• **하단 버튼 메뉴**: 인기차트, 최근 재생, 명령어 목록, 가사 검색 기능 등을 손쉽게 이용해 보세요.'
      )
      .setThumbnail(botIconUrl || 'https://cdn-icons-png.flaticon.com/512/3844/3844724.png')
      .setFooter({ text: 'HoneyMusic • 최고의 음질과 공연장 울림으로 음악을 즐기세요!' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_history').setLabel('🎫 최근').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('btn_chart').setLabel('🟢 인기차트').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('btn_help').setLabel('📋 명령어 보기').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('btn_lyrics').setLabel('🎵 가사 보기').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('btn_search').setLabel('🔍 음악 검색하기').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row] };
  }

  /**
   * 재생 진행바 생성 헬퍼 (예: [🟦🟦🟦⚪⬜⬜⬜])
   */
  static buildProgressBar(currentSec, totalSec, barLength = 10) {
    if (!totalSec || totalSec === 0) return '🔴 라이브 스트리밍';

    const progress = Math.min(1, Math.max(0, currentSec / totalSec));
    const filledCount = Math.round(progress * barLength);
    const emptyCount = barLength - filledCount;

    const filledBar = '🟦'.repeat(Math.max(0, filledCount - 1));
    const currentPoint = filledCount > 0 ? '⚪' : '';
    const emptyBar = '⬜'.repeat(emptyCount);

    return `[${filledBar}${currentPoint}${emptyBar}]`;
  }

  /**
   * 초 단위를 mm:ss 포맷으로 변환
   */
  static formatTime(seconds) {
    if (!seconds || seconds === 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * "지금 재생 중" 임베드 & 컨트롤 버튼 생성
   */
  static buildPlayingEmbed(queueItem, playerState = {}) {
    const {
      isPaused = false,
      loopMode = 'off', // 'off' | 'track' | 'queue'
      presetKey = 'concert',
      speed = 1.0,
      volume = 100,
      currentSec = 0
    } = playerState;

    const presetName = AudioEnhancer.getPresetName(presetKey);
    const progressBar = this.buildProgressBar(currentSec, queueItem.duration);
    const currentTimeStr = this.formatTime(currentSec);
    const totalTimeStr = this.formatTime(queueItem.duration);

    const loopText = loopMode === 'track' ? '🔂 한 곡 반복' : loopMode === 'queue' ? '🔁 전체 반복' : '➡️ 끄기';

    const embed = new EmbedBuilder()
      .setColor('#00FF7F')
      .setTitle(`🎶 지금 재생 중: ${queueItem.title}`)
      .setURL(queueItem.url)
      .setThumbnail(queueItem.thumbnail || 'https://cdn-icons-png.flaticon.com/512/3844/3844724.png')
      .addFields(
        { name: '👤 신청자', value: `<@${queueItem.requestedBy}>`, inline: true },
        { name: '🎚️ 음보정 프리셋', value: `\`${presetName}\``, inline: true },
        { name: '⏩ 재생 속도', value: `\`${speed}x\``, inline: true },
        { name: '🔊 볼륨', value: `\`${volume}%\``, inline: true },
        { name: '🔁 반복 상태', value: `\`${loopText}\``, inline: true },
        { name: '⏱️ 재생 시간', value: `\`${currentTimeStr} / ${totalTimeStr}\`\n${progressBar}`, inline: false }
      )
      .setFooter({ text: `HoneyMusic • 아티스트: ${queueItem.artist || '알 수 없음'}` });

    // 컨트롤 버튼 로우 1 (재생/정지 관련)
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(isPaused ? 'btn_resume' : 'btn_pause')
        .setLabel(isPaused ? '▶ 재생' : '⏸ 일시정지')
        .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('btn_skip').setLabel('⏭ 스킵').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('btn_stop').setLabel('⏹ 정지').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('btn_loop').setLabel(`🔁 반복 (${loopMode})`).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('btn_shuffle').setLabel('🔀 셔플').setStyle(ButtonStyle.Secondary)
    );

    // 컨트롤 버튼 로우 2 (음보정/기타)
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_preset_menu').setLabel('🎚️ 음보정 프리셋 변경').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('btn_queue').setLabel('📜 대기열 보기').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row1, row2] };
  }

  /**
   * 음보정 프리셋 선택 드롭다운 메뉴
   */
  static buildPresetSelectMenu() {
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('select_preset')
        .setPlaceholder('음보정 프리셋을 선택해 주세요.')
        .addOptions([
          {
            label: '🏛️ 공연장 (기본값)',
            description: '라이브 공연장의 풍부한 저음 울림과 꽉 찬 입체적 공간감',
            value: 'concert'
          },
          {
            label: '💿 원본 (RAW)',
            description: '음보정 필터를 끄고 원본 소스 오디오 그대로 감상',
            value: 'raw'
          },
          {
            label: '🔊 베이스 부스트 (Bass Boost)',
            description: '묵직하고 강렬한 저음 대역 극대화',
            value: 'bassboost'
          },
          {
            label: '✨ 선명하게 (Clear Vocal)',
            description: '보컬과 고음 대역을 맑고 뚜렷하게 보정',
            value: 'clear'
          }
        ])
    );
    return row;
  }
}

module.exports = CustomEmbedBuilder;
