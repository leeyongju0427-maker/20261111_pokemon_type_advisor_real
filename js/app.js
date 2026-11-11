// ============================================================
// 포켓몬 상성 알리미 — 프론트엔드 메인 스크립트
// ============================================================
// 이 파일은 사용자가 포켓몬을 검색하고, 결과를 화면에 표시하고,
// 피드백을 작성/조회하는 모든 프론트엔드 로직을 담당합니다.
//
// 【주요 기능】
// 1. 포켓몬 검색 → /api/analyze 호출 → 결과 카드 렌더링
// 2. 최근 검색어 관리 (localStorage, 최대 5개)
// 3. 예시 검색 버튼 (피카츄, 리자몽 등)
// 4. 피드백 작성 → /api/feedback POST → 목록 갱신
// 5. 피드백 목록 → /api/feedback GET → 최신순 렌더링
// 6. 로딩/오류/빈 상태 관리
//
// 【보안 규칙】
// - 모든 사용자 입력과 서버 응답은 textContent로만 표시 (XSS 방지)
// - innerHTML은 안전하게 검증된 태그 생성이나 초기화 시에만 제어
// ============================================================
'use strict';

// ============================================================
// 1. DOM 요소 참조
// ============================================================
// ---- 검색 관련 ----
const searchForm      = document.getElementById('search-form');       // 검색 폼
const pokemonInput    = document.getElementById('pokemon-input');     // 포켓몬 이름 입력창
const searchBtn       = document.getElementById('search-btn');        // 검색 버튼
const inputHint       = document.getElementById('input-hint');        // 입력 오류 메시지
const exampleBtns     = document.getElementById('example-btns');      // 예시 버튼 컨테이너

// ---- 상태 섹션 ----
const loadingSection  = document.getElementById('loading-section');   // 로딩 표시 영역
const errorSection    = document.getElementById('error-section');     // 에러 표시 영역
const errorMessage    = document.getElementById('error-message');     // 에러 메시지 텍스트
const retryBtn        = document.getElementById('retry-btn');         // 다시 시도 버튼
const resultSection   = document.getElementById('result-section');    // 결과 카드 영역

// ---- 결과 내부 ----
const resultName      = document.getElementById('result-name');       // 포켓몬 이름
const resultTypes     = document.getElementById('result-types');      // 타입 배지 컨테이너
const resultWeakness  = document.getElementById('result-weaknesses'); // 약점 배지
const resultResist    = document.getElementById('result-resistances');// 저항 배지
const resultImmunity  = document.getElementById('result-immunities'); // 무효 배지
const resultTips      = document.getElementById('result-tips');       // 공략 팁
const resultAbilities = document.getElementById('result-abilities');  // 특성 주의
const resultDisclaimer= document.getElementById('result-disclaimer');// 데이터 안내

// ---- 최근 검색 ----
const recentSection   = document.getElementById('recent-section');    // 최근 검색 섹션
const recentList      = document.getElementById('recent-list');       // 최근 검색 칩 컨테이너
const clearRecentBtn  = document.getElementById('clear-recent-btn'); // 기록 삭제 버튼

// ---- 피드백 ----
const feedbackForm    = document.getElementById('feedback-form');     // 피드백 폼
const feedbackAuthor  = document.getElementById('feedback-author');   // 닉네임 입력
const feedbackContent = document.getElementById('feedback-content');  // 내용 입력
const feedbackSubmit  = document.getElementById('feedback-submit-btn');// 전송 버튼
const feedbackStatus  = document.getElementById('feedback-status');   // 전송 결과 메시지
const charCurrent     = document.getElementById('char-current');      // 글자수 표시
const feedbackList    = document.getElementById('feedback-list');     // 피드백 목록 컨테이너
const feedbackEmpty   = document.getElementById('feedback-empty');    // 빈 상태 메시지


// ============================================================
// 2. 상수
// ============================================================
const RECENT_KEY = 'pokemon_recent_searches';
const RECENT_MAX = 5;
const NAME_MAX_LENGTH = 30;
const CONTENT_MAX_LENGTH = 500;
const AUTHOR_MAX_LENGTH = 30;


// ============================================================
// 3. 상태 변수
// ============================================================
let isSearching = false;
let isSubmitting = false;
let lastSearchName = '';


// ============================================================
// 4. 초기화: 페이지 로드 시 실행
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  renderRecentSearches();
  loadFeedbackList();
  setupEventListeners();
});


// ============================================================
// 5. 이벤트 리스너 등록
// ============================================================
function setupEventListeners() {
  // ---- 검색 폼 제출 ----
  searchForm.addEventListener('submit', function(event) {
    event.preventDefault();
    const name = pokemonInput.value.trim();
    handleSearch(name);
  });

  // ---- 예시 검색 버튼 클릭 ----
  exampleBtns.addEventListener('click', function(event) {
    const btn = event.target.closest('.btn-example');
    if (!btn) return;
    const name = btn.dataset.name;
    pokemonInput.value = name;
    handleSearch(name);
  });

  // ---- 다시 시도 버튼 ----
  retryBtn.addEventListener('click', function() {
    if (lastSearchName) {
      handleSearch(lastSearchName);
    }
  });

  // ---- 최근 검색 칩 클릭 ----
  recentList.addEventListener('click', function(event) {
    const chip = event.target.closest('.recent-chip');
    if (!chip) return;
    const name = chip.dataset.name;
    pokemonInput.value = name;
    handleSearch(name);
  });

  // ---- 최근 검색 기록 삭제 ----
  clearRecentBtn.addEventListener('click', function() {
    clearRecentSearches();
  });

  // ---- 피드백 폼 제출 ----
  feedbackForm.addEventListener('submit', function(event) {
    event.preventDefault();
    handleFeedbackSubmit();
  });

  // ---- 피드백 글자수 카운터 ----
  feedbackContent.addEventListener('input', function() {
    charCurrent.textContent = feedbackContent.value.length;
  });
}


// ============================================================
// 6. 포켓몬 검색 처리
// ============================================================
async function handleSearch(name) {
  if (isSearching) return;
  if (!validateSearchInput(name)) return;

  isSearching = true;
  lastSearchName = name;
  showLoading();
  clearInputHint();

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pokemonName: name })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      const errMsg = data.error?.message || '분석에 실패했습니다.';
      throw new Error(errMsg);
    }

    renderResult(data.data);
    addRecentSearch(data.data.pokemonName || name);
    showResult();

  } catch (error) {
    console.error('[검색 오류]', error.message);
    showError(getErrorMessage(error));
  } finally {
    isSearching = false;
    searchBtn.classList.remove('is-loading');
    searchBtn.disabled = false;
  }
}

function validateSearchInput(name) {
  if (!name) {
    showInputHint('포켓몬 이름을 입력해 주세요.');
    pokemonInput.focus();
    return false;
  }

  if (name.length > NAME_MAX_LENGTH) {
    showInputHint(`이름이 너무 깁니다. ${NAME_MAX_LENGTH}자 이내로 입력해 주세요.`);
    pokemonInput.focus();
    return false;
  }

  if (/^[\d\s!@#$%^&*()_+=\-\[\]{};:'",.<>?/\\|`~]+$/.test(name)) {
    showInputHint('올바른 포켓몬 이름을 입력해 주세요.');
    pokemonInput.focus();
    return false;
  }

  return true;
}


// ============================================================
// 7. 결과 렌더링
// ============================================================
function renderResult(data) {
  // 1. 포켓몬 이름
  resultName.textContent = data.pokemonName || '알 수 없음';

  // 2. 타입 배지
  resultTypes.innerHTML = '';
  if (Array.isArray(data.types)) {
    data.types.forEach(function(typeName) {
      const badge = createTypeBadge(typeName);
      resultTypes.appendChild(badge);
    });
  }

  // 3. 약점, 저항, 무효
  renderMatchupBadges(resultWeakness, data.weaknesses, '약점 없음');
  renderMatchupBadges(resultResist, data.resistances, '저항 없음');
  renderMatchupBadges(resultImmunity, data.immunities, '무효 타입 없음');

  // 4. 추천 공략법 (배열 또는 문자열 지원)
  if (Array.isArray(data.strategy)) {
    resultTips.textContent = data.strategy.join('\n');
  } else {
    resultTips.textContent = data.strategy || '공략 정보가 없습니다.';
  }

  // 5. 특성 주의사항 (배열 또는 문자열 지원)
  if (Array.isArray(data.abilityNotes)) {
    resultAbilities.textContent = data.abilityNotes.length > 0
      ? data.abilityNotes.join('\n')
      : '특이한 상성 변화 특성이 없거나 일반적인 규칙을 따릅니다.';
  } else {
    resultAbilities.textContent = data.abilityNotes || '특성 정보가 없습니다.';
  }

  // 6. 데이터 안내
  resultDisclaimer.textContent = data.caveat || '위 정보는 게임 버전·폼·특성에 따라 달라질 수 있습니다.';
}

function renderMatchupBadges(container, matchups, emptyText) {
  container.innerHTML = '';

  if (!matchups || matchups.length === 0) {
    const noneText = document.createElement('span');
    noneText.className = 'matchup-none';
    noneText.textContent = emptyText;
    container.appendChild(noneText);
    return;
  }

  matchups.forEach(function(item) {
    const badge = createTypeBadge(item.type, item.multiplier);
    if (item.multiplier >= 4) {
      badge.classList.add('is-quad');
    }
    container.appendChild(badge);
  });
}

function createTypeBadge(typeName, multiplier) {
  const badge = document.createElement('span');
  badge.className = 'type-badge';
  badge.dataset.type = typeName;

  if (multiplier !== undefined && multiplier !== null) {
    badge.textContent = typeName + ' ';
    const mul = document.createElement('span');
    mul.className = 'type-multiplier';
    mul.textContent = '×' + multiplier;
    badge.appendChild(mul);
  } else {
    badge.textContent = typeName;
  }

  return badge;
}


// ============================================================
// 8. 화면 상태 전환
// ============================================================
function showLoading() {
  resultSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  loadingSection.classList.remove('hidden');
  searchBtn.classList.add('is-loading');
  searchBtn.disabled = true;
}

function showResult() {
  loadingSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  resultSection.classList.remove('hidden');
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showError(message) {
  loadingSection.classList.add('hidden');
  resultSection.classList.add('hidden');
  errorSection.classList.remove('hidden');
  errorMessage.textContent = message;
}

function showInputHint(message) {
  inputHint.textContent = message;
}

function clearInputHint() {
  inputHint.textContent = '';
}

function getErrorMessage(error) {
  const msg = error.message || '';

  if (msg.includes('Unexpected token') || msg.includes('not valid JSON')) {
    return '서버 응답 형식이 올바르지 않습니다. API 상태를 확인해 주세요.';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return '서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.';
  }
  if (msg.includes('AI_UNAVAILABLE') || msg.includes('AI 서비스')) {
    return 'AI 서비스 연결에 실패했습니다. 환경 변수(API 키)를 확인해 주세요.';
  }
  if (msg) {
    return msg;
  }
  return '알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}


// ============================================================
// 9. 최근 검색 관리 (localStorage)
// ============================================================
function addRecentSearch(name) {
  let searches = getRecentSearches();
  searches = searches.filter(item => item !== name);
  searches.unshift(name);

  if (searches.length > RECENT_MAX) {
    searches = searches.slice(0, RECENT_MAX);
  }

  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(searches));
  } catch (e) {
    console.warn('[최근 검색] 저장 실패:', e.message);
  }
  renderRecentSearches();
}

function getRecentSearches() {
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.warn('[최근 검색] 불러오기 실패:', e.message);
  }
  return [];
}

function renderRecentSearches() {
  const searches = getRecentSearches();
  if (searches.length === 0) {
    recentSection.classList.add('hidden');
    return;
  }

  recentSection.classList.remove('hidden');
  recentList.innerHTML = '';

  searches.forEach(function(name) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'recent-chip';
    chip.dataset.name = name;
    chip.textContent = name;
    chip.setAttribute('aria-label', `${name} 다시 검색`);
    recentList.appendChild(chip);
  });
}

function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch (e) {
    console.warn('[최근 검색] 삭제 실패:', e.message);
  }
  renderRecentSearches();
}


// ============================================================
// 10. 피드백 기능
// ============================================================
async function handleFeedbackSubmit() {
  if (isSubmitting) return;

  const author = feedbackAuthor.value.trim() || '익명';
  const content = feedbackContent.value.trim();

  if (!content) {
    showFeedbackStatus('내용을 입력해 주세요.', 'error');
    feedbackContent.focus();
    return;
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    showFeedbackStatus(`내용은 ${CONTENT_MAX_LENGTH}자 이내로 작성해 주세요.`, 'error');
    return;
  }

  isSubmitting = true;
  feedbackSubmit.classList.add('is-loading');
  feedbackSubmit.disabled = true;
  clearFeedbackStatus();

  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: author,
        content: content
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error?.message || '피드백 전송에 실패했습니다.');
    }

    feedbackContent.value = '';
    feedbackAuthor.value = '';
    charCurrent.textContent = '0';
    showFeedbackStatus('의견이 전송되었습니다! 감사합니다 🎉', 'success');

    loadFeedbackList();

  } catch (error) {
    console.error('[피드백 오류]', error.message);
    showFeedbackStatus(error.message || '전송에 실패했습니다. 다시 시도해 주세요.', 'error');
  } finally {
    isSubmitting = false;
    feedbackSubmit.classList.remove('is-loading');
    feedbackSubmit.disabled = false;
  }
}

async function loadFeedbackList() {
  try {
    const response = await fetch('/api/feedback', {
      method: 'GET'
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error?.message || '피드백을 불러올 수 없습니다.');
    }

    renderFeedbackList(data.data);

  } catch (error) {
    console.warn('[피드백 목록] 로드 실패:', error.message);
    renderFeedbackList([]);
  }
}

function renderFeedbackList(feedbacks) {
  feedbackList.innerHTML = '';

  if (!feedbacks || feedbacks.length === 0) {
    const emptyEl = document.createElement('p');
    emptyEl.className = 'empty-state';
    emptyEl.id = 'feedback-empty';
    emptyEl.textContent = '아직 의견이 없어요. 첫 번째 의견을 남겨보세요! 🎉';
    feedbackList.appendChild(emptyEl);
    return;
  }

  feedbacks.forEach(function(fb) {
    const item = document.createElement('div');
    item.className = 'feedback-item';

    const header = document.createElement('div');
    header.className = 'feedback-item-header';

    const authorEl = document.createElement('span');
    authorEl.className = 'feedback-author';
    authorEl.textContent = fb.display_name || fb.author || '익명';

    const dateEl = document.createElement('span');
    dateEl.className = 'feedback-date';
    dateEl.textContent = formatDate(fb.created_at);

    header.appendChild(authorEl);
    header.appendChild(dateEl);

    const contentEl = document.createElement('p');
    contentEl.className = 'feedback-content';
    contentEl.textContent = fb.content || '';

    item.appendChild(header);
    item.appendChild(contentEl);
    feedbackList.appendChild(item);
  });
}

function showFeedbackStatus(message, type) {
  feedbackStatus.textContent = message;
  feedbackStatus.className = 'feedback-status';
  if (type === 'success') {
    feedbackStatus.classList.add('is-success');
  } else if (type === 'error') {
    feedbackStatus.classList.add('is-error');
  }
}

function clearFeedbackStatus() {
  feedbackStatus.textContent = '';
  feedbackStatus.className = 'feedback-status';
}

function formatDate(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Seoul',
      hour12: false
    };

    return new Intl.DateTimeFormat('ko-KR', options)
      .format(date)
      .replace(/\. /g, '.')
      .replace(/\.$/, '')
      .replace(/\.\s*(\d{2}:\d{2})/, ' $1');
  } catch (e) {
    return isoString;
  }
}
