const musicManager = require('../music/MusicManager');
const MusicChannelSetup = require('../music/MusicChannelSetup');
const ChartChannelFetcher = require('../music/ChartChannelFetcher');
const embedBuilder = require('../utils/embedBuilder');
const AudioEnhancer = require('../audio/AudioEnhancer');
const AudioStreamer = require('../audio/AudioStreamer');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // 1. Slash Commands 처리
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        const replyPayload = { content: `⚠️ 명령어 실행 중 오류 발생: ${error.message}`, ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(replyPayload).catch(() => {});
        } else {
          await interaction.reply(replyPayload).catch(() => {});
        }
      }
      return;
    }

    // 2. Select Menu (드롭다운) 처리
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'select_preset') {
        const selectedPreset = interaction.values[0];
        const queue = musicManager.getQueue(interaction.guild.id);
        if (!queue) {
          return interaction.reply({ content: '❌ 활성화된 음악 큐가 없습니다.', ephemeral: true });
        }

        queue.presetKey = selectedPreset;
        queue.applyFilters(); // 필터 적용
        await interaction.reply({
          content: `🎚️ **음보정 프리셋이 [ ${AudioEnhancer.getPresetName(selectedPreset)} ](으)로 변경되었습니다.**`,
          ephemeral: true
        });

        queue._updateNowPlayingMessage();
      }

      if (interaction.customId === 'select_speed') {
        const speedVal = parseFloat(interaction.values[0]);
        const queue = musicManager.getQueue(interaction.guild.id);
        if (!queue) {
          return interaction.reply({ content: '❌ 활성화된 음악 큐가 없습니다.', ephemeral: true });
        }

        queue.speed = speedVal;
        queue.applyFilters(); // 필터 적용
        await interaction.reply({
          content: `⏩ **재생 속도가 [ ${speedVal}x ] 로 설정되었습니다. (음보정 필터가 갱신되었습니다)**`,
          ephemeral: true
        });

        queue._updateNowPlayingMessage();
      }
      return;
    }

    // 3. Button Interaction 처리
    if (interaction.isButton()) {
      const customId = interaction.customId;
      const voiceChannel = interaction.member?.voice?.channel;
      const queue = musicManager.getQueue(interaction.guild.id);

      // A. 인기차트 버튼 [🟢 인기차트]
      if (customId === 'btn_chart') {
        if (!voiceChannel) {
          return interaction.reply({ content: '❌ 먼저 음성 채널에 입점해 주세요!', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });
        try {
          const latestVideo = await ChartChannelFetcher.getLatestVideo();
          const targetQueue = await musicManager.joinChannel(voiceChannel, interaction.channel);

          const { track, metadata } = await AudioStreamer.searchTracks(interaction.client.manager, latestVideo.url, interaction.user.id);

          const songItem = {
            query: metadata.url,
            title: metadata.title,
            url: metadata.url,
            thumbnail: metadata.thumbnail,
            requestedBy: interaction.user.id,
            duration: metadata.duration,
            artist: metadata.artist,
            trackData: track
          };

          targetQueue.player.queue.add(track);

          if (!targetQueue.player.playing && !targetQueue.player.paused) {
            targetQueue.player.data.set('currentSong', songItem);
            await targetQueue.player.play();
            await interaction.editReply(`🟢 **[인기차트 최신영상] 재생을 시작합니다**: [${metadata.title}](${metadata.url})`);
          } else {
            await interaction.editReply(`🟢 **[인기차트 최신영상] 대기열에 추가되었습니다** (${targetQueue.player.queue.length}번째): [${metadata.title}](${metadata.url})`);
          }
        } catch (err) {
          await interaction.editReply(`❌ **인기차트 불러오기 실패**: ${err.message}`);
        }
        return;
      }

      // B. 최근 히스토리 [🎫 최근]
      if (customId === 'btn_history') {
        const historyCmd = interaction.client.commands.get('히스토리');
        if (historyCmd) return historyCmd.execute(interaction);
      }

      // C. 명령어 보기 [📋 명령어 보기]
      if (customId === 'btn_help') {
        const helpCmd = interaction.client.commands.get('도움말');
        if (helpCmd) return helpCmd.execute(interaction);
      }

      // D. 가사 보기 [🎵 가사 보기]
      if (customId === 'btn_lyrics') {
        const lyricsCmd = interaction.client.commands.get('가사');
        if (lyricsCmd) return lyricsCmd.execute(interaction);
      }

      // E. 음악 검색하기 [🔍 음악 검색하기]
      if (customId === 'btn_search') {
        return interaction.reply({
          content: '🔍 이 음악 채널에 원하시는 노래 제목이나 유튜브 URL을 메시지로 자유롭게 입력해 주세요!',
          ephemeral: true
        });
      }

      // F. 음보정 프리셋 변경 드롭다운 표시 [🎚️ 음보정]
      if (customId === 'btn_preset_menu') {
        const selectMenuRow = embedBuilder.buildPresetSelectMenu();
        return interaction.reply({
          content: '🎚️ 원하시는 오디오 보정 프리셋을 선택해 주세요:',
          components: [selectMenuRow],
          ephemeral: true
        });
      }

      // F-2. 배속 선택 드롭다운 표시 [⏩ 배속 변경]
      if (customId === 'btn_speed_menu') {
        const selectMenuRow = embedBuilder.buildSpeedSelectMenu();
        return interaction.reply({
          content: '⏩ 원하는 재생 속도(배속)를 선택해 주세요:',
          components: [selectMenuRow],
          ephemeral: true
        });
      }

      // G. 재생 컨트롤 버튼들 (⏯️/⏸/▶/⏭/⏹/🔁/🔀/📜)
      if (!queue || !queue.player) {
        return interaction.reply({ content: '❌ 현재 실행 중인 음악 큐가 없습니다.', ephemeral: true });
      }

      if (customId === 'btn_toggle_play') {
        if (queue.player.paused) {
          queue.player.pause(false); // 재개
          queue._updateNowPlayingMessage();
          return interaction.reply({ content: '▶ **재생이 재개되었습니다.**', ephemeral: true });
        } else {
          queue.player.pause(true); // 일시정지
          queue._updateNowPlayingMessage();
          return interaction.reply({ content: '⏸ **재생을 일시정지했습니다.**', ephemeral: true });
        }
      }

      if (customId === 'btn_pause') {
        queue.player.pause(true);
        queue._updateNowPlayingMessage();
        return interaction.reply({ content: '⏸ **일시정지되었습니다.**', ephemeral: true });
      }

      if (customId === 'btn_resume') {
        queue.player.pause(false);
        queue._updateNowPlayingMessage();
        return interaction.reply({ content: '▶ **재생이 재개되었습니다.**', ephemeral: true });
      }

      if (customId === 'btn_skip') {
        queue.player.skip();
        return interaction.reply({ content: '⏭ **현재 곡을 스킵했습니다.**', ephemeral: true });
      }

      if (customId === 'btn_stop') {
        queue.destroy();
        return interaction.reply({ content: '⏹ **재생을 정지하고 퇴장했습니다.**', ephemeral: true });
      }

      if (customId === 'btn_loop') {
        const nextLoop = queue.loopMode === 'off' ? 'track' : queue.loopMode === 'track' ? 'queue' : 'off';
        queue.loopMode = nextLoop;
        queue.player.setLoop(nextLoop === 'off' ? 'none' : nextLoop);
        queue._updateNowPlayingMessage();
        return interaction.reply({ content: `🔁 **반복 모드가 [ ${nextLoop} ](으)로 설정되었습니다.**`, ephemeral: true });
      }

      if (customId === 'btn_shuffle') {
        queue.player.queue.shuffle();
        return interaction.reply({ content: '🔀 **대기열이 셔플되었습니다.**', ephemeral: true });
      }

      if (customId === 'btn_queue') {
        const queueCmd = interaction.client.commands.get('큐');
        if (queueCmd) return queueCmd.execute(interaction);
      }
    }
  }
};
