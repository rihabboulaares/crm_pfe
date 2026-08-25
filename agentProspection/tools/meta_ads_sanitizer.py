from urllib.parse import (
    parse_qsl,
    urlencode,
    urlsplit,
    urlunsplit,
)


SENSITIVE_META_QUERY_PARAMS = {
    "access_token",
}


def sanitize_meta_url(
    url: str | None,
) -> str | None:
    """
    Supprime les paramètres sensibles Meta d'une URL.
    """

    if not url:
        return url

    try:
        parsed = urlsplit(
            str(url)
        )

    except Exception:
        return url

    query = [
        (
            key,
            value,
        )
        for key, value
        in parse_qsl(
            parsed.query,
            keep_blank_values=True,
        )
        if (
            key.lower()
            not in SENSITIVE_META_QUERY_PARAMS
        )
    ]

    return urlunsplit(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            urlencode(
                query,
                doseq=True,
            ),
            parsed.fragment,
        )
    )


def sanitize_meta_payload(
    value,
):
    """
    Nettoyage récursif des réponses Meta.

    Les tokens ne doivent jamais apparaître dans :
    - les résultats ;
    - les logs ;
    - les rapports ;
    - les URL retournées.
    """

    if isinstance(
        value,
        dict,
    ):

        sanitized = {}

        for key, item in (
            value.items()
        ):

            if (
                str(
                    key
                ).lower()
                in SENSITIVE_META_QUERY_PARAMS
            ):
                continue

            sanitized[
                key
            ] = (
                sanitize_meta_payload(
                    item
                )
            )

        return sanitized

    if isinstance(
        value,
        list,
    ):

        return [
            sanitize_meta_payload(
                item
            )
            for item
            in value
        ]

    if isinstance(
        value,
        tuple,
    ):

        return tuple(
            sanitize_meta_payload(
                item
            )
            for item
            in value
        )

    if (
        isinstance(
            value,
            str,
        )
        and "access_token="
        in value.lower()
    ):
        return sanitize_meta_url(
            value
        )

    return value