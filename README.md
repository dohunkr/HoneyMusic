# 🍯 HoneyMusic - Discord.js v14 고음질 공연장 오디오 음악 봇

![Node.js](https://img.shields.io/badge/Node.js-LTS-brightgreen)
![Discord.js](https://img.shields.io/badge/Discord.js-v14-blue)
![FFmpeg](https://img.shields.io/badge/Audio-Concert%20Hall%20Enhancer-orange)

> **HoneyMusic**은 Discord.js v14 기반으로 개발된 고음질 음악 봇입니다.
> FFmpeg 기반의 오디오 파이프라인을 통해 **"공연장 사운드"** 오디오 보정(Loudness Normalization, Dynamic Compression, EQ Boost, Reverb & Stereo Width)을 모든 재생에 기본 적용하여 꽉 차고 입체적인 소리를 전달합니다.

---

## ✨ 핵심 주요 기능

1. **🎧 최고 음질 오디오 스트리밍**
   - WebM / Opus 최고 비트레이트 오디오 스트림 자동 감지 및 선택
   - FFmpeg 32MB prefetch 버퍼링으로 지터/끊김 방지
2. **🏛️ "공연장 사운드" 오디오 필터 체인 (`/음보정`)**
   - `loudnorm` (I=-14, TP=-1.5, LRA=11 음량 표준화)
   - `acompressor` (피크 뭉개짐 방지)
   - `equalizer` (저음 60~120Hz & 고음 10~12kHz 부스트, 중저음 450Hz 컷)
   - `stereotools` (입체적 스테레오 폭 확장)
   - `aecho` (미세한 공간 울림)
   - **프리셋 4종 지원**: `공연장` (기본값), `원본 (음보정 끄기)`, `베이스부스트`, `선명하게`
3. **🎵 전용 음악 채널 UI/UX (`/음악채널`)**
   - `/음악채널` 실행 시 `🎵ㆍ음악채널` 자동 생성 및 상단 고정 임베드 배치
   - 명령어 입력 없이 **노래 제목이나 URL 메시지 전송만으로 자동 재생/대기열 추가**
   - 지금 재생 중 인터랙티브 프로그래스 바 & 버튼 컨트롤러 (`⏸ 일시정지`, `▶ 재생`, `⏭ 스킵`, `⏹ 정지`, `🔁 반복`, `🔀 셔플`, `🎚️ 음보정`)
4. **🟢 실시간 popular 차트 연동 (`[🟢 인기차트]` 버튼)**
   - YouTube 채널 [@chartdoong2](https://www.youtube.com/@chartdoong2/videos) 최신 동영상 1개 조회 후 즉시 재생
   - YouTube Data API v3 연동 (매 요청 시 캐싱 없이 실시간 조회)
5. **🎛️ 종합 재생 컨트롤 & 부가기능**
   - 배속 재생 (0.5x ~ 2.0x 지원)
   - 반복 재생 (한 곡 / 전체 / 끄기)
   - Genius API 연동 가사 조회 (`/가사`)
   - 유저 요청곡 히스토리 저장 (`/히스토리`)
   - 무인 상태 또는 대기열 비어있을 시 N분 후 자동 퇴장

---

## 🛠️ 설치 및 실행 방법

### 1. 사전 요구사항
- **Node.js**: v18.0.0 이상 (LTS 권장)
- **FFmpeg**: `ffmpeg-static` 패키지가 포함되어 기본 제공되나, 시스템 환경에 설치되어 있는 FFmpeg도 지원됩니다.

### 2. 패키지 설치
```bash
npm install
```

### 3. 환경 변수 설정
`.env.example` 파일을 복사하여 `.env` 파일을 생성하고 발급받은 API 키 및 토큰을 입력합니다.

```bash
cp .env.example .env
```

`.env` 파일 내용:
```env
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here
YOUTUBE_API_KEY=your_youtube_api_key_here
GENIUS_API_KEY=your_genius_api_key_here
DEFAULT_VOLUME=100
AUTO_LEAVE_COOLDOWN_MINUTES=5
```

### 4. Slash Commands 배포
디스코드 API에 슬래시 명령어를 등록합니다.
```bash
npm run deploy
```

### 5. 봇 실행
```bash
npm start
```

---

## 📋 Slash Commands 목록

| 명령어 | 설명 |
| :--- | :--- |
| `/재생 [검색어/URL]` | 유튜브/사운드클라우드 음원을 접속된 음성 채널에서 재생 |
| `/음보정 [프리셋]` | `공연장` / `원본` / `베이스부스트` / `선명하게` 음보정 필터 전환 |
| `/음악채널` | `🎵ㆍ음악채널` 자동 생성 및 안내 고정 UI 배치 |
| `/컨트롤 [스킵/일시정지/재개/정지/반복/배속/볼륨]` | 오디오 재생 상태 및 옵션 설정 |
| `/큐` | 현재 음악 대기열 목록 조회 |
| `/가사 [곡제목]` | Genius API 기반 가사 URL 및 가사 검색 |
| `/히스토리` | 최근 재생된 곡 기록 확인 |
| `/도움말` | 전체 도움말 임베드 표시 |
