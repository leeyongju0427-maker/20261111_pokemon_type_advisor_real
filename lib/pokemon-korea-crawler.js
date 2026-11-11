// ============================================================
// lib/pokemon-korea-crawler.js — 포켓몬 코리아 공식 도감 연동 모듈
// ============================================================
// 공식 사이트: https://pokemonkorea.co.kr/pokedex
// 공식 Ajax 검색과 상세 정보를 통해 공식 포켓몬 이름, 번호,
// 공식 타입 및 특성 정보를 실시간으로 수집합니다.
// ============================================================

const BASE_URL = 'https://pokemonkorea.co.kr';

/**
 * 포켓몬 코리아 공식 도감에서 포켓몬 검색
 * @param {string} searchWord - 검색어 (예: "피카츄", "리자몽")
 * @returns {Promise<{ found: boolean, pokemonName?: string, number?: string, formName?: string, types?: string[], imageUrl?: string, abilities?: string[] } | null>}
 */
async function fetchPokemonFromKoreaPokedex(searchWord) {
  if (!searchWord || typeof searchWord !== 'string') {
    return null;
  }

  const cleanedWord = searchWord.trim();

  try {
    const formData = new FormData();
    formData.append('mode', 'load_more');
    formData.append('word', cleanedWord);
    formData.append('characters', '');
    formData.append('pn', '1');
    formData.append('area', '');
    formData.append('snumber', '1');
    formData.append('snumber2', '1025');
    formData.append('sortselval', 'number asc,number_count asc');
    formData.append('typestr', '');

    // 1. 공식 사이트 Ajax 검색 요청
    const response = await fetch(`${BASE_URL}/ajax/pokedex`, {
      method: 'POST',
      body: formData,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': `${BASE_URL}/pokedex`
      }
    });

    if (!response.ok) {
      console.warn(`[PokemonKorea Crawler] HTTP Error: ${response.status}`);
      return null;
    }

    const rawText = await response.text();
    const parts = rawText.split('#|#');

    // 검색 결과 건수 확인 (parts[2])
    const count = parseInt(parts[2], 10);
    if (!count || count === 0 || !parts[1]) {
      return { found: false };
    }

    const html = parts[1];

    // 2. 검색 결과 목록 아이템 파싱
    // <li class="col-lg-2 col-6" id="#pokedex_XX"> ... </li>
    const itemRegex = /<li[^>]*id="#pokedex_(\d+)"[^>]*>([\s\S]*?)<\/li>/gi;
    let match;
    const candidates = [];

    while ((match = itemRegex.exec(html)) !== null) {
      const detailId = match[1];
      const itemContent = match[2];

      // 포켓몬 번호 파싱 (예: No.0025)
      const numMatch = itemContent.match(/<p>(No\.\d+)<\/p>/i);
      const number = numMatch ? numMatch[1] : '';

      // 포켓몬 이름 파싱 (<h3><p>No.0025</p> 피카츄</h3>)
      const nameMatch = itemContent.match(/<h3>(?:<p>[^<]*<\/p>)?\s*([^<]+)<\/h3>/i);
      const pokemonName = nameMatch ? nameMatch[1].trim() : '';

      // 폼 명칭 (예: 거다이맥스의 모습, 알로라의 모습 등)
      const formMatch = itemContent.match(/<\/h3>\s*<p>([^<]*)<\/p>/i);
      const formName = formMatch ? formMatch[1].trim() : '';

      // 이미지 URL
      const imgMatch = itemContent.match(/<img[^>]+src="([^">]+)"/i);
      let imageUrl = '';
      if (imgMatch) {
        imageUrl = imgMatch[1].startsWith('http') ? imgMatch[1] : `${BASE_URL}${imgMatch[1]}`;
      }

      // 타입 배지 파싱 (<span class="badge ...">전기</span>)
      const typeMatches = itemContent.match(/<span[^>]*class="[^"]*badge[^"]*"[^>]*>([^<]+)<\/span>/gi);
      const types = [];
      if (typeMatches) {
        typeMatches.forEach(tag => {
          const typeText = tag.replace(/<[^>]+>/g, '').trim();
          if (typeText && !types.includes(typeText)) {
            types.push(typeText);
          }
        });
      }

      candidates.push({
        detailId, // 실제 상세 뷰 번호 (예: 37)
        number,
        pokemonName,
        formName,
        types,
        imageUrl
      });
    }

    if (candidates.length === 0) {
      return { found: false };
    }

    // 3. 사용자가 입력한 이름과 가장 일치하는 포켓몬 매칭
    // (기본형 폼 우선 또는 정확 일치)
    let selected = candidates.find(c => c.pokemonName === cleanedWord && !c.formName);
    if (!selected) {
      selected = candidates.find(c => c.pokemonName === cleanedWord);
    }
    if (!selected) {
      selected = candidates[0];
    }

    // 4. 상세 페이지(`/pokedex/view/:detailId`)에서 공식 특성 정보 추가 스크랩
    let abilities = [];
    if (selected.detailId) {
      try {
        const detailRes = await fetch(`${BASE_URL}/pokedex/view/${selected.detailId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });

        if (detailRes.ok) {
          const detailHtml = await detailRes.text();
          // 특성 영역 파싱: charmodalshow('정전기')
          const charRegex = /charmodalshow\('([^']+)'\)/gi;
          let charMatch;
          while ((charMatch = charRegex.exec(detailHtml)) !== null) {
            const abName = charMatch[1].trim();
            if (abName && !abilities.includes(abName)) {
              abilities.push(abName);
            }
          }
        }
      } catch (detailErr) {
        console.warn('[PokemonKorea Detail Error]', detailErr.message);
      }
    }

    return {
      found: true,
      pokemonName: selected.pokemonName,
      number: selected.number,
      formName: selected.formName,
      types: selected.types,
      imageUrl: selected.imageUrl,
      abilities: abilities
    };

  } catch (error) {
    console.error('[PokemonKorea Crawler Exception]:', error.message);
    return null;
  }
}

module.exports = {
  fetchPokemonFromKoreaPokedex
};
