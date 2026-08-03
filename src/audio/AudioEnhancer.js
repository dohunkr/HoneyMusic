/**
 * AudioEnhancer.js
 * FFmpeg 오디오 필터 체인 및 프리셋 관리 클래스
 * 
 * 프리셋 종류:
 * 1. concert (공연장 - 기본값): 라우드니스 정규화, 다이나믹 컴프레션, EQ 보정, 스테레오 확장, 미세 리버브
 * 2. raw (원본): 필터 미적용
 * 3. bassboost (베이스부스트): 저음 대역 극대화
 * 4. clear (선명하게): 보컬 및 고음 대역 선명화
 */

class AudioEnhancer {
  static PRESETS = {
    concert: {
      name: '공연장',
      description: '라이브 공연장 느낌의 입체적이고 꽉 찬 사운드 (기본값)',
      // loudnorm (라우드니스 정규화 I=-14, TP=-1.5, LRA=11)
      // acompressor (피크를 다듬어서 뭉개짐 방지)
      // equalizer (저음 60~120Hz 부스트, 중저음 450Hz 컷, 고음 10kHz 부스트)
      // stereotools (스테레오 폭 살짝 넓히기)
      // aecho (아주 약하게 공간감 리버브 제공)
      filter: 'loudnorm=I=-14:TP=-1.5:LRA=11,acompressor=threshold=-18dB:ratio=3:attack=5:release=50,equalizer=f=80:width_type=h:width=40:g=3.5,equalizer=f=450:width_type=h:width=200:g=-2.5,equalizer=f=10000:width_type=h:width=3000:g=2.5,stereotools=mlev=0.01:slev=1.15,aecho=0.8:0.88:40|60:0.25|0.15'
    },
    raw: {
      name: '원본',
      description: '어떤 오디오 효과도 적용하지 않은 원본 음질',
      filter: null
    },
    bassboost: {
      name: '베이스부스트',
      description: '묵직하고 강력한 저음 강조',
      filter: 'loudnorm=I=-14:TP=-1.5:LRA=11,equalizer=f=60:width_type=h:width=40:g=6.5,equalizer=f=120:width_type=h:width=80:g=4.0,acompressor=threshold=-20dB:ratio=4:attack=5:release=50'
    },
    clear: {
      name: '선명하게',
      description: '보컬과 고음 대역을 맑고 선명하게 강화',
      filter: 'loudnorm=I=-14:TP=-1.5:LRA=11,equalizer=f=3000:width_type=h:width=1000:g=3.5,equalizer=f=12000:width_type=h:width=3000:g=3.0,equalizer=f=200:width_type=h:width=100:g=-2.5'
    }
  };

  /**
   * 지정한 프리셋 키와 배속(speed) 정보에 따라 FFmpeg -filter:a 파라미터 문자열 생성
   * @param {string} presetKey - 'concert' | 'raw' | 'bassboost' | 'clear'
   * @param {number} speed - 재생 속도 (0.5 ~ 2.0)
   * @returns {string|null} FFmpeg filter:a 옵션 값
   */
  static getFilterString(presetKey = 'concert', speed = 1.0) {
    const filters = [];
    const preset = this.PRESETS[presetKey] || this.PRESETS.concert;

    if (preset.filter) {
      filters.push(preset.filter);
    }

    if (speed && speed !== 1.0) {
      // speed 범위 제한: 0.5x ~ 2.0x
      const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));
      filters.push(`atempo=${clampedSpeed}`);
    }

    return filters.length > 0 ? filters.join(',') : null;
  }

  /**
   * 프리셋 이름 반환
   * @param {string} presetKey 
   * @returns {string}
   */
  static getPresetName(presetKey = 'concert') {
    return (this.PRESETS[presetKey] || this.PRESETS.concert).name;
  }
}

module.exports = AudioEnhancer;
