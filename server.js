// ============================================================
// server.js — 로컬 개발 및 Node.js 실행용 Express 서버
// ============================================================
// Vercel serverless functions(api/*.js)와 public 정적 파일들을
// 로컬 환경에서도 Vercel 환경과 동일하게 동작하도록 라우팅합니다.
// ============================================================
require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 등록: JSON 바디 파싱 및 URL 인코딩 파싱
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 제공 (public 디렉터리: index.html, style.css, app.js 등)
app.use(express.static(path.join(__dirname, 'public')));

// Serverless Handler 연결 (/api/analyze)
const analyzeHandler = require('./api/analyze');
app.all('/api/analyze', async (req, res) => {
  try {
    await analyzeHandler(req, res);
  } catch (err) {
    console.error('[Express analyzeHandler Error]:', err);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: '서버 에러가 발생했습니다.' } });
    }
  }
});

// Serverless Handler 연결 (/api/feedback)
const feedbackHandler = require('./api/feedback');
app.all('/api/feedback', async (req, res) => {
  try {
    await feedbackHandler(req, res);
  } catch (err) {
    console.error('[Express feedbackHandler Error]:', err);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: '서버 에러가 발생했습니다.' } });
    }
  }
});

// 루트 요청 및 기타 정적 페이지
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` 포켓몬 상성 알리미 로컬 서버가 시작되었습니다.`);
  console.log(` 접속 주소: http://localhost:${PORT}`);
  console.log(`===============================================`);
});

