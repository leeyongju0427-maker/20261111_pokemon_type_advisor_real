// ============================================================
// lib/supabase.js — Supabase 클라이언트 초기화 모듈
// ============================================================
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
// service_role 키가 있으면 우선 사용하고, 없으면 anon 키 사용
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false
    }
  });
} else {
  console.warn('[Supabase] 환경 변수가 설정되지 않았습니다 (SUPABASE_URL, SUPABASE_ANON_KEY).');
}

/**
 * Supabase 클라이언트 인스턴스 반환
 */
function getSupabaseClient() {
  return supabase;
}

module.exports = {
  getSupabaseClient
};
