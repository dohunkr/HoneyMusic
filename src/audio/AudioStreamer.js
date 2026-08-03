/**
 * AudioStreamer.js
 * play-dl 및 @distube/ytdl-core 기반 오디오 스트림 추출 & FFmpeg 처리 파이프라인
 */

const play = require('play-dl');
const ytdl = require('@distube/ytdl-core');
const prism = require('prism-media');
// Railway/Docker: 시스템 ffmpeg 우선 (index.js에서 FFMPEG_PATH 설정됨)
const ffmpegPath = process.env.FFMPEG_PATH || require('ffmpeg-static');
const AudioEnhancer = require('./AudioEnhancer');
const { createAudioResource, StreamType } = require('@discordjs/voice');

class AudioStreamer {
  /**
   * 키워드 또는 URL로 오디오 정보 및 최고 음질 스트림 추출
   * @param {string} query 
   * @param {object} options { presetKey: string, speed: number }
   */
  static async createResource(query, options = {}) {
    const { presetKey = 'concert', speed = 1.0 } = options;
    let url = query;
    let title = '알 수 없는 곡';
    let duration = 0;
    let thumbnail = '';
    let artist = '알 수 없음';

    // 1. URL 감지 및 메타데이터 검색
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
    } else {
      // URL로 직접 넘어온 경우: 메타데이터 재조회 없이 바로 스트리밍
      // (messageCreate.js / play.js에서 이미 search()로 메타데이터 확보완료)
      // SoundCloud URL 예외 처리
      if (!play.yt_validate(url)) {
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
    }

    // 2. 오디오 스트림 추출
    let playStream;

    if (process.env.YOUTUBE_COOKIE && play.yt_validate(url) !== false) {
      // 쿠키 있을 때: ytdl-core로 직접 스트리밍 (봇 감지 완벽 우회)
      try {
        const agent = ytdl.createAgent(undefined, {
          headers: {
            'Cookie': process.env.YOUTUBE_COOKIE,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        const stream = ytdl(url, {
          filter: 'audioonly',
          highWaterMark: 1 << 25,
          quality: 'highestaudio',
          agent
        });
        playStream = { stream, type: StreamType.Arbitrary };
        console.log('✅ ytdl-core (쿠키 적용) 스트리밍 시작');
      } catch (err) {
        console.error('ytdl-core 쿠키 스트리밍 실패, 헤더 방식으로 재시도:', err.message);
        const stream = ytdl(url, {
          filter: 'audioonly',
          highWaterMark: 1 << 25,
          quality: 'highestaudio',
          requestOptions: {
            headers: {
              'Cookie': process.env.YOUTUBE_COOKIE,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          }
        });
        playStream = { stream, type: StreamType.Arbitrary };
      }
    } else {
      // 쿠키 없을 때: play-dl 시도
      try {
        playStream = await play.stream(url, {
          quality: 2,
          discordPlayerCompatibility: true
        });
      } catch (err) {
        console.error('play.stream 실패, ytdl-core 헤더 방식 시도:', err.message);
        const stream = ytdl(url, {
          filter: 'audioonly',
          highWaterMark: 1 << 25,
          quality: 'highestaudio',
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          }
        });
        playStream = { stream, type: StreamType.Arbitrary };
      }
    }

    // 3. FFmpeg 음보정 필터 적용
    const filterString = AudioEnhancer.getFilterString(presetKey, speed);

    if (filterString) {
      try {
        const args = [
          '-analyzeduration', '0',
          '-loglevel', '0',
          '-f', 's16le',
          '-ar', '48000',
          '-ac', '2',
          '-af', filterString
        ];

        const ffmpegStream = new prism.FFmpeg({
          binary: ffmpegPath,
          args: args
        });

        const pcmStream = playStream.stream.pipe(ffmpegStream);

        const resource = createAudioResource(pcmStream, {
          inputType: StreamType.Raw,
          inlineVolume: true
        });

        return {
          resource,
          metadata: { url, title, duration, thumbnail, artist }
        };
      } catch (e) {
        console.error('FFmpeg filter pipe error, fallback to direct stream:', e);
      }
    }

    // Direct Stream
    const resource = createAudioResource(playStream.stream, {
      inputType: playStream.type,
      inlineVolume: true
    });

    return {
      resource,
      metadata: { url, title, duration, thumbnail, artist }
    };
  }
}

module.exports = AudioStreamer;
