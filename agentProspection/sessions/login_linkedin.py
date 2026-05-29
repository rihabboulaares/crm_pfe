from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=False
    )

    context = browser.new_context()

    page = context.new_page()

    page.goto("https://linkedin.com")

    print("👉 Connecte-toi puis ENTER")

    input()

    context.storage_state(
        path="agentProspection/sessions/li_state.json"
    )

    print("✅ Session LinkedIn sauvegardée")

    browser.close()