// ============================================================
// lib/validation.js — 입력값 검증 유틸리티 모듈
// ============================================================
// 사용자의 입력 문자열 길이, 형식, 악의적인 값 유무를 검사합니다.
// ============================================================

/**
 * 포켓몬 이름 입력값 검증
 * @param {any} input
 * @returns {{ isValid: boolean, cleanedName?: string, errorCode?: string, message?: string }}
 */
function validatePokemonName(input) {
  if (typeof input !== 'string') {
    return {
      isValid: false,
      errorCode: 'INVALID_INPUT',
      message: '포켓몬 이름을 문자열로 입력해 주세요.'
    };
  }

  const cleanedName = input.trim();

  if (cleanedName.length === 0) {
    return {
      isValid: false,
      errorCode: 'INVALID_INPUT',
      message: '포켓몬 이름을 입력해 주세요.'
    };
  }

  if (cleanedName.length > 30) {
    return {
      isValid: false,
      errorCode: 'INVALID_INPUT',
      message: '포켓몬 이름은 30자 이내로 입력해 주세요.'
    };
  }

  // 특수문자 및 기호만으로 구성된 입력 방지
  if (/^[\d\s!@#$%^&*()_+=\-\[\]{};:'",.<>?/\\|`~]+$/.test(cleanedName)) {
    return {
      isValid: false,
      errorCode: 'INVALID_INPUT',
      message: '올바른 포켓몬 이름을 입력해 주세요.'
    };
  }

  return {
    isValid: true,
    cleanedName
  };
}

/**
 * 피드백 입력값 검증
 * @param {any} author 
 * @param {any} content 
 * @returns {{ isValid: boolean, cleanedAuthor?: string, cleanedContent?: string, errorCode?: string, message?: string }}
 */
function validateFeedback(author, content) {
  let cleanedAuthor = typeof author === 'string' ? author.trim() : '익명';
  if (!cleanedAuthor) {
    cleanedAuthor = '익명';
  }

  if (cleanedAuthor.length > 30) {
    return {
      isValid: false,
      errorCode: 'INVALID_INPUT',
      message: '작성자 이름은 30자 이내로 입력해 주세요.'
    };
  }

  if (typeof content !== 'string') {
    return {
      isValid: false,
      errorCode: 'INVALID_INPUT',
      message: '피드백 내용을 입력해 주세요.'
    };
  }

  const cleanedContent = content.trim();

  if (cleanedContent.length === 0) {
    return {
      isValid: false,
      errorCode: 'INVALID_INPUT',
      message: '피드백 내용을 1자 이상 입력해 주세요.'
    };
  }

  if (cleanedContent.length > 500) {
    return {
      isValid: false,
      errorCode: 'INVALID_INPUT',
      message: '피드백 내용은 500자 이내로 입력해 주세요.'
    };
  }

  return {
    isValid: true,
    cleanedAuthor,
    cleanedContent
  };
}

module.exports = {
  validatePokemonName,
  validateFeedback
};
