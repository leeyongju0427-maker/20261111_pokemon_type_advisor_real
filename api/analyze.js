// ============================================================
// api/analyze.js — 포켓몬 상성 분석 API 핸들러
// ============================================================
const { validatePokemonName } = require('../lib/validation');
const { calculateTypeMatchups, TYPES } = require('../lib/type-chart');
const { fetchPokemonFromKoreaPokedex } = require('../lib/pokemon-korea-crawler');
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

    // 2. 1순위: 포켓몬 코리아 공식 도감(https://pokemonkorea.co.kr/pokedex) 실시간 조회
    let officialData = null;
    try {
      officialData = await fetchPokemonFromKoreaPokedex(cleanedName);
    } catch (crawlErr) {
      console.warn('[Analyze API] Pokemon Korea crawler error:', crawlErr.message);
    }

    let finalPokemonName = cleanedName;
    let finalTypes = [];
    let officialAbilities = [];
    let officialImage = '';
    let formInfo = '';

    if (officialData && officialData.found && Array.isArray(officialData.types) && officialData.types.length > 0) {
      finalPokemonName = officialData.pokemonName || cleanedName;
      finalTypes = officialData.types.filter(t => TYPES.includes(t));
      officialAbilities = officialData.abilities || [];
      officialImage = officialData.imageUrl || '';
      formInfo = officialData.formName || '';
    }

    // 3. 공식 도감에서 찾지 못한 경우 -> OpenAI 혹은 로컬 폴백 데이터로 보완
    if (finalTypes.length === 0) {
      let aiResult = null;
      try {
        aiResult = await analyzePokemonWithAI(cleanedName);
      } catch (aiErr) {
        console.warn(`[Analyze API] AI lookup failed (${aiErr.message}), checking local fallback...`);
        aiResult = getFallbackPokemon(cleanedName);
      }

      if (!aiResult || !aiResult.found) {
        return res.status(404).json({
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: `"${cleanedName}" 포켓몬을 찾을 수 없습니다. 포켓몬 공식 명칭을 확인해 주세요.`
          }
        });
      }

      finalPokemonName = aiResult.recognizedName || cleanedName;
      finalTypes = Array.isArray(aiResult.types) ? aiResult.types.filter(t => TYPES.includes(t)) : [];
      if (Array.isArray(aiResult.abilityNotes)) {
        officialAbilities = aiResult.abilityNotes;
      }
    }

    if (finalTypes.length === 0) {
      return res.status(422).json({
        ok: false,
        error: {
          code: 'NEEDS_CLARIFICATION',
          message: '포켓몬의 타입을 명확히 판별할 수 없습니다. 폼 또는 정식 명칭을 확인해 주세요.'
        }
      });
    }

    // 4. 엄밀한 타입 상성 배율 계산 (lib/type-chart.js)
    const matchups = calculateTypeMatchups(finalTypes);

    // 5. 공략 팁 및 특성 안내 문구 구성
    let strategyTips = [];
    if (matchups.weaknesses.length > 0) {
      const topWeaknesses = matchups.weaknesses.map(w => `${w.type}(${w.multiplier}배)`).join(', ');
      strategyTips.push(`공략 추천: ${topWeaknesses} 타입 기술로 공격 시 효과가 굉장합니다.`);
    } else {
      strategyTips.push('약점 타입이 없는 단단한 상성 조합입니다. 자속 고위력 기술로 공략하세요.');
    }

    if (matchups.immunities.length > 0) {
      const immTypes = matchups.immunities.map(i => i.type).join(', ');
      strategyTips.push(`주의: ${immTypes} 타입 공격은 전혀 효과가 없습니다 (0배 무효).`);
    }

    let abilityNotes = [];
    if (officialAbilities.length > 0) {
      abilityNotes.push(`공식 도감 특성: ${officialAbilities.join(', ')}`);
      abilityNotes.push('특성에 따라 특정 기술의 효과나 대미지가 무효화·경감될 수 있으니 주의하세요.');
    } else {
      abilityNotes.push('특성에 따른 변수가 있을 수 있으므로 상대의 세부 특성을 확인하세요.');
    }

    // 6. 응답 데이터 반환 (공식 도감 출처 정보 포함)
    const responseData = {
      pokemonName: finalPokemonName + (formInfo ? ` (${formInfo})` : ''),
      types: finalTypes,
      imageUrl: officialImage,
      weaknesses: matchups.weaknesses,
      resistances: matchups.resistances,
      immunities: matchups.immunities,
      strategy: strategyTips,
      abilityNotes: abilityNotes,
      caveat: '포켓몬 공식 도감(pokemonkorea.co.kr/pokedex) 및 공식 게임 상성 기준 데이터입니다.'
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
