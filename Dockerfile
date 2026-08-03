# Node.js LTS 기반 이미지
FROM node:20-slim

# FFmpeg 설치 (공연장 사운드 오디오 필터 체인용)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    build-essential \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 작업 디렉토리 설정
WORKDIR /app

# 의존성 먼저 복사 (Docker 캐싱 최적화)
COPY package*.json ./

# 프로덕션 의존성만 설치
RUN npm install --omit=dev

# 소스 코드 복사
COPY . .

# 포트 노출 (Railway 헬스체크용 HTTP 서버 포트)
EXPOSE 3000

# 봇 실행
CMD ["node", "src/index.js"]
