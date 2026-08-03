/**
 * lyricsFetcher.js
 * Genius API 기반 가사 검색 모듈
 */

const axios = require('axios');
const config = require('../config');

class LyricsFetcher {
  /**
   * 곡 제목/아티스트로 Genius 가사 URL 또는 요약 가져오기
   * @param {string} title 
   */
  static async searchLyrics(title) {
    const apiKey = config.geniusApiKey;

    if (!apiKey) {
      return {
        title: title,
        geniusUrl: null,
        lyrics: 'GENIUS_API_KEY가 설정되지 않아 가사 URL을 연결할 수 없습니다.'
      };
    }

    try {
      const response = await axios.get('https://api.genius.com/search', {
        params: { q: title },
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      });

      const hits = response.data.response.hits;
      if (!hits || hits.length === 0) {
        return {
          title: title,
          geniusUrl: null,
          lyrics: 'Genius에서 해당하는 가사를 찾지 못했습니다.'
        };
      }

      const song = hits[0].result;
      return {
        title: song.full_title,
        geniusUrl: song.url,
        thumbnail: song.song_art_image_thumbnail_url,
        artist: song.primary_artist?.name || ''
      };
    } catch (err) {
      console.error('LyricsFetcher error:', err.message);
      return {
        title: title,
        geniusUrl: null,
        lyrics: '가사 조회 중 오류가 발생했습니다.'
      };
    }
  }
}

module.exports = LyricsFetcher;
