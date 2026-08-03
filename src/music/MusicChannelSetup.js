/**
 * MusicChannelSetup.js
 * 전용 텍스트 채널 (🎵ㆍ음악채널) 자동 생성 및 관리 모듈
 */

const { ChannelType, PermissionFlagsBits } = require('discord.js');
const embedBuilder = require('../utils/embedBuilder');

class MusicChannelSetup {
  static CHANNEL_NAME = '🎵ㆍ음악채널';

  /**
   * 길드에 전용 음악 채널을 생성하고 고정 상단 안내 메시지 배치
   * @param {import('discord.js').Guild} guild 
   */
  static async setupChannel(guild) {
    // 1. 기존 음악 채널이 존재하는지 확인
    let channel = guild.channels.cache.find(
      (ch) => ch.name === this.CHANNEL_NAME && ch.type === ChannelType.GuildText
    );

    // 2. 존재하지 않는다면 신규 채널 생성
    if (!channel) {
      channel = await guild.channels.create({
        name: this.CHANNEL_NAME,
        type: ChannelType.GuildText,
        topic: '🍯 HoneyMusic 전용 음악 채널 - 이곳에 노래 제목이나 URL을 입력하세요!',
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
          }
        ]
      });
    }

    // 3. 기존 상단 고정 메시지 초기화 및 최신 고정 헤더 메시지 전송
    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
    if (messages && messages.size > 0) {
      await channel.bulkDelete(messages).catch(() => {});
    }

    const headerPayload = embedBuilder.buildChannelHeaderEmbed(
      guild.name,
      guild.client.user.displayAvatarURL()
    );

    const headerMsg = await channel.send(headerPayload);
    await headerMsg.pin().catch(() => {});

    return channel;
  }
}

module.exports = MusicChannelSetup;
