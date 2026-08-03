const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config = require('./config');

// Railway/Docker 환경: 시스템 FFmpeg 사용 (Dockerfile에서 apt-get으로 설치)
// ffmpeg-static은 fallback으로만 사용
if (!process.env.FFMPEG_PATH) {
  try {
    // 시스템 ffmpeg 우선 사용
    const { execSync } = require('child_process');
    execSync('ffmpeg -version', { stdio: 'ignore' });
    process.env.FFMPEG_PATH = 'ffmpeg';
  } catch {
    // 시스템 ffmpeg 없으면 ffmpeg-static 사용
    process.env.FFMPEG_PATH = require('ffmpeg-static');
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

// 1. 명령어 모듈 바인딩
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    }
  }
}

// 2. 이벤트 모듈 바인딩
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
}

// Uncaught exception 방어
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

if (!config.token) {
  console.error('❌ DISCORD_TOKEN이 .env 파일에 설정되지 않았습니다.');
  process.exit(1);
}

client.login(config.token);

// Railway 헬스체크용 경량 HTTP 서버
// Railway는 포트에 HTTP 응답이 없으면 컨테이너를 비정상으로 판단함
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  if (req.url === '/health') {
    const status = client.isReady() ? 200 : 503;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: client.isReady() ? 'ok' : 'starting',
      bot: client.user?.tag || 'not ready',
      uptime: process.uptime()
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('🍯 HoneyMusic is running!');
  }
}).listen(PORT, () => {
  console.log(`🌐 Health check server running on port ${PORT}`);
});
