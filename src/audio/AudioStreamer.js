/**
 * AudioStreamer.js
 * @distube/ytdl-core + FFmpeg spawn 기반 오디오 스트림 추출 파이프라인
 */

const play = require('play-dl');
const ytdl = require('@distube/ytdl-core');
const { spawn } = require('child_process');
const AudioEnhancer = require('./AudioEnhancer');
const { createAudioResource, StreamType } = require('@discordjs/voice');

const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';

class AudioStreamer {
  /**
   * URL 또는 검색어로 오디오 리소스 생성
   * @param {string} query - YouTube URL 또는 검색어
   * @param {object} options - { presetKey, speed }
   */
  static async createResource(query, options = {}) {
    const { presetKey = 'concert', speed = 1.0 } = options;
    let url = query;
    let title = '알 수 없는 곡';
    let duration = 0;
    let thumbnail = '';
    let artist = '알 수 없음';

    // 1. URL이 아닌 경우 YouTube 검색
    const isUrl = query.startsWith('http://') || query.startsWith('https://');

    if (!isUrl) {
      const searchResult = await play.search(query, { limit: 1 });
      if (!searchResult || searchResult.length === 0) {
        throw new Error(`검색 결과를 찾을 수 없습니다: ${query}`);
      }
      url = searchResult[0].url;
      title = searchResult[0].title;
      duration = searchResult[0].durationInSec;
      thumbnail = searchResult[0].thumbnails?.[0]?.url || '';
      artist = searchResult[0].channel?.name || 'YouTube';
    } else if (!play.yt_validate(url)) {
      // SoundCloud 등 기타 URL 메타데이터
      try {
        const info = await play.soundcloud(url);
        title = info.name || title;
        duration = Math.floor((info.durationInMs || 0) / 1000);
        thumbnail = info.thumbnail || '';
        artist = info.user?.name || 'SoundCloud';
      } catch (e) {
        title = url;
      }
    }

    // 2. youtubei.js(Innertube)로 오디오 스트림 추출 (쿠키 적용)
    const { Innertube } = require('youtubei.js');
    let rawStream;
    try {
      const innertubeOptions = {
        // ANDROID_MUSIC은 현재 v1/player 400 Bad Request 오류를 유발할 수 있으므로 기본 WEB/WEB_EMBEDDED 구조를 사용하여 쿠키 정합성을 높입니다.
        client_type: 'WEB'
      };
      if (process.env.YOUTUBE_COOKIE) {
        innertubeOptions.cookie = process.env.YOUTUBE_COOKIE;
      }
      
      const youtube = await Innertube.create(innertubeOptions);
      // URL에서 Video ID 추출
      let videoId = url;
      if (url.includes('v=')) {
        videoId = url.split('v=')[1].split('&')[0];
      } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split('?')[0];
      }

      console.log(`[AudioStreamer] youtubei.js 스트리밍 시작 (Video ID: ${videoId})`);
      const stream = await youtube.download(videoId, {
        type: 'audio',
        quality: 'best',
        format: 'any'
      });

      // youtubei.js는 Web API ReadableStream을 반환할 수 있으므로, node stream으로 변환해줍니다.
      const { Readable } = require('stream');
      rawStream = Readable.from(stream);
      console.log('[AudioStreamer] youtubei.js 스트림 노드 변환 성공');
    } catch (e) {
      console.error('[AudioStreamer] youtubei.js 스트리밍 실패, ytdl-core 폴백 시도:', e.message);
      // ytdl-core 폴백
      const cookieHeader = process.env.YOUTUBE_COOKIE;
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
      const reqHeaders = { 'User-Agent': userAgent };
      if (cookieHeader) reqHeaders['Cookie'] = cookieHeader;

      rawStream = ytdl(url, {
        filter: 'audioonly',
        highWaterMark: 1 << 25,
        quality: 'highestaudio',
        dlChunkSize: 0,
        requestOptions: { headers: reqHeaders }
      });
    }

    // 3. FFmpeg spawn으로 트랜스코딩 + 음보정 필터 적용
    // pipe:0 (stdin) → FFmpeg → pipe:1 (stdout) → discord
    const filterString = AudioEnhancer.getFilterString(presetKey, speed);

    const ffmpegArgs = [
      '-i', 'pipe:0',        // stdin에서 입력 받기
      '-analyzeduration', '0',
      '-loglevel', 'error',
      '-vn',                  // 비디오 스트림 제거
      '-ar', '48000',         // 샘플레이트 48kHz (Discord 요구사항)
      '-ac', '2',             // 스테레오
      '-f', 's16le'           // PCM 16비트 little endian 출력
    ];

    if (filterString) {
      ffmpegArgs.push('-af', filterString);
    }

    ffmpegArgs.push('pipe:1'); // stdout으로 출력

    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // ytdl 스트림 → FFmpeg stdin
    rawStream.pipe(ffmpegProcess.stdin);

    // 에러 처리
    rawStream.on('error', err => {
      console.error('[ytdl] 스트림 에러:', err.message);
      if (!ffmpegProcess.stdin.destroyed) ffmpegProcess.stdin.destroy();
    });

    ffmpegProcess.stdin.on('error', () => {}); // EPIPE 등 파이프 에러 무시

    ffmpegProcess.stderr.on('data', data => {
      const msg = data.toString().trim();
      if (msg && !msg.includes('size=') && !msg.includes('time=') && !msg.includes('frame=')) {
        console.error('[FFmpeg]', msg);
      }
    });

    ffmpegProcess.on('error', err => {
      console.error('[FFmpeg] 프로세스 에러:', err.message);
    });

    // FFmpeg stdout (PCM) → Discord audio resource
    const resource = createAudioResource(ffmpegProcess.stdout, {
      inputType: StreamType.Raw,
      inlineVolume: true
    });

    return {
      resource,
      metadata: { url, title, duration, thumbnail, artist }
    };
  }
}

module.exports = AudioStreamer;
