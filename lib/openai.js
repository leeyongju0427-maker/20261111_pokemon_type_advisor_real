// ============================================================
// lib/openai.js — OpenAI API 연동 모듈
// ============================================================
// 포켓몬의 타입, 특성 후보를 식별하고 상성 정보를 기반으로
// 알기 쉬운 한국어 공략과 팁 문장을 생성합니다.
// ============================================================
require('dotenv').config();
const OpenAI = require('openai');

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

let openaiClient = null;
if (apiKey) {
  openaiClient = new OpenAI({ apiKey });
}

/**
 * OpenAI를 호출하여 포켓몬 기본 정보 식별 (타입 및 가능 특성)
 * 및 계산된 상성을 바탕으로 공략 문장 생성
 *
 * @param {string} pokemonName
 * @param {Object} [calculatedMatchups] - calculateTypeMatchups 결과 (선택)
 * @returns {Promise<{ found: boolean, recognizedName?: string, types?: string[], strategy?: string[], abilityNotes?: string[], caveat?: string, error?: string }>}
 */
async function analyzePokemonWithAI(pokemonName, calculatedMatchups = null) {
  if (!openaiClient) {
    throw new Error('AI_UNAVAILABLE');
  }

  // 1단계: 포켓몬 이름 검증 및 타입 판별
  const systemPrompt = `당신은 포켓몬 상성 및 전략 분석 전문가입니다.
사용자가 입력한 포켓몬 이름에 대해 정확한 공식 타입(최신 세대 기준 1~2개)과 주 특성/주의할 점, 공략 팁을 JSON 형식으로 작성해야 합니다.

반드시 다음 규칙을 준수하세요:
1. 실제 존재하지 않거나 모호한 포켓몬 이름인 경우:
   {"found": false, "message": "해당 포켓몬 정보를 찾을 수 없습니다. 정확한 한국어 포켓몬 이름을 입력해 주세요."}
2. 실존 포켓몬인 경우:
   - "found": true
   - "recognizedName": 공식 한국어 포켓몬 명칭 (예: "피카츄")
   - "types": 공식 타입 배열 (예: ["전기"], ["불꽃", "비행"]). 반드시 [노말, 불꽃, 물, 풀, 전기, 얼음, 격투, 독, 땅, 비행, 에스퍼, 벌레, 바위, 고스트, 드래곤, 악, 강철, 페어리] 중 선택.
   - "strategy": 실전에서 유용한 공략 팁 배열 (최대 2~3문장)
   - "abilityNotes": 특성 관련 주의점 배열 (예: 부유로 땅 무효 가능성, 피뢰침 등 특정 상성 변화 특성 주의 문구)
   - "caveat": "게임 버전, 세대 및 폼(메가진화, 리전폼 등)에 따라 정보가 상이할 수 있습니다."

3. 반드시 마크다운 코드블록 없이 순수 JSON만 반환하세요.`;

  let userContent = `포켓몬 이름: "${pokemonName}"`;
  if (calculatedMatchups) {
    userContent += `\n참고 계산된 약점: ${JSON.stringify(calculatedMatchups.weaknesses)}`;
  }

  const response = await openaiClient.chat.completions.create({
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' }
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error('AI_EMPTY_RESPONSE');
  }

  try {
    const parsed = JSON.parse(rawContent);
    return parsed;
  } catch (err) {
    console.error('[OpenAI JSON Parse Error]', err, rawContent);
    throw new Error('AI_INVALID_RESPONSE');
  }
}

module.exports = {
  analyzePokemonWithAI
};
