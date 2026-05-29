from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=False
    )

    context = browser.new_context()

    page = context.new_page()

    page.goto("https://facebook.com")

    print("👉 Connecte-toi puis ENTER")

    input()

    context.storage_state(
        path="agentProspection/sessions/fb_state.json"
    )

    print("✅ Session Facebook sauvegardée")

    browser.close()