const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { Shoukaku, Connectors } = require('shoukaku');
const { Kazagumo } = require('kazagumo');
const config = require('./config');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Lavalink 노드 구성 (2026.08 기준 활성 노드)
const Nodes = [
  {
    name: 'Node-1 (Serenetia v4 SSL)',
    url: 'lavalinkv4.serenetia.com:443',
    auth: 'https://dsc.gg/ajidevserver',
    secure: true
  },
  {
    name: 'Node-2 (Serenetia v4 non-SSL)',
    url: 'lavalinkv4.serenetia.com:80',
    auth: 'https://dsc.gg/ajidevserver',
    secure: false
  }
];

// Kazagumo 인스턴스 생성 및 client 바인딩
client.manager = new Kazagumo({
  plugins: [],
  defaultSearchEngine: 'youtube'
}, new Connectors.DiscordJS(client), Nodes);

// Lavalink 이벤트 핸들링
client.manager.shoukaku.on('ready', (name) => console.log(`[Lavalink] 노드 연결됨: ${name}`));
client.manager.shoukaku.on('error', (name, error) => console.error(`[Lavalink] 노드 ${name} 에러:`, error));
client.manager.shoukaku.on('close', (name, code, reason) => console.warn(`[Lavalink] 노드 ${name} 연결 닫힘 (코드: ${code}, 사유: ${reason})`));
client.manager.shoukaku.on('disconnect', (name, players, moved) => console.warn(`[Lavalink] 노드 ${name} 연결 끊김`));

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
