// ============================================================
// api/analyze.js — 포켓몬 상성 분석 API 핸들러
// ============================================================
const { validatePokemonName } = require('../lib/validation');
const { calculateTypeMatchups, TYPES } = require('../lib/type-chart');
const { analyzePokemonWithAI } = require('../lib/openai');
const { getFallbackPokemon } = require('../lib/pokemon-fallback-data');

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

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'POST 메소드만 지원합니다.'
      }
    });
  }

  try {
    const body = req.body || {};
    const rawName = body.pokemonName || body.name;

    // 1. 입력값 검증
    const validation = validatePokemonName(rawName);
    if (!validation.isValid) {
      return res.status(400).json({
        ok: false,
        error: {
          code: validation.errorCode,
          message: validation.message
        }
      });
    }

    const cleanedName = validation.cleanedName;

    // 2. 포켓몬 분석 정보 획득 (OpenAI 시도 -> 실패 시 폴백 데이터셋 사용)
    let aiResult = null;
    let fallbackUsed = false;

    try {
      aiResult = await analyzePokemonWithAI(cleanedName);
    } catch (aiErr) {
      console.warn(`[Analyze API] OpenAI 연동 실패 (${aiErr.message}), 로컬 폴백 데이터 확인 중...`);
      const fallback = getFallbackPokemon(cleanedName);
      if (fallback) {
        aiResult = fallback;
        fallbackUsed = true;
      } else {
        return res.status(503).json({
          ok: false,
          error: {
            code: 'AI_UNAVAILABLE',
            message: 'OpenAI API 키가 유효하지 않거나 일시적 오류가 발생했습니다. .env의 OPENAI_API_KEY를 확인해 주세요.'
          }
        });
      }
    }

    if (!aiResult || !aiResult.found) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: aiResult?.message || `"${cleanedName}" 포켓몬을 찾을 수 없습니다. 정확한 이름을 입력해 주세요.`
        }
      });
    }

    // 3. 타입 데이터 검증
    const recognizedTypes = Array.isArray(aiResult.types)
      ? aiResult.types.filter(t => TYPES.includes(t))
      : [];

    if (recognizedTypes.length === 0) {
      return res.status(422).json({
        ok: false,
        error: {
          code: 'NEEDS_CLARIFICATION',
          message: '포켓몬의 타입을 명확히 판별할 수 없습니다. 폼 또는 정식 명칭을 확인해 주세요.'
        }
      });
    }

    // 4. 엄밀한 타입 상성 배율 계산 (lib/type-chart.js)
    const matchups = calculateTypeMatchups(recognizedTypes);

    // 5. 응답 데이터 반환
    const responseData = {
      pokemonName: aiResult.recognizedName || cleanedName,
      types: recognizedTypes,
      weaknesses: matchups.weaknesses,
      resistances: matchups.resistances,
      immunities: matchups.immunities,
      strategy: aiResult.strategy || ['상대 약점 타입을 적극 활용하세요.'],
      abilityNotes: aiResult.abilityNotes || [],
      caveat: aiResult.caveat || '게임 버전과 폼에 따라 차이가 있을 수 있습니다.'
    };

    return res.status(200).json({
      ok: true,
      data: responseData
    });

  } catch (error) {
    console.error('[Analyze API Internal Error]:', error);
    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
      }
    });
  }
};
