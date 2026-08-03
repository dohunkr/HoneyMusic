/**
 * AudioStreamer.js
 * Kazagumo 기반 음악 정보 검색 및 URL 변환 브릿지 클래스
 */

class AudioStreamer {
  /**
   * Kazagumo를 사용해 곡 검색 및 트랙 반환
   * @param {import('kazagumo').Kazagumo} manager 
   * @param {string} query 
   * @param {string} requesterId
   */
  static async searchTracks(manager, query, requesterId) {
    const isUrl = query.startsWith('http://') || query.startsWith('https://');
    
    // youtube 검색어 혹은 URL 검색 진행
    const result = await manager.search(query, { requester: requesterId });
    
    if (!result || !result.tracks || result.tracks.length === 0) {
      throw new Error(`검색 결과를 찾을 수 없습니다: ${query}`);
    }

    const track = result.tracks[0];

    return {
      track,
      metadata: {
        url: track.uri,
        title: track.title,
        duration: Math.floor(track.length / 1000),
        thumbnail: track.thumbnail || '',
        artist: track.author || '알 수 없음'
      }
    };
  }
}

module.exports = AudioStreamer;
