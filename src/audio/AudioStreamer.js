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
      // YouTube / SoundCloud URL 정보 가져오기
      if (play.yt_validate(url) === 'video') {
        // play-dl setToken으로 이미 세팅된 환경 쿠키를 basic_info API에 강제 오버라이딩 전달
        const options = {};
        if (process.env.YOUTUBE_COOKIE) {
          options.http_filters = {
            headers: {
              'Cookie': process.env.YOUTUBE_COOKIE,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          };
        }
        const info = await play.video_basic_info(url, options);
        title = info.video_details.title;
        duration = info.video_details.durationInSec;
        thumbnail = info.video_details.thumbnails?.[0]?.url || '';
        artist = info.video_details.channel?.name || 'YouTube';
      } else {
        // 기타 지원 URL (SoundCloud 등)
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

    // 2. 최고 비트레이트 오디오 스트림 추출
    let playStream;
    try {
      playStream = await play.stream(url, {
        quality: 2,
        discordPlayerCompatibility: true,
        htmldata: false
      });
    } catch (err) {
      console.error('play.stream error, fallback using play-dl direct stream:', err.message);
      try {
        const videoInfo = await play.video_basic_info(url);
        const direct = await play.stream_from_info(videoInfo, {
          quality: 2,
          discordPlayerCompatibility: true
        });
        playStream = direct;
      } catch (fallbackErr) {
        // ytdl-core 백업 시도
        try {
          // play-dl에 세팅된 쿠키가 있다면 ytdl-core 헤더에도 동일 전달
          const requestHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          };
          if (process.env.YOUTUBE_COOKIE) {
            requestHeaders['Cookie'] = process.env.YOUTUBE_COOKIE;
          }
          
          const stream = ytdl(url, {
            filter: 'audioonly',
            highWaterMark: 1 << 25,
            quality: 'highestaudio',
            requestOptions: {
              headers: requestHeaders
            }
          });
          playStream = { stream, type: StreamType.Arbitrary };
        } catch (ytdlErr) {
          throw new Error(`유튜브 재생 차단 감지 (Sign in to confirm you're not a bot). 봇 쿠키 활성화 후 다시 요청해 주세요. (${err.message})`);
        }
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
