import { sampleData } from './sample.mjs';
import { dashboardHTML } from './dashboard.mjs';

const root = document.querySelector('#asset-workspace');
root.innerHTML = `<header class="asset-heading"><div><span class="asset-eyebrow">YOUR FINANCIAL WORKSPACE</span><h1>내 자산을, <em>한눈에.</em></h1><p>오늘의 자산부터 내일의 납부 일정까지.</p></div><span class="asset-mode-badge">샘플 데이터</span></header><p class="asset-notice">데모 화면입니다. 표시된 계좌·금액·종목은 모두 가상 데이터이며 실제 금융정보가 아닙니다.</p><div id="asset-auth"></div><div id="asset-controls"></div><div id="asset-dashboard">${dashboardHTML(sampleData())}</div>`;
