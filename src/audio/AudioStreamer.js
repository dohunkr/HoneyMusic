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
        const info = await play.video_info(url);
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

    // 2. 최고 비트레이트 오디오 스트림 추출 (opus/webm 선호)
    let stream;
    let type = StreamType.Arbitrary;

    try {
      // play-dl 파이프라인 시도
      const playStream = await play.stream(url, {
        quality: 2, // 2: Highest Audio Quality
        discordPlayerCompatibility: false
      });
      stream = playStream.stream;
      type = playStream.type;
    } catch (err) {
      // ytdl-core 백업 파이프라인 시도
      stream = ytdl(url, {
        filter: 'audioonly',
        highWaterMark: 1 << 25, // 32MB prefetch 버퍼링으로 끊김 방지
        quality: 'highestaudio'
      });
    }

    // 3. FFmpeg 음보정 필터 적용 여부 판별
    const filterString = AudioEnhancer.getFilterString(presetKey, speed);

    if (filterString) {
      // FFmpeg 트랜스코딩 트랜스폼 스트림 생성
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

      const pcmStream = stream.pipe(ffmpegStream);
      
      const opusEncoder = new prism.opus.Encoder({
        rate: 48000,
        channels: 2,
        frameSize: 960
      });

      const opusStream = pcmStream.pipe(opusEncoder);

      const resource = createAudioResource(opusStream, {
        inputType: StreamType.Opus,
        inlineVolume: true
      });

      return {
        resource,
        metadata: { url, title, duration, thumbnail, artist }
      };
    } else {
      // 원본 스트림 direct 리소스 생성
      const resource = createAudioResource(stream, {
        inputType: type,
        inlineVolume: true
      });

      return {
        resource,
        metadata: { url, title, duration, thumbnail, artist }
      };
    }
  }
}

module.exports = AudioStreamer;
