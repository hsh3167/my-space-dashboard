"""Chromium/Playwright smoke tests. Only synthetic data; Supabase HTTP is mocked.

Run a static server, then: python3 scripts/browser-smoke.py [http://127.0.0.1:8000]
Requires Python Playwright and Chromium (CHROMIUM_EXECUTABLE may override its path).
This verifies the real browser/worker, not a hosted Supabase deployment.
"""
import asyncio
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

from playwright.async_api import async_playwright, expect, Error as PlaywrightError

ROOT = Path(__file__).resolve().parents[1]
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
PROJECT = "https://browser-smoke.supabase.co"
PUBLIC_KEY = "sb_publishable_browser_smoke_synthetic_key"
TOKEN = "synthetic-access-token"


async def main():
    sample = json.loads(subprocess.check_output([
        "node", "--input-type=module", "-e",
        "import {sampleData} from './assets/sample.mjs'; process.stdout.write(JSON.stringify(sampleData()));"
    ], cwd=ROOT))
    data = copy.deepcopy(sample)
    ids = {a["id"]: f"30000000-0000-4000-8000-{i+1:012d}" for i, a in enumerate(data["accounts"])}
    for a in data["accounts"]:
        a["id"] = ids[a["id"]]
        a["label"] = "합성 비공개 " + a["label"]
    for h in data["holdings"]:
        h["account_id"] = ids[h["account_id"]]
    for i, payment in enumerate(data["payments"]):
        payment["id"] = f"40000000-0000-4000-8000-{i+1:012d}"
    screenshots = Path(tempfile.mkdtemp(prefix="myspace-browser-"))
    xlsx = subprocess.check_output([
        "node", "--input-type=module", "-e",
        "import {workbook} from './tests/xlsx-fixture.mjs'; process.stdout.write(workbook([['퇴직연금 합성 보유현황'],['종목명','수량','평가금액','매입금액'],['브라우저 합성 연금 ETF',2,24000,20000]]));"
    ], cwd=ROOT)
    state = {"allowed": False, "verified": False, "financial": 0, "imports": [], "fingerprints": set(), "delay": False}
    release = asyncio.Event()
    page_errors = []
    checks = []

    def passed(name):
        checks.append(name)
        print("PASS", name, flush=True)

    async def backend(route):
        request = route.request
        headers = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS", "Content-Type": "application/json"}
        if request.method == "OPTIONS":
            await route.fulfill(status=204, headers=headers)
            return
        path = request.url.removeprefix(PROJECT)
        body = request.post_data_json if request.post_data else {}
        result, status = None, 200
        if path.startswith("/auth/v1/token?"):
            state["verified"] = False
            result = {"access_token": TOKEN, "refresh_token": "synthetic-unused-refresh", "expires_in": 3600}
        elif path == "/auth/v1/user":
            result = {"id": "10000000-0000-4000-8000-000000000001"}
        elif path == "/rest/v1/rpc/asset_access_allowed":
            state["verified"] = state["allowed"]
            result = state["allowed"]
        elif path == "/auth/v1/logout":
            state["verified"] = False
            result = {}
        else:
            assert state["verified"], "Financial request before owner authorization"
            assert request.headers.get("authorization") == f"Bearer {TOKEN}"
            state["financial"] += 1
            if path.startswith("/rest/v1/asset_") and request.method == "GET":
                table = path.split("?", 1)[0].split("_")[-1]
                result = copy.deepcopy(data[table])
                if table == "accounts" and state["delay"]:
                    await release.wait()
            elif path == "/rest/v1/rpc/save_asset_account":
                account_id = "30000000-0000-4000-8000-000000000099"
                data["accounts"].append({"id": account_id, "label": body["p_label"], "kind": body["p_kind"], "balance": body["p_balance"], "debt": body["p_debt"]})
                result = account_id
            elif path == "/rest/v1/asset_payments" and request.method == "POST":
                payment = {**body, "id": "40000000-0000-4000-8000-000000000099", "status": "scheduled"}
                data["payments"].append(payment)
                result = [payment]
            elif path.startswith("/rest/v1/asset_payments?id=eq.") and request.method == "PATCH":
                for payment in data["payments"]:
                    if payment["id"] == path.split("eq.")[1]:
                        payment.update(body)
                result = []
            elif path == "/rest/v1/rpc/import_asset_holdings":
                assert set(body) == {"p_account_id", "p_as_of", "p_positions", "p_cash"}
                for row in body["p_positions"]:
                    assert set(row) == {"name", "symbol", "quantity", "market_value", "cost_basis"}
                assert "DO-NOT-STORE" not in json.dumps(body)
                fingerprint = hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()
                if fingerprint in state["fingerprints"]:
                    status, result = 409, {"code": "23505"}
                else:
                    state["fingerprints"].add(fingerprint)
                    state["imports"].append(body)
                    data["holdings"] = [h for h in data["holdings"] if h["account_id"] != body["p_account_id"]]
                    data["holdings"].extend({**row, "account_id": body["p_account_id"]} for row in body["p_positions"])
                    for account in data["accounts"]:
                        if account["id"] == body["p_account_id"]:
                            account["balance"] = sum(p["market_value"] for p in body["p_positions"]) + body["p_cash"]
                    result = {"imported": len(body["p_positions"])}
            else:
                raise AssertionError(f"Unexpected endpoint: {path}")
        try:
            await route.fulfill(status=status, headers=headers, body=json.dumps(result))
        except PlaywrightError:
            if not state["delay"]:
                raise

    async with async_playwright() as p:
        executable = os.environ.get("CHROMIUM_EXECUTABLE")
        if not executable and Path('/usr/bin/chromium').exists():
            executable = '/usr/bin/chromium'
        browser = await p.chromium.launch(headless=True, **({"executable_path": executable} if executable else {}))
        context = await browser.new_context(viewport={"width": 1440, "height": 1000}, accept_downloads=True)
        page = await context.new_page()
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        await page.route(PROJECT + "/**", backend)
        await page.goto(BASE, wait_until="domcontentloaded")
        await expect(page.locator("#link-counter")).to_have_text("16 LINKS")
        await expect(page.locator("#dashboard-grid .section-card")).to_have_count(8)
        await page.locator("#site-search").fill("ChatGPT")
        await expect(page.locator("#dashboard-grid .site-link")).to_have_count(1)
        await page.locator("#clear-search").click()
        await page.locator('[data-tab="work"]').click()
        await expect(page.locator("#link-counter")).to_have_text("6 LINKS")
        await page.locator('[data-tab="projects"]').click()
        await expect(page.locator("#grid-heading")).to_have_text("개인 프로젝트")
        await expect(page.locator(".lab-card")).to_have_count(6)
        await expect(page.locator('.lab-card a[href="https://hsh3167.github.io/my-space-dashboard/"]')).to_have_count(1)
        await page.locator('.lab-card').filter(has_text="리프팅 모듈").locator('[data-project-action="detail"]').click()
        await expect(page.locator("#lab-detail")).to_contain_text("리프팅 모듈")
        await page.locator('#lab-detail [data-project-action="close-detail"]').click()
        await page.locator('#dashboard-grid [data-project-action="add"]').click()
        await page.locator('#lab-form [name="name"]').fill("브라우저 합성 프로젝트")
        await page.locator('#lab-form [name="category"]').select_option("simulation")
        await page.locator('#lab-form .lab-label').fill("테스트 시뮬레이션")
        await page.locator('#lab-form .lab-url').fill("https://example.test/sim")
        await page.locator('#lab-form [type="submit"]').click()
        await expect(page.locator(".lab-card")).to_have_count(7)
        await page.locator('#lab-detail [data-project-action="close-detail"]').click()
        await expect(page.locator('.lab-card a[href="https://example.test/sim"]')).to_have_count(1)
        await page.reload(wait_until="domcontentloaded")
        await page.locator('[data-tab="projects"]').click()
        await expect(page.locator('.lab-card a[href="https://example.test/sim"]')).to_have_count(1)
        passed("project cards, detail, simulation launch link and local persistence")
        passed("existing navigation and search")

        await page.locator('[data-tab="personal"]').click()
        await page.locator("#add-site-global").click()
        await page.locator("#edit-name").fill("브라우저 합성 프로젝트")
        await page.locator("#edit-url").fill("https://example.test/synthetic")
        await page.locator('#site-form [type="submit"]').click()
        link = page.locator('a[href="https://example.test/synthetic"]')
        await expect(link).to_have_count(1)
        await page.reload(wait_until="domcontentloaded")
        await expect(link).to_have_count(1)
        edit = page.locator('.project-slot.filled').filter(has=link).locator('[data-action="edit"]')
        await edit.click()
        await page.locator("#edit-name").fill("브라우저 합성 수정")
        await page.locator('#site-form [type="submit"]').click()
        async with page.expect_download() as info:
            await page.locator("#export-json").click()
        download = await info.value
        backup = json.loads(Path(await download.path()).read_text())
        assert "accounts" not in backup["links"]
        assert any(s["name"] == "브라우저 합성 수정" for s in backup["links"]["projects"])
        await edit.click()
        page.once("dialog", lambda dialog: dialog.accept())
        await page.locator("#delete-site").click()
        await expect(link).to_have_count(0)
        await page.locator("#import-file").set_input_files({"name": "synthetic.json", "mimeType": "application/json", "buffer": json.dumps(backup).encode()})
        await expect(link).to_have_count(1)
        await page.locator("#open-settings").click()
        page.once("dialog", lambda dialog: dialog.accept())
        await page.locator("#reset-data").click()
        await expect(page.locator("#link-counter")).to_have_text("16 LINKS")
        passed("link add/edit/delete, reload persistence, JSON export/import, reset")

        await page.locator('[data-tab="assets"]').click()
        await expect(page.locator(".asset-stats .asset-stat").nth(0)).to_contain_text("95,000,000원")
        await expect(page.locator(".asset-stats .asset-stat").nth(1)).to_contain_text("85,000,000원")
        await expect(page.locator(".asset-mode-badge")).to_have_text("샘플 데이터")
        assert state["financial"] == 0
        await page.screenshot(path=str(screenshots / "assets-desktop.png"), full_page=True)
        for width in [360, 390, 768, 1440]:
            await page.set_viewport_size({"width": width, "height": 844})
            for tab in ["personal", "work", "projects", "assets"]:
                await page.locator(f'[data-tab="{tab}"]').click()
                assert await page.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"Overflow: {width}px {tab}"
            if width == 390:
                await page.screenshot(path=str(screenshots / "assets-mobile.png"), full_page=True)
        await page.set_viewport_size({"width": 1440, "height": 1000})
        passed("sample totals and all workspaces at 360/390/768/1440px without page overflow")

        await page.locator('[data-asset-action="private"]').click()
        await expect(page.locator("#asset-dashboard")).to_be_empty()
        await page.locator("#asset-auth details summary").click()
        config = page.locator('[data-asset-form="config"]')
        await config.locator('[name="url"]').fill(PROJECT)
        await config.locator('[name="publishableKey"]').fill("sb_secret_do_not_use_synthetic")
        await config.locator('[type="submit"]').click()
        await expect(page.locator("#asset-message")).to_contain_text("공개 publishable/anon")
        await page.locator("#asset-auth details summary").click()
        await config.locator('[name="url"]').fill(PROJECT)
        await config.locator('[name="publishableKey"]').fill(PUBLIC_KEY)
        await config.locator('[type="submit"]').click()
        assert state["financial"] == 0

        async def login():
            form = page.locator('[data-asset-form="login"]')
            await form.locator('[name="email"]').fill("synthetic@example.test")
            await form.locator('[name="password"]').fill("synthetic-password")
            await form.locator('[type="submit"]').click()

        await login()
        await expect(page.locator("#asset-message")).to_contain_text("등록된 본인 계정만")
        assert state["financial"] == 0
        passed("no financial requests before login/owner approval; secret keys and other user blocked")
        state["allowed"] = True
        await login()
        await expect(page.locator("#asset-dashboard")).to_contain_text("합성 비공개")
        stored = await page.evaluate("JSON.stringify(localStorage)")
        assert TOKEN not in stored and "synthetic-password" not in stored and "합성 비공개" not in stored
        passed("owner-authenticated dashboard; token/password/financial data absent from localStorage")

        await page.locator(".asset-tools details").nth(0).locator("summary").click()
        form = page.locator('[data-asset-form="account"]')
        await form.locator('[name="label"]').fill("브라우저 합성 은행")
        await form.locator('[name="balance"]').fill("10000")
        await form.locator('[type="submit"]').click()
        await expect(page.locator("#asset-dashboard")).to_contain_text("브라우저 합성 은행")
        await page.locator(".asset-tools details").nth(1).locator("summary").click()
        form = page.locator('[data-asset-form="payment"]')
        await form.locator('[name="label"]').fill("브라우저 합성 납부")
        await form.locator('[name="due_date"]').fill("2027-06-01")
        await form.locator('[name="amount"]').fill("1000")
        await form.locator('[type="submit"]').click()
        payment = page.locator(".asset-payment").filter(has_text="브라우저 합성 납부")
        await payment.locator("button").click()
        await expect(payment.locator(".asset-payment-status")).to_have_text("납부 완료")
        passed("account and housing-payment creation and paid status")

        csv = "고객명,DO-NOT-STORE\n계좌번호,000-000000-00\n종목명,수량,평가금액,매입금액\n브라우저 합성 ETF,10,12000,10000"
        async def select_file(contents, name, account_id, cash):
            await page.locator('[data-upload="file"]').set_input_files({"name": name, "mimeType": "text/csv" if name.endswith("csv") else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "buffer": contents})
            await expect(page.locator(".asset-upload-preview")).to_be_visible()
            await page.locator('[data-upload="account"]').select_option(account_id)
            await page.locator('[data-upload="cash"]').fill(str(cash))
            await page.locator('[data-upload="confirm"]').check()
            await expect(page.locator('[data-upload-form] [type="submit"]')).to_be_enabled()

        await select_file(csv.encode(), "synthetic.csv", ids["sample-broker"], 0)
        assert "DO-NOT-STORE" not in await page.locator("#asset-import").inner_text()
        await page.locator('[data-upload-form] [type="submit"]').click()
        await expect(page.locator("#asset-dashboard")).to_contain_text("브라우저 합성 ETF")
        assert len(state["imports"]) == 1
        await select_file(csv.encode(), "renamed.csv", ids["sample-broker"], 0)
        await page.locator('[data-upload-form] [type="submit"]').click()
        await expect(page.locator("#asset-import .asset-message")).to_contain_text("이미 등록된 데이터")
        assert len(state["imports"]) == 1
        passed("CSV preview/privacy, save and duplicate response")

        await page.locator('[data-upload-clear]').click()
        await select_file(xlsx, "synthetic.xlsx", ids["sample-pension"], 100)
        await expect(page.locator('[data-upload="kind"]')).to_have_value("retirement")
        await page.locator('[data-upload-form] [type="submit"]').click()
        await expect(page.locator("#asset-dashboard")).to_contain_text("브라우저 합성 연금 ETF")
        assert len(state["imports"]) == 2
        passed("actual XLSX Web Worker, retirement inference, preview, save and dashboard update")

        invalid = "종목명,수량,평가금액,매입금액\n합성 오류,1,-10,10"
        await page.locator('[data-upload="file"]').set_input_files({"name": "synthetic-invalid.csv", "mimeType": "text/csv", "buffer": invalid.encode()})
        await expect(page.locator(".asset-validation")).to_be_visible()
        await expect(page.locator('[data-upload-form] [type="submit"]')).to_be_disabled()
        passed("invalid import is blocked")

        state["delay"] = True
        await page.locator('[data-asset-action="reload"]').click()
        await page.locator('[data-asset-action="logout"]').click()
        release.set()
        await expect(page.locator("#asset-dashboard")).to_be_empty()
        await expect(page.locator("#asset-import")).to_have_count(0)
        assert "합성 비공개" not in await page.locator("#asset-workspace").inner_text()
        await page.locator('[data-tab="personal"]').click()
        await expect(page.locator("#link-counter")).to_have_text("16 LINKS")
        passed("logout clears financial/upload UI during in-flight data read; legacy tabs remain public")

        await page.goto(BASE + "/?view=assets", wait_until="domcontentloaded")
        await expect(page.locator(".asset-mode-badge")).to_have_text("샘플 데이터")
        await expect(page.locator("#asset-workspace")).to_be_visible()
        assert not page_errors, page_errors
        passed("asset deep link/reload returns to sample mode; no uncaught JavaScript errors")

        recovery_context = await browser.new_context(viewport={"width": 390, "height": 844})
        recovery_page = await recovery_context.new_page()
        recovery_page.on("pageerror", lambda error: page_errors.append(str(error)))
        recovery_calls = []
        async def recovery_config(route):
            await route.fulfill(content_type="text/javascript", body="export default " + json.dumps({"url": PROJECT, "publishableKey": PUBLIC_KEY}) + ";")
        async def recovery_backend(route):
            request = route.request
            headers = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS", "Content-Type": "application/json"}
            if request.method == "OPTIONS":
                await route.fulfill(status=204, headers=headers)
                return
            path = request.url.removeprefix(PROJECT)
            recovery_calls.append((path, request.method, request.post_data_json if request.post_data else None))
            assert not any(table in path for table in ["asset_accounts", "asset_holdings", "asset_payments", "asset_snapshots", "asset_imports"])
            if path == "/auth/v1/user":
                result = {"id": "synthetic-owner"}
            elif path == "/rest/v1/rpc/asset_access_allowed":
                result = True
            elif path.startswith("/auth/v1/recover?") or path == "/auth/v1/logout":
                result = {}
            else:
                raise AssertionError("Unexpected password setup request")
            await route.fulfill(headers=headers, body=json.dumps(result))
        await recovery_page.route("**/assets/public-config.mjs", recovery_config)
        await recovery_page.route(PROJECT + "/**", recovery_backend)
        recovery_url = BASE + "/assets/password.html"
        await recovery_page.goto(recovery_url, wait_until="domcontentloaded")
        await expect(recovery_page.locator('[name="email"]')).to_be_visible()
        assert not recovery_calls
        await recovery_page.locator('[name="email"]').fill("synthetic@example.test")
        await recovery_page.locator('button[type="submit"]').click()
        await expect(recovery_page.locator("#password-setup")).to_contain_text("등록된 이메일이면")
        assert len(recovery_calls) == 1 and "redirect_to=" in recovery_calls[0][0]
        await recovery_page.goto(recovery_url + "#error=access_denied&error_code=otp_expired", wait_until="domcontentloaded")
        await expect(recovery_page.locator("#password-setup")).to_contain_text("유효하지 않거나 만료")
        assert recovery_page.url == recovery_url and len(recovery_calls) == 1
        await recovery_page.goto(recovery_url + "#access_token=synthetic-recovery&refresh_token=synthetic-do-not-store&type=recovery&expires_in=900", wait_until="domcontentloaded")
        await expect(recovery_page.locator('[name="password"]')).to_be_visible()
        assert recovery_page.url == recovery_url
        await recovery_page.locator('[name="password"]').fill("synthetic-new-password")
        await recovery_page.locator('[name="confirmation"]').fill("synthetic-wrong-password")
        await recovery_page.locator('button[type="submit"]').click()
        await expect(recovery_page.locator("#password-setup")).to_contain_text("일치하지")
        assert not any(call[1] == "PUT" for call in recovery_calls)
        await recovery_page.locator('[name="password"]').fill("synthetic-new-password")
        await recovery_page.locator('[name="confirmation"]').fill("synthetic-new-password")
        await recovery_page.locator('button[type="submit"]').click()
        await expect(recovery_page.locator("#password-setup")).to_contain_text("비밀번호를 저장했습니다")
        assert [call[2] for call in recovery_calls if call[1] == "PUT"] == [{"password": "synthetic-new-password"}]
        assert await recovery_page.evaluate("localStorage.length + sessionStorage.length") == 0
        assert await recovery_page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        await recovery_page.screenshot(path=str(screenshots / "password-setup-mobile.png"), full_page=True)
        assert not page_errors, page_errors
        passed("password setup email, expired link, owner verification, mismatch and save; URL/storage privacy and mobile layout")
        await recovery_context.close()
        await context.close()
        await browser.close()
    print(f"{len(checks)} browser scenario groups passed. Synthetic/mock Supabase only.", flush=True)
    print("Screenshots:", screenshots, flush=True)


if __name__ == "__main__":
    asyncio.run(main())
