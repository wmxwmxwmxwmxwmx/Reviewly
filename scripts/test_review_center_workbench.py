"""Playwright E2E: AI Review Center workbench business + navigation logic."""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from dataclasses import dataclass, field

from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"
GATEWAY = "http://localhost:3001"
WORKBENCH_URL = f"{BASE}/?view=ai-review&reviewTab=dashboard"

MOCK_USER = {
    "id": "e2e-user",
    "githubId": "e2e",
    "username": "e2e-tester",
    "name": "E2E Tester",
    "email": None,
    "avatarUrl": None,
}


@dataclass
class TestReport:
    passed: list[str] = field(default_factory=list)
    failed: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def ok(self, msg: str) -> None:
        self.passed.append(msg)
        print(f"  [OK] {msg}")

    def fail(self, msg: str) -> None:
        self.failed.append(msg)
        print(f"  [FAIL] {msg}")

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)
        print(f"  [WARN] {msg}")


def fetch_api(path: str) -> dict:
    with urllib.request.urlopen(f"{GATEWAY}{path}", timeout=15) as resp:
        return json.loads(resp.read().decode())


def workbench_root(page):
    return page.locator("h2").filter(has_text="工作台").locator(
        "xpath=ancestor::div[contains(@class,'space-y-6')][1]"
    )


def review_center_nav(page):
    return page.locator("nav.flex.flex-wrap")


def parse_metric(page, label: str) -> int | None:
    grid = workbench_root(page).locator("> div.grid").first
    card = grid.locator("button, div.rounded-lg.border").filter(has_text=label)
    if card.count() == 0:
        return None
    text = card.first.inner_text()
    for line in text.splitlines():
        line = line.strip()
        if line.isdigit():
            return int(line)
    return None


def parse_status_count(page, label: str) -> int | None:
    section = page.locator("h3").filter(has_text="状态分布").locator("xpath=..")
    block = section.locator("button.rounded-md").filter(has_text=label)
    if block.count() == 0:
        return None
    text = block.first.inner_text()
    for line in text.splitlines():
        line = line.strip()
        if line.isdigit():
            return int(line)
    return None


def setup_auth(page) -> None:
    page.add_init_script(
        'localStorage.setItem("prism_auth_token", "e2e-playwright-token");'
    )

    def route_handler(route):
        url = route.request.url
        if "/api/auth/me" in url:
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(MOCK_USER),
            )
            return
        if "/api/" in url:
            headers = dict(route.request.headers)
            headers.pop("authorization", None)
            headers.pop("Authorization", None)
            try:
                response = route.fetch(headers=headers)
                route.fulfill(response=response)
            except Exception as exc:
                route.abort(f"failed: {exc}")
            return
        route.continue_()

    page.route("**/api/**", route_handler)


def run() -> int:
    report = TestReport()

    try:
        api = fetch_api("/api/review-center/dashboard")
        status_counts = api.get("statusCounts") or fetch_api("/api/review-center/status-counts")
    except Exception as e:
        print(f"Gateway unreachable: {e}")
        return 1

    report.ok(f"API dashboard: weeklyApprovals={api.get('weeklyApprovals')}, aiFindings={api.get('aiFindingsThisWeek')}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        setup_auth(page)

        page.goto(WORKBENCH_URL)
        page.wait_for_load_state("networkidle")

        if "/login" in page.url:
            report.fail("未登录且 auth mock 失败，被重定向到 /login")
            browser.close()
            return 1

        page.wait_for_selector("h2:has-text('工作台')", timeout=15000)

        if page.locator("text=加载工作台").count() > 0:
            page.wait_for_selector("text=加载工作台", state="hidden", timeout=15000)

        if page.locator("text=加载失败").count() > 0:
            report.fail("工作台 API 加载失败，页面显示错误")
            browser.close()
            return 1

        report.ok("工作台页面加载成功")

        metric_map = [
            ("待我处理", api.get("pendingReview")),
            ("进行中 PR", api.get("inReview")),
            ("我创建的 PR", api.get("myCreated")),
            ("高风险 PR", api.get("highRisk")),
            ("本周审批数量", api.get("weeklyApprovals")),
            ("AI 发现问题", api.get("aiFindingsThisWeek")),
        ]
        for label, expected in metric_map:
            ui_val = parse_metric(page, label)
            if ui_val is None:
                report.fail(f"未找到指标卡片「{label}」")
            elif ui_val != expected:
                report.fail(f"「{label}」UI={ui_val} 与 API={expected} 不一致")
            else:
                report.ok(f"「{label}」= {expected}（与 API 一致）")

        status_map = [
            ("待评审", "OPEN"),
            ("评审中", "IN_REVIEW"),
            ("待修改", "CHANGES_REQUESTED"),
            ("已通过", "APPROVED"),
            ("已合并", "MERGED"),
        ]
        for label, key in status_map:
            ui_val = parse_status_count(page, label)
            expected = status_counts.get(key, 0)
            if ui_val is None:
                report.fail(f"未找到状态分布「{label}」")
            elif ui_val != expected:
                report.fail(f"状态「{label}」UI={ui_val} 与 API={expected} 不一致")
            else:
                report.ok(f"状态「{label}」= {expected}（与 API 一致）")

        page.locator("button").filter(has_text="待我处理").first.click()
        page.wait_for_load_state("networkidle")
        expect(page).to_have_url(re.compile(r"reviewTab=pending"))
        pending_tab = page.get_by_role("button", name="我的待审批")
        expect(pending_tab).to_have_class(re.compile(r"text-ai-blue"))
        report.ok("点击「待我处理」→ reviewTab=pending + Tab 高亮")

        page.goto(WORKBENCH_URL)
        page.wait_for_load_state("networkidle")
        page.wait_for_selector("h2:has-text('工作台')")

        page.locator("button").filter(has_text="高风险 PR").first.click()
        page.wait_for_load_state("networkidle")
        expect(page).to_have_url(re.compile(r"reviewTab=all"))
        expect(page).to_have_url(re.compile(r"prFilter=high-risk"))
        report.ok("点击「高风险 PR」→ reviewTab=all + prFilter=high-risk")

        page.goto(WORKBENCH_URL)
        page.wait_for_load_state("networkidle")
        page.wait_for_selector("h2:has-text('工作台')")

        page.locator("button").filter(has_text="进行中 PR").first.click()
        page.wait_for_load_state("networkidle")
        expect(page).to_have_url(re.compile(r"reviewTab=all"))
        expect(page).to_have_url(re.compile(r"reviewStatus=IN_REVIEW"))
        report.ok("点击「进行中 PR」→ reviewTab=all + reviewStatus=IN_REVIEW")

        page.goto(WORKBENCH_URL)
        page.wait_for_load_state("networkidle")
        page.locator("button").filter(has_text="本周审批数量").first.click()
        page.wait_for_load_state("networkidle")
        expect(page).to_have_url(re.compile(r"reviewTab=stats"))
        report.ok("点击「本周审批数量」→ reviewTab=stats")

        page.goto(WORKBENCH_URL)
        page.wait_for_load_state("networkidle")
        page.locator("button").filter(has_text="AI 发现问题").first.click()
        page.wait_for_load_state("networkidle")
        expect(page).to_have_url(re.compile(r"view=findings"))
        report.ok("点击「AI 发现问题」→ view=findings")

        tabs = [
            ("工作台", "dashboard", "h2:has-text('工作台')"),
            ("我的待审批", "pending", "h2:has-text('我的待审批')"),
            ("全部 PR", "all", "h2:has-text('全部 PR')"),
            ("审批规则", "rules", "h2:has-text('审批规则')"),
            ("数据统计", "stats", "h2:has-text('数据统计')"),
            ("设置", "settings", "h2:has-text('评审中心设置')"),
        ]
        page.goto(WORKBENCH_URL)
        page.wait_for_load_state("networkidle")
        page.wait_for_selector("h2:has-text('工作台')")

        for label, tab_key, content_hint in tabs:
            review_center_nav(page).get_by_role("button", name=label, exact=True).click()
            page.wait_for_load_state("networkidle")
            expect(page).to_have_url(re.compile(rf"reviewTab={tab_key}"))
            if content_hint:
                page.wait_for_selector(content_hint, timeout=8000)
            report.ok(f"Tab「{label}」→ reviewTab={tab_key}")

        page.goto(WORKBENCH_URL)
        page.wait_for_load_state("networkidle")
        page.locator("h3:has-text('状态分布')").locator("..").get_by_role("button", name="待评审").click()
        page.wait_for_load_state("networkidle")
        expect(page).to_have_url(re.compile(r"reviewTab=all"))
        expect(page).to_have_url(re.compile(r"reviewStatus=OPEN"))
        report.ok("点击状态分布「待评审」→ reviewTab=all + reviewStatus=OPEN")

        page.goto(WORKBENCH_URL)
        page.wait_for_load_state("networkidle")
        import_btn = page.get_by_role("button", name=re.compile(r"导入\s*PR"))
        if import_btn.count() > 0:
            import_btn.first.click()
            page.wait_for_selector("text=GitHub PR 链接", timeout=8000)
            report.ok("「导入 PR」打开弹窗")
            page.keyboard.press("Escape")
        else:
            report.warn("未找到「导入 PR」按钮")

        page.screenshot(path="scripts/review-center-workbench-test.png", full_page=True)
        browser.close()

    print("\n=== 测试摘要 ===")
    print(f"通过: {len(report.passed)}")
    print(f"失败: {len(report.failed)}")
    print(f"建议: {len(report.warnings)}")
    if report.failed:
        print("\n失败项:")
        for f in report.failed:
            print(f"  - {f}")
    if report.warnings:
        print("\n体验建议:")
        for w in report.warnings:
            print(f"  - {w}")
    return 1 if report.failed else 0


if __name__ == "__main__":
    sys.exit(run())
