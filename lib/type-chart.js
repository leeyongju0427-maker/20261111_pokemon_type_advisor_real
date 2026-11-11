// ============================================================
// lib/type-chart.js — 포켓몬 18가지 타입 상성표 및 계산 모듈
// ============================================================
// 포켓몬 본가 게임(6세대~9세대 최신 기준)의 상성 배율표입니다.
// 공격 타입(행) -> 방어 타입(열)에 대한 배율을 정의합니다.
//
// 배율 규칙:
// - 2 : 효과가 굉장함 (2배 피해)
// - 1 : 일반적인 효과 (1배 피해 - 기본값)
// - 0.5 : 효과가 별로임 (반감)
// - 0 : 효과가 없음 (무효)
// ============================================================

// 18가지 정식 포켓몬 타입 목록
const TYPES = [
  '노말', '불꽃', '물', '풀', '전기', '얼음',
  '격투', '독', '땅', '비행', '에스퍼', '벌레',
  '바위', '고스트', '드래곤', '악', '강철', '페어리'
];

// 상성 매트릭스 [공격타입][방어타입] = 피해 배율 (기본 1배인 조합은 생략하고 오버라이드)
const TYPE_CHART = {
  '노말': {
    '바위': 0.5, '고스트': 0, '강철': 0.5
  },
  '불꽃': {
    '불꽃': 0.5, '물': 0.5, '풀': 2, '얼음': 2, '벌레': 2, '바위': 0.5, '드래곤': 0.5, '강철': 2
  },
  '물': {
    '불꽃': 2, '물': 0.5, '풀': 0.5, '땅': 2, '바위': 2, '드래곤': 0.5
  },
  '풀': {
    '불꽃': 0.5, '물': 2, '풀': 0.5, '독': 0.5, '땅': 2, '비행': 0.5, '벌레': 0.5, '바위': 2, '드래곤': 0.5, '강철': 0.5
  },
  '전기': {
    '물': 2, '풀': 0.5, '전기': 0.5, '땅': 0, '비행': 2, '드래곤': 0.5
  },
  '얼음': {
    '불꽃': 0.5, '물': 0.5, '풀': 2, '얼음': 0.5, '땅': 2, '비행': 2, '드래곤': 2, '강철': 0.5
  },
  '격투': {
    '노말': 2, '얼음': 2, '독': 0.5, '비행': 0.5, '에스퍼': 0.5, '벌레': 0.5, '바위': 2, '고스트': 0, '악': 2, '강철': 2, '페어리': 0.5
  },
  '독': {
    '풀': 2, '독': 0.5, '땅': 0.5, '바위': 0.5, '고스트': 0.5, '강철': 0, '페어리': 2
  },
  '땅': {
    '불꽃': 2, '풀': 0.5, '전기': 2, '독': 2, '비행': 0, '벌레': 0.5, '바위': 2, '강철': 2
  },
  '비행': {
    '풀': 2, '전기': 0.5, '격투': 2, '벌레': 2, '바위': 0.5, '강철': 0.5
  },
  '에스퍼': {
    '격투': 2, '독': 2, '에스퍼': 0.5, '악': 0, '강철': 0.5
  },
  '벌레': {
    '불꽃': 0.5, '풀': 2, '격투': 0.5, '독': 0.5, '비행': 0.5, '에스퍼': 2, '고스트': 0.5, '악': 2, '강철': 0.5, '페어리': 0.5
  },
  '바위': {
    '불꽃': 2, '얼음': 2, '격투': 0.5, '땅': 0.5, '비행': 2, '벌레': 2, '강철': 0.5
  },
  '고스트': {
    '노말': 0, '에스퍼': 2, '고스트': 2, '악': 0.5
  },
  '드래곤': {
    '드래곤': 2, '강철': 0.5, '페어리': 0
  },
  '악': {
    '격투': 0.5, '에스퍼': 2, '고스트': 2, '악': 0.5, '페어리': 0.5
  },
  '강철': {
    '불꽃': 0.5, '물': 0.5, '전기': 0.5, '얼음': 2, '바위': 2, '강철': 0.5, '페어리': 2
  },
  '페어리': {
    '불꽃': 0.5, '격투': 2, '독': 0.5, '드래곤': 2, '악': 2, '강철': 0.5
  }
};

/**
 * 단일 공격 타입이 단일 방어 타입에 가하는 피해 배율 계산
 * @param {string} attackType - 공격 측 타입
 * @param {string} defenseType - 방어 측 타입
 * @returns {number} 배율 (0, 0.5, 1, 2)
 */
function getSingleMultiplier(attackType, defenseType) {
  if (TYPE_CHART[attackType] && typeof TYPE_CHART[attackType][defenseType] !== 'undefined') {
    return TYPE_CHART[attackType][defenseType];
  }
  return 1; // 명시되지 않은 조합은 1배(보통 피해)
}

/**
 * 방어 포켓몬의 타입(1개 혹은 2개)에 대해 모든 공격 타입별 상성 배율을 계산합니다.
 * @param {string[]} defenseTypes - 방어 포켓몬의 타입 배열 (예: ['불꽃', '비행'])
 * @returns {Object} { weaknesses, resistances, immunities }
 */
function calculateTypeMatchups(defenseTypes) {
  if (!Array.isArray(defenseTypes) || defenseTypes.length === 0) {
    return { weaknesses: [], resistances: [], immunities: [] };
  }

  const weaknesses = [];
  const resistances = [];
  const immunities = [];

  // 18가지 모든 공격 타입을 순회하면서 복합 배율 계산
  TYPES.forEach((atkType) => {
    let totalMultiplier = 1;

    defenseTypes.forEach((defType) => {
      totalMultiplier *= getSingleMultiplier(atkType, defType);
    });

    if (totalMultiplier === 0) {
      immunities.push({ type: atkType, multiplier: 0 });
    } else if (totalMultiplier > 1) {
      weaknesses.push({ type: atkType, multiplier: totalMultiplier });
    } else if (totalMultiplier < 1) {
      resistances.push({ type: atkType, multiplier: totalMultiplier });
    }
  });

  // 약점은 배율 내림차순(4배 -> 2배)
  weaknesses.sort((a, b) => b.multiplier - a.multiplier);
  // 저항은 배율 오름차순(0.25배 -> 0.5배)
  resistances.sort((a, b) => a.multiplier - b.multiplier);

  return {
    weaknesses,
    resistances,
    immunities
  };
}

module.exports = {
  TYPES,
  calculateTypeMatchups,
  getSingleMultiplier
};
