/**
 * MusicManager.js
 * Kazagumo 플레이어 & 대기열 라이프사이클 관리 매니저
 */

const AudioEnhancer = require('../audio/AudioEnhancer');
const embedBuilder = require('../utils/embedBuilder');
const config = require('../config');

// Lavalink 필터 설정을 위한 preset 정보 맵핑
// Lavalink Equalizer 밴드 설정 (0 ~ 14 밴드)
const PRESET_FILTERS = {
  concert: {
    // 🏛️ 공연장: 저음 부스트, 에코(공간감) 효과 에뮬레이션
    equalizer: [
      { band: 0, gain: 0.25 },
      { band: 1, gain: 0.20 },
      { band: 2, gain: 0.15 },
      { band: 3, gain: -0.10 }, // 보컬 영역 살짝 깎아 입체감 형성
      { band: 14, gain: 0.20 } // 고음 살짝 부스트
    ],
    tremolo: { frequency: 4.0, depth: 0.15 } // 아주 약간의 공간 떨림 제공
  },
  raw: {
    equalizer: [],
    tremolo: null
  },
  bassboost: {
    equalizer: [
      { band: 0, gain: 0.35 },
      { band: 1, gain: 0.30 },
      { band: 2, gain: 0.25 },
      { band: 3, gain: 0.15 }
    ],
    tremolo: null
  },
  clear: {
    equalizer: [
      { band: 0, gain: -0.10 },
      { band: 6, gain: 0.20 },
      { band: 7, gain: 0.25 },
      { band: 8, gain: 0.20 }
    ],
    tremolo: null
  }
};

class MusicQueue {
  constructor(guildId, musicManager, clientPlayer) {
    this.guildId = guildId;
    this.musicManager = musicManager;
    this.player = clientPlayer; // KazagumoPlayer

    this.presetKey = 'concert';
    this.speed = 1.0;
    this.loopMode = 'off'; // 'off' | 'track' | 'queue'
    this.textChannel = null;
    this.nowPlayingMessage = null;

    this.leaveTimer = null;

    this._setupPlayerEvents();
  }

  _setupPlayerEvents() {
    this.player.on('start', () => {
      this._cancelLeaveTimer();
      this._updateNowPlayingMessage();
    });

    this.player.on('end', () => {
      // 대기열이 비었는지 확인 후 퇴장 타이머 가동
      if (this.player.queue.length === 0) {
        this._startLeaveTimer();
      }
      this._updateNowPlayingMessage();
    });

    this.player.on('closed', () => {
      this.destroy();
    });

    this.player.on('exception', (err) => {
      console.error(`[Lavalink Playback Error] Guild ${this.guildId}:`, err);
      if (this.textChannel) {
        this.textChannel.send(`⚠️ **재생 중 오류 발생**: ${err.message || 'Lavalink decode error'}`).catch(() => {});
      }
    });
  }

  /**
   * 음보정 필터 적용
   */
  applyFilters() {
    const configData = PRESET_FILTERS[this.presetKey] || PRESET_FILTERS.concert;
    
    // 1. Equalizer 설정
    this.player.setEqualizer(configData.equalizer);

    // 2. Tremolo 및 Timescale(배속) 설정
    const timescale = { speed: this.speed, pitch: 1.0, rate: 1.0 };
    
    const filterOptions = { timescale };
    if (configData.tremolo) {
      filterOptions.tremolo = configData.tremolo;
    }

    // Shoukaku에 직접 필터 주입
    this.player.shoukaku.setFilters(filterOptions);
  }

  async _updateNowPlayingMessage() {
    if (!this.textChannel || !this.player.data.get('currentSong')) return;

    const currentSong = this.player.data.get('currentSong');

    const payload = embedBuilder.buildPlayingEmbed(currentSong, {
      isPaused: this.player.paused,
      loopMode: this.loopMode,
      presetKey: this.presetKey,
      speed: this.speed,
      volume: this.player.volume,
      currentSec: Math.floor((this.player.position || 0) / 1000)
    });

    try {
      if (this.nowPlayingMessage) {
        await this.nowPlayingMessage.edit(payload);
      } else {
        this.nowPlayingMessage = await this.textChannel.send(payload);
      }
    } catch (e) {
      this.nowPlayingMessage = await this.textChannel.send(payload).catch(() => null);
    }
  }

  _startLeaveTimer() {
    this._cancelLeaveTimer();
    const timeoutMs = config.autoLeaveCooldownMinutes * 60 * 1000;
    this.leaveTimer = setTimeout(() => {
      this.destroy();
      if (this.textChannel) {
        this.textChannel.send('💤 **오랫동안 음악 요청이 없어 음성 채널에서 퇴장했습니다.**')
          .then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 10000);
          })
          .catch(() => {});
      }
    }, timeoutMs);
  }

  _cancelLeaveTimer() {
    if (this.leaveTimer) {
      clearTimeout(this.leaveTimer);
      this.leaveTimer = null;
    }
  }

  destroy() {
    this._cancelLeaveTimer();
    if (this.player) {
      this.player.destroy();
    }
    if (this.nowPlayingMessage) {
      this.nowPlayingMessage.delete().catch(() => {});
      this.nowPlayingMessage = null;
    }
    this.musicManager.queues.delete(this.guildId);
  }
}

class MusicManager {
  constructor() {
    this.queues = new Map();
  }

  /**
   * 길드별 큐 얻기
   */
  getQueue(guildId) {
    return this.queues.get(guildId);
  }

  /**
   * 음성 채널 조인 및 Kazagumo 플레이어 생성
   */
  async joinChannel(voiceChannel, textChannel) {
    const client = voiceChannel.client;
    let queue = this.queues.get(voiceChannel.guild.id);

    if (!queue || !queue.player) {
      // Kazagumo 플레이어 조인
      const player = await client.manager.createPlayer({
        guildId: voiceChannel.guild.id,
        voiceId: voiceChannel.id,
        textId: textChannel.id,
        deaf: true
      });

      queue = new MusicQueue(voiceChannel.guild.id, this, player);
      queue.textChannel = textChannel;
      this.queues.set(voiceChannel.guild.id, queue);
    }

    return queue;
  }
}

module.exports = new MusicManager();
