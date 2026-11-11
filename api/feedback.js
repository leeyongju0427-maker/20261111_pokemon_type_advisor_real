// ============================================================
// api/feedback.js — 익명 피드백 등록 및 목록 조회 API 핸들러
// ============================================================
const { validateFeedback } = require('../lib/validation');
const { getSupabaseClient } = require('../lib/supabase');

module.exports = async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getSupabaseClient();

  // ──────────────────────────────────────────────
  // 1. GET: 피드백 목록 조회 (최신순)
  // ──────────────────────────────────────────────
  if (req.method === 'GET') {
    if (!supabase) {
      return res.status(503).json({
        ok: false,
        error: {
          code: 'DB_UNAVAILABLE',
          message: '데이터베이스 연결 설정이 준비되지 않았습니다.'
        }
      });
    }

    try {
      // 쿼리 파라미터 limit (기본 20개, 최대 50개)
      const limit = Math.min(parseInt(req.query?.limit, 10) || 20, 50);

      const { data, error } = await supabase
        .from('feedback')
        .select('id, display_name, content, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[Feedback GET DB Error]:', error);
        return res.status(500).json({
          ok: false,
          error: {
            code: 'DB_UNAVAILABLE',
            message: '피드백 목록을 불러오지 못했습니다.'
          }
        });
      }

      return res.status(200).json({
        ok: true,
        data: data || []
      });

    } catch (err) {
      console.error('[Feedback GET Exception]:', err);
      return res.status(500).json({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '서버 내부 오류가 발생했습니다.'
        }
      });
    }
  }

  // ──────────────────────────────────────────────
  // 2. POST: 피드백 신규 작성
  // ──────────────────────────────────────────────
  if (req.method === 'POST') {
    if (!supabase) {
      return res.status(503).json({
        ok: false,
        error: {
          code: 'DB_UNAVAILABLE',
          message: '데이터베이스 연결 설정이 준비되지 않았습니다.'
        }
      });
    }

    try {
      const body = req.body || {};
      const author = body.displayName || body.author;
      const content = body.content;

      // 입력값 검증
      const validation = validateFeedback(author, content);
      if (!validation.isValid) {
        return res.status(400).json({
          ok: false,
          error: {
            code: validation.errorCode,
            message: validation.message
          }
        });
      }

      // Supabase 테이블에 저장
      const { data, error } = await supabase
        .from('feedback')
        .insert([
          {
            display_name: validation.cleanedAuthor,
            content: validation.cleanedContent
          }
        ])
        .select('id')
        .single();

      if (error) {
        console.error('[Feedback POST DB Error]:', error);
        return res.status(500).json({
          ok: false,
          error: {
            code: 'DB_UNAVAILABLE',
            message: '피드백 저장 중 오류가 발생했습니다.'
          }
        });
      }

      return res.status(201).json({
        ok: true,
        data: {
          id: data?.id
        }
      });

    } catch (err) {
      console.error('[Feedback POST Exception]:', err);
      return res.status(500).json({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '서버 내부 오류가 발생했습니다.'
        }
      });
    }
  }

  // 지원하지 않는 메소드
  return res.status(405).json({
    ok: false,
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: '지원하지 않는 HTTP 메소드입니다.'
    }
  });
};
