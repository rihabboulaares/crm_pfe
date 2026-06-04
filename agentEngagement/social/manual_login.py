def wait_manual_login(page, platform, timeout_ms=300000):
    print(f"[login] Connexion {platform} requise.")
    print("[login] Ecrivez vos identifiants dans la fenetre ouverte.")
    print("[login] Le script est en pause pendant la connexion...")

    try:
        if platform == "instagram":
            page.wait_for_url(
                lambda url: "accounts/login" not in url.lower()
                and "challenge" not in url.lower(),
                timeout=timeout_ms,
            )
        elif platform == "facebook":
            page.wait_for_url(
                lambda url: "login" not in url.lower()
                and "checkpoint" not in url.lower(),
                timeout=timeout_ms,
            )

        page.wait_for_timeout(5000)
        print(f"[login] Connexion {platform} terminee.")
        return True

    except Exception:
        print(f"[login] Connexion {platform} non terminee.")
        return False


def instagram_login_required(page) -> bool:
    url = (page.url or "").lower()
    return (
        "accounts/login" in url
        or page.locator("input[name='username']").count() > 0
        or page.locator("input[name='password']").count() > 0
    )


def facebook_login_required(page) -> bool:
    url = (page.url or "").lower()
    return (
        "login" in url
        or page.locator("input[name='email']").count() > 0
        or page.locator("input[name='pass']").count() > 0
    )
