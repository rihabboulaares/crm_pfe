from playwright.sync_api import sync_playwright
import time
import re


SEARCH_QUERY = "emna mnasri"


# =========================
# CLEAN FUNCTION (IMPORTANT)
# =========================
def clean_text(text: str) -> str:
    lines = text.split("\n")
    cleaned = []

    for line in lines:
        line = line.strip()

        # enlever bruit Facebook
        if not line:
            continue
        if len(line) < 2:
            continue
        if line.isdigit():
            continue
        if line in ["·", "See more", "En voir plus", "Like", "Comment", "Share"]:
            continue

        # supprimer lignes avec trop de caractères bizarres
        if re.search(r"[^\w\sÀ-ÿ.,!?/:()\-]", line) and len(line) < 10:
            continue

        cleaned.append(line)

    return "\n".join(cleaned)


# =========================
# MAIN SCRAPER
# =========================
with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)

    # session login
    try:
        context = browser.new_context(storage_state="fb_state.json")
        print("✅ Session chargée")
    except:
        context = browser.new_context()
        print("⚠️ Pas de session")

    page = context.new_page()

    # =========================
    # OPEN FACEBOOK
    # =========================
    page.goto("https://www.facebook.com")

    page.wait_for_timeout(5000)

    print("👉 Login si nécessaire")
    input("ENTER après login...")

    # save session
    context.storage_state(path="fb_state.json")
    print("💾 Session sauvegardée")

    # =========================
    # SEARCH
    # =========================
    print("🔍 Recherche...")

    search_box = page.locator("input[type='search']").first
    search_box.wait_for(timeout=20000)

    search_box.click()
    search_box.fill(SEARCH_QUERY)
    search_box.press("Enter")

    page.wait_for_timeout(7000)

    # wait posts
    page.locator("div[role='article']").first.wait_for(timeout=20000)

    print("✅ Résultats chargés")

    # =========================
    # SCROLL
    # =========================
    for _ in range(3):
        page.mouse.wheel(0, 2500)
        time.sleep(2)

    # =========================
    # EXTRACTION PROPRE
    # =========================
    posts = page.locator("div[role='article']")
    count = posts.count()

    print(f"\n📊 POSTS TROUVÉS: {count}\n")

    results = []

    for i in range(min(count, 5)):
        try:
            raw = posts.nth(i).inner_text()
            text = clean_text(raw)

            if len(text) < 30:
                continue

            result = {
                "id": i + 1,
                "content": text[:800]
            }

            results.append(result)

            print("===================================")
            print(f"POST {i+1}")
            print(text[:800])

        except:
            pass

    # =========================
    # SAVE DEBUG SCREENSHOT
    # =========================
    page.screenshot(path="facebook_clean_results.png", full_page=True)
    print("\n📸 Screenshot saved")

    # =========================
    # SUMMARY
    # =========================
    print("\n🔥 SUMMARY:")
    print(f"Posts propres extraits: {len(results)}")

    input("ENTER pour fermer...")

    browser.close()