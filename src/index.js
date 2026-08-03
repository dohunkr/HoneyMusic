const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config = require('./config');

// ytdl-core 업데이트 체크 경고 제거
process.env.YTDL_NO_UPDATE = 'true';

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

// play-dl에 유튜브 쿠키 정보 설정 (봇 차단 완벽 우회)
const play = require('play-dl');
if (process.env.YOUTUBE_COOKIE) {
  try {
    // 세션 정보 주입
    play.setToken({
      youtube: {
        cookie: process.env.YOUTUBE_COOKIE
      }
    });
    console.log('🔑 유튜브 쿠키 토큰 세팅 완료!');
  } catch (err) {
    console.error('❌ 유튜브 쿠키 토큰 세팅 실패:', err.message);
  }
} else {
  console.log('ℹ️ YOUTUBE_COOKIE 환경변수가 없습니다.');
}

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
