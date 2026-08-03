const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const config = require('../config');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`========================================`);
    console.log(`🍯 HoneyMusic 봇 준비 완료!`);
    console.log(`로그인 계정: ${client.user.tag}`);
    console.log(`서버(길드) 수: ${client.guilds.cache.size}`);
    console.log(`========================================`);

    client.user.setActivity('🎵 라이브 공연장 사운드 오디오', { type: 2 });

    // Kazagumo 플레이어의 다음 트랙 자동 재생 시 메타데이터 갱신 리스너 등록
    client.manager.on('playerStart', (player, track) => {
      const musicManager = require('../music/MusicManager');
      const queue = musicManager.getQueue(player.guildId);
      if (queue) {
        queue._cancelLeaveTimer();
        const songItem = {
          query: track.uri,
          title: track.title,
          url: track.uri,
          requestedBy: track.requester?.id || client.user.id,
          duration: Math.floor(track.length / 1000),
          thumbnail: track.thumbnail || '',
          artist: track.author || '알 수 없음',
          trackData: track
        };
        player.data.set('currentSong', songItem);
        queue.applyFilters(); // 음원 세션 준비가 완료된 시작점에 실시간 필터 안전 적용
        queue._updateNowPlayingMessage();
      }
    });

    client.manager.on('playerEnd', (player) => {
      const musicManager = require('../music/MusicManager');
      const queue = musicManager.getQueue(player.guildId);
      if (queue) {
        if (player.queue.length === 0) {
          queue._startLeaveTimer();
        }
        queue._updateNowPlayingMessage();
      }
    });

    client.manager.on('playerClosed', (player) => {
      const musicManager = require('../music/MusicManager');
      const queue = musicManager.getQueue(player.guildId);
      if (queue && queue.player) {
        // 이미 닫힌 채널의 player 참조를 null로 설정하여 중복 destroy() 400 에러 차단
        queue.player = null; 
        queue.destroy();
      }
    });

    client.manager.on('playerException', (player, err) => {
      console.error(`[Lavalink Error] Guild ${player.guildId}:`, err);
      // 400 Bad Request 등 단순 API 예외는 크래시 나지 않게 차단
      if (err.message && err.message.includes('400')) return;
      
      const musicManager = require('../music/MusicManager');
      const queue = musicManager.getQueue(player.guildId);
      if (queue && queue.textChannel) {
        queue.textChannel.send(`⚠️ **재생 중 오류 발생**: ${err.message || 'Lavalink decode error'}`).catch(() => {});
      }
    });

    // 봇 구동 시 Slash Commands 자동 등록/배포
    if (config.token && config.clientId) {
      try {
        const commands = [];
        const commandsPath = path.join(__dirname, '../commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
          const command = require(path.join(commandsPath, file));
          if ('data' in command) {
            commands.push(command.data.toJSON());
          }
        }

        const rest = new REST({ version: '10' }).setToken(config.token);
        console.log(`🚀 ${commands.length}개의 Slash Command 동기화를 시작합니다...`);

        await rest.put(
          Routes.applicationCommands(config.clientId),
          { body: commands }
        );

        console.log(`✅ Slash Commands 동기화 성공!`);
      } catch (err) {
        console.error(`❌ Slash Command 동기화 에러:`, err.message);
      }
    }
  }
};
