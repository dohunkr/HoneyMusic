module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`========================================`);
    console.log(`🍯 HoneyMusic 봇 준비 완료!`);
    console.log(`로그인 계정: ${client.user.tag}`);
    console.log(`서버(길드) 수: ${client.guilds.cache.size}`);
    console.log(`========================================`);

    client.user.setActivity('🎵 라이브 공연장 사운드 오디오', { type: 2 });
  }
};
