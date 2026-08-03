/**
 * MusicManager.js
 * 길드(서버)별 큐, 음성 채널 연결, 재생/일시정지/스킵/배속/반복 및 자동 퇴장 관리
 */

const {
  joinVoiceChannel,
  createAudioPlayer,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');
const AudioStreamer = require('../audio/AudioStreamer');
const embedBuilder = require('../utils/embedBuilder');
const config = require('../config');

class MusicQueue {
  constructor(guildId, musicManager) {
    this.guildId = guildId;
    this.musicManager = musicManager;

    this.connection = null;
    this.player = createAudioPlayer();
    this.songs = [];
    this.history = [];
    this.currentSong = null;

    this.volume = config.defaultVolume;
    this.presetKey = 'concert'; // 기본 음보정: 공연장
    this.speed = 1.0;
    this.loopMode = 'off'; // 'off' | 'track' | 'queue'
    this.textChannel = null;
    this.nowPlayingMessage = null;

    this.leaveTimer = null;
    this.playbackStartTime = 0;
    this.pausedDuration = 0;
    this.lastPauseTime = 0;

    this._setupPlayerEvents();
  }

  _setupPlayerEvents() {
    this.player.on(AudioPlayerStatus.Playing, () => {
      this.playbackStartTime = Date.now();
      this.pausedDuration = 0;
      this._cancelLeaveTimer();
      this._updateNowPlayingMessage();
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      if (this.currentSong) {
        if (this.loopMode === 'track') {
          // 한 곡 반복: 현재 곡 재배치
          this.songs.unshift(this.currentSong);
        } else if (this.loopMode === 'queue') {
          // 전체 반복: 큐 맨 뒤로 추가
          this.songs.push(this.currentSong);
          this.history.unshift(this.currentSong);
        } else {
          // 반복 없음: 히스토리에만 추가
          this.history.unshift(this.currentSong);
        }
      }

      this.currentSong = null;
      this.playNext();
    });

    this.player.on('error', (error) => {
      console.error(`Guild ${this.guildId} Playback Error:`, error.message);
      if (this.textChannel) {
        this.textChannel.send(`⚠️ **재생 중 오류 발생**: ${error.message}`).catch(() => {});
      }
      this.playNext();
    });
  }

  getCurrentPlayTimeSec() {
    if (!this.playbackStartTime) return 0;
    const now = Date.now();
    let elapsedMs = now - this.playbackStartTime - this.pausedDuration;
    if (this.player.state.status === AudioPlayerStatus.Paused && this.lastPauseTime) {
      elapsedMs -= (now - this.lastPauseTime);
    }
    return Math.max(0, Math.floor(elapsedMs / 1000) * this.speed);
  }

  async playNext() {
    if (this.songs.length === 0) {
      this.currentSong = null;
      this._startLeaveTimer();
      if (this.nowPlayingMessage) {
        this.nowPlayingMessage.delete().catch(() => {});
        this.nowPlayingMessage = null;
      }
      return;
    }

    this._cancelLeaveTimer();
    this.currentSong = this.songs.shift();

    try {
      const { resource, metadata } = await AudioStreamer.createResource(this.currentSong.query || this.currentSong.url, {
        presetKey: this.presetKey,
        speed: this.speed
      });

      this.currentSong.title = metadata.title || this.currentSong.title;
      this.currentSong.duration = metadata.duration || this.currentSong.duration;
      this.currentSong.thumbnail = metadata.thumbnail || this.currentSong.thumbnail;
      this.currentSong.artist = metadata.artist || this.currentSong.artist;

      resource.volume?.setVolume(this.volume / 100);
      this.player.play(resource);
    } catch (err) {
      console.error(`Failed to stream song ${this.currentSong.title}:`, err.message);
      if (this.textChannel) {
        this.textChannel.send(`❌ **곡 재생 실패**: ${this.currentSong.title} (${err.message})`).catch(() => {});
      }
      this.playNext();
    }
  }

  async _updateNowPlayingMessage() {
    if (!this.textChannel || !this.currentSong) return;

    const payload = embedBuilder.buildPlayingEmbed(this.currentSong, {
      isPaused: this.player.state.status === AudioPlayerStatus.Paused,
      loopMode: this.loopMode,
      presetKey: this.presetKey,
      speed: this.speed,
      volume: this.volume,
      currentSec: this.getCurrentPlayTimeSec()
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
            setTimeout(() => msg.delete().catch(() => {}), 10000); // 10초 뒤 삭제
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
    this.songs = [];
    this.currentSong = null;
    this.player.stop();
    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
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
   * 길드별 큐 얻기 또는 생성
   */
  getQueue(guildId) {
    if (!this.queues.has(guildId)) {
      this.queues.set(guildId, new MusicQueue(guildId, this));
    }
    return this.queues.get(guildId);
  }

  /**
   * 음성 채널 연결
   */
  async joinChannel(voiceChannel, textChannel) {
    const queue = this.getQueue(voiceChannel.guild.id);
    queue.textChannel = textChannel;

    if (!queue.connection || queue.connection.state.status === VoiceConnectionStatus.Destroyed) {
      queue.connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true
      });

      // 대기열 플레이어 구독
      queue.connection.subscribe(queue.player);

      // Disconnected 이벤트 처리: 네트워크 흔들림 시 자동 재연결
      queue.connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(queue.connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(queue.connection, VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch (e) {
          queue.destroy();
        }
      });

      // 연결 비동기 승인: ready 대기 중 타임아웃이 나더라도 끊어지지 않았으면 계속 진행
      try {
        await entersState(queue.connection, VoiceConnectionStatus.Ready, 10_000);
      } catch (error) {
        console.warn(`Voice connection state: ${queue.connection.state.status}. Proceeding...`);
        if (queue.connection.state.status === VoiceConnectionStatus.Destroyed) {
          throw new Error('음성 채널 접속에 실패했습니다.');
        }
      }
    }
    return queue;
  }
}

module.exports = new MusicManager();
