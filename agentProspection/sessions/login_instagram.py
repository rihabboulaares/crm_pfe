from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=False
    )

    context = browser.new_context()

    page = context.new_page()

    page.goto("https://instagram.com")

    print("👉 Connecte-toi puis ENTER")

    input()

    context.storage_state(
        path="agentProspection/sessions/ig_state.json"
    )

    print("✅ Session Instagram sauvegardée")

    browser.close()