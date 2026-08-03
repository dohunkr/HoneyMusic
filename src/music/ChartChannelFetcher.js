/**
 * ChartChannelFetcher.js
 * YouTube Data API v3 기반 @chartdoong2 채널 최신 업로드 영상 조회 모듈
 */

const axios = require('axios');
const config = require('../config');

class ChartChannelFetcher {
  /**
   * @chartdoong2 채널의 가장 최근에 업로드된 영상 1개의 URL 및 메타데이터 가져오기
   * 매 호출 시 캐싱 없이 실시간 조회
   */
  static async getLatestVideo() {
    const apiKey = config.youtubeApiKey;

    if (!apiKey) {
      throw new Error('YOUTUBE_API_KEY가 설정되지 않았습니다. .env 파일을 확인해 주세요.');
    }

    try {
      // 1. 핸들(@chartdoong2)로 채널 ID 조회
      const channelRes = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
        params: {
          part: 'contentDetails',
          forHandle: 'chartdoong2',
          key: apiKey
        }
      });

      let uploadsPlaylistId = null;

      if (channelRes.data.items && channelRes.data.items.length > 0) {
        uploadsPlaylistId = channelRes.data.items[0].contentDetails.relatedPlaylists.uploads;
      }

      if (uploadsPlaylistId) {
        // 2. Uploads 플레이리스트에서 최신 영상 1개 조회
        const playlistRes = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
          params: {
            part: 'snippet',
            playlistId: uploadsPlaylistId,
            maxResults: 1,
            key: apiKey
          }
        });

        if (playlistRes.data.items && playlistRes.data.items.length > 0) {
          const item = playlistRes.data.items[0].snippet;
          return {
            title: item.title,
            url: `https://www.youtube.com/watch?v=${item.resourceId.videoId}`,
            thumbnail: item.thumbnails?.high?.url || item.thumbnails?.default?.url || '',
            channelTitle: item.channelTitle || '둥둥이 인기차트'
          };
        }
      }

      // 3. 핸들 검색 실패 시 fallback: search.list로 채널 영상 검색 (order=date)
      const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q: 'chartdoong2',
          type: 'video',
          order: 'date',
          maxResults: 1,
          key: apiKey
        }
      });

      if (searchRes.data.items && searchRes.data.items.length > 0) {
        const item = searchRes.data.items[0];
        return {
          title: item.snippet.title,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
          thumbnail: item.snippet.thumbnails?.high?.url || '',
          channelTitle: item.snippet.channelTitle || '둥둥이 인기차트'
        };
      }

      throw new Error('최신 영상을 찾을 수 없습니다.');
    } catch (err) {
      console.error('ChartChannelFetcher Error:', err.response?.data || err.message);
      throw new Error(`인기차트 영상 조회 실패: ${err.message}`);
    }
  }
}

module.exports = ChartChannelFetcher;
