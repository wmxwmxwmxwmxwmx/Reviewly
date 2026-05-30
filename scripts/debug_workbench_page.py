import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
url = f"{BASE}/?view=ai-review&reviewTab=dashboard"
MOCK = {"id": "e2e", "githubId": "1", "username": "t", "name": "T"}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.add_init_script('localStorage.setItem("prism_auth_token", "tok")')

    def handler(route):
        if "/api/auth/me" in route.request.url:
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(MOCK),
            )
        else:
            route.continue_()

    page.route("**/api/auth/**", handler)
    page.goto(url)
    page.wait_for_load_state("networkidle")
    print("URL:", page.url)
    page.screenshot(path="scripts/debug-workbench.png", full_page=True)
    body = page.inner_text("body")
    print("BODY:", body[:1200])
    browser.close()
