from playwright.sync_api import sync_playwright
import time

SEARCH_QUERY = "hadil smati"

with sync_playwright() as p:

    browser = p.chromium.launch(
        headless=False,
        slow_mo=100
    )

    # =========================
    # SESSION
    # =========================
    try:
        context = browser.new_context(
            storage_state="ig_state.json"
        )
        print("✅ Session Instagram chargée")

    except:
        context = browser.new_context()
        print("⚠️ Pas de session")

    page = context.new_page()

    # =========================
    # OPEN INSTAGRAM
    # =========================
    page.goto("https://www.instagram.com/")

    page.wait_for_timeout(5000)

    print("👉 Connecte-toi manuellement si nécessaire")
    input("ENTER après login...")

    # save session
    context.storage_state(path="ig_state.json")

    print("💾 Session sauvegardée")

    # =========================
    # SEARCH INPUT
    # =========================
    print("🔍 Recherche Instagram...")

    # ouvrir search
    page.locator("svg[aria-label='Recherche']").click()

    page.wait_for_timeout(2000)

    # input search
    search_input = page.locator("input[placeholder='Rechercher']")

    # fallback EN version
    if search_input.count() == 0:
        search_input = page.locator("input[placeholder='Search']")

    search_input.click()
    search_input.fill(SEARCH_QUERY)

    page.wait_for_timeout(5000)

    # =========================
    # EXTRACTION RESULTS
    # =========================
    links = page.locator("a")

    total = links.count()

    print(f"📊 Total liens: {total}")

    profiles = []

    for i in range(total):

        try:
            href = links.nth(i).get_attribute("href")

            if not href:
                continue

            # garder profils Instagram
            if href.startswith("/") and len(href) > 2:

                username = href.strip("/")

                # filtrage URLs inutiles
                blacklist = [
                    "explore",
                    "accounts",
                    "reels",
                    "stories",
                    "direct"
                ]

                if username in blacklist:
                    continue

                profile = {
                    "username": username,
                    "url": f"https://instagram.com{href}"
                }

                if profile not in profiles:
                    profiles.append(profile)

        except:
            pass

    # =========================
    # DISPLAY RESULTS
    # =========================
    print("\n🔥 PROFILS TROUVÉS:\n")

    for idx, profile in enumerate(profiles[:10]):

        print("====================")
        print(f"PROFILE {idx+1}")
        print("USERNAME:", profile["username"])
        print("URL:", profile["url"])

    print(f"\n📊 TOTAL: {len(profiles)} profils")

    # screenshot debug
    page.screenshot(path="instagram_results.png", full_page=True)

    input("\nENTER pour fermer...")

    browser.close()