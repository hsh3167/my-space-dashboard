import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import config from '../assets/public-config.mjs';
import { validateConfig } from '../assets/client.mjs';

export async function checkConnection(connection, { fetcher = globalThis.fetch, authOnly = false } = {}) {
  const safe = validateConfig(connection), checks = [];
  const request = (path, options = {}) => fetcher(safe.url + path, {
    ...options, signal: AbortSignal.timeout(15000), credentials: 'omit', cache: 'no-store',
    headers: { apikey: safe.publishableKey, ...options.headers }
  });
  let settings;
  try {
    const response = await request('/auth/v1/settings');
    if (!response.ok) return { ready: false, checks: [{ passed: false, message: `인증 서버 연결 실패 (HTTP ${response.status}). 프로젝트 URL과 공개 키를 확인하세요.` }] };
    settings = await response.json();
    checks.push({ passed: true, message: '실제 Supabase 인증 서버와 공개 키 연결 확인' });
    const cors = await request('/auth/v1/token?grant_type=password', { method: 'OPTIONS', headers: {
      Origin: 'https://hsh3167.github.io', 'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'apikey,authorization,content-type,prefer'
    } });
    const origin = cors.headers.get('access-control-allow-origin');
    const allowed = (cors.headers.get('access-control-allow-headers') || '').toLowerCase().split(',').map(s => s.trim());
    checks.push({ passed: cors.ok && ['*', 'https://hsh3167.github.io'].includes(origin) && (allowed.includes('*') || ['apikey','authorization','content-type','prefer'].every(h => allowed.includes(h))), message: 'GitHub Pages 로그인 요청의 CORS 허용 확인' });
    if (!authOnly) {
      for (const table of ['asset_accounts','asset_holdings','asset_snapshots','asset_payments','asset_imports']) {
        // HEAD + limit=0 checks permissions/schema without retrieving any financial record.
        const result = await request(`/rest/v1/${table}?select=id&limit=0`, { method: 'HEAD' });
        checks.push({ passed: [401,403].includes(result.status), message: `${table}: 익명 접근 차단 (HTTP ${result.status})${result.status === 404 ? ' — DB 초기 설정이 필요합니다.' : ''}` });
      }
      const rpc = await request('/rest/v1/rpc/asset_access_allowed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      checks.push({ passed: [401,403].includes(rpc.status), message: `본인 확인 함수: 익명 실행 차단 (HTTP ${rpc.status})` });
    }
  } catch {
    checks.push({ passed: false, message: '프로젝트 네트워크/TLS 연결을 확인하세요. 인증서 검증은 유지됩니다.' });
  }
  return { ready: checks.length > 0 && checks.every(c => c.passed), authOnly, checks, signupDisabled: settings?.disable_signup === true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const report = await checkConnection(config, { authOnly: process.argv.includes('--auth-only') });
    for (const check of report.checks) {
      console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.message}`);
      if (process.env.GITHUB_ACTIONS === 'true') console.log(`::${check.passed ? 'notice' : 'error'}::${check.message}`);
    }
    if (!report.signupDisabled) console.log('권장 설정: Authentication 설정에서 신규 사용자 가입을 비활성화하세요.');
    console.log('금융 레코드·비밀번호·로그인 토큰을 읽거나 저장하지 않았습니다. 본인 로그인 검증은 별도로 필요합니다.');
    if (!report.ready) process.exitCode = 1;
  } catch { console.error('Supabase 공개 URL/키 설정을 확인하세요.'); process.exitCode = 1; }
}
