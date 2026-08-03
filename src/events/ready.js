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
