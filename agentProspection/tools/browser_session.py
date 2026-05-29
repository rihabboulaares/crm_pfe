from pathlib import Path


STATE_DIR = Path("agentProspection/sessions")
STATE_DIR.mkdir(parents=True, exist_ok=True)


async def get_context(browser, state_file: str | None = None):

    if state_file:
        path = STATE_DIR / state_file

        if path.exists():
            return await browser.new_context(
                storage_state=str(path)
            )

    return await browser.new_context(
        viewport={"width": 1366, "height": 768},
        locale="fr-FR",
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    )


async def save_context(context, state_file: str | None = None):

    if not state_file:
        return

    path = STATE_DIR / state_file

    await context.storage_state(
        path=str(path)
    )