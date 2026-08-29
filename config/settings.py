"""
Django settings for config project.
"""
import os
import sys
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent


load_dotenv(BASE_DIR / ".env")


def env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


DJANGO_ENV = os.environ.get("DJANGO_ENV", "development").strip().lower()
DEBUG = env_bool("DEBUG", DJANGO_ENV != "production")
CRM_AGENT_DEBUG_TRACE = env_bool("CRM_AGENT_DEBUG_TRACE", DEBUG)

SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError("SECRET_KEY must be configured when DEBUG=False.")
    SECRET_KEY = "django-insecure-dev-only-change-me"

ALLOWED_HOSTS = env_list(
    "ALLOWED_HOSTS",
    "localhost,127.0.0.1,38.242.204.96" if DEBUG else "",
)

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'whitenoise.runserver_nostatic',
    # third party
    'rest_framework',
    'corsheaders',
    # local
    'users',
    'sales.apps.SalesConfig',
    'subscriptions.apps.SubscriptionsConfig',  # ← avec apps.py pour charger signals.py
    'superadmin.apps.SuperadminConfig',
    'Notifications',
    'calendar_module',
    "agentProspection",
    "agentEngagement",
    "agentQualification",
    
    
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'subscriptions.middleware.SubscriptionMiddleware',   # ← AJOUTÉ ICI
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'Notifications.middleware.CurrentUserMiddleware',
]

CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://38.242.204.96:3000,http://38.242.204.96"
    if DEBUG
    else "",
)

CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", ",".join(CORS_ALLOWED_ORIGINS))

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME", "crm_db"),
        "USER": os.environ.get("DB_USER", "postgres"),
        "PASSWORD": os.environ.get("DB_PASSWORD", ""),
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT", "5432"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = "users.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "sales.pagination.StandardPagination",
    "PAGE_SIZE": 10,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ── Email ─────────────────────────────────────────────────────
# Email
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND",
    "django.core.mail.backends.smtp.EmailBackend"
)

EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", 587))
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "True") == "True"

EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD")
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER)

AUTH_EMAIL_RESEND_COOLDOWN_SECONDS = int(
    os.environ.get("AUTH_EMAIL_RESEND_COOLDOWN_SECONDS", "60")
)
AUTH_EMAIL_MAX_PER_HOUR = int(os.environ.get("AUTH_EMAIL_MAX_PER_HOUR", "5"))
AUTH_VERIFICATION_CODE_TTL_MINUTES = int(
    os.environ.get("AUTH_VERIFICATION_CODE_TTL_MINUTES", "30")
)
AUTH_PASSWORD_RESET_CODE_TTL_MINUTES = int(
    os.environ.get("AUTH_PASSWORD_RESET_CODE_TTL_MINUTES", "15")
)
AUTH_TERMS_VERSION = os.environ.get("AUTH_TERMS_VERSION", "2026-08-25")

# OAuth email providers for agentEngagement commercial email sending.
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get(
    "GOOGLE_REDIRECT_URI",
    "http://localhost:8000/api/engagement/connections/google/callback/",
)
MICROSOFT_CLIENT_ID = os.environ.get("MICROSOFT_CLIENT_ID", "")
MICROSOFT_CLIENT_SECRET = os.environ.get("MICROSOFT_CLIENT_SECRET", "")
MICROSOFT_TENANT_ID = os.environ.get("MICROSOFT_TENANT_ID", "common")
MICROSOFT_REDIRECT_URI = os.environ.get(
    "MICROSOFT_REDIRECT_URI",
    "http://localhost:8000/api/engagement/connections/microsoft/callback/",
)

# ── Stripe ────────────────────────────────────────────────────

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")

STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY")

STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")
FRONTEND_URL = os.environ.get(
    "FRONTEND_URL",
    "http://localhost:3000"
)

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
PROSPECTION_GEMINI_API_KEY = GEMINI_API_KEY
PROSPECTION_GEMINI_ENABLED = env_bool("PROSPECTION_GEMINI_ENABLED", True)
GEMINI_MODEL = os.environ.get(
    "GEMINI_MODEL",
    os.environ.get("GEMINI_CHAT_MODEL", "gemini-2.5-flash")
)

GEMINI_CHAT_MODEL = os.environ.get("GEMINI_CHAT_MODEL", GEMINI_MODEL)
GEMINI_EMBEDDING_MODEL = os.environ.get(
    "GEMINI_EMBEDDING_MODEL",
    "models/gemini-embedding-001"
)
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
PROSPECTION_REDIS_TTL_SECONDS = int(os.environ.get("PROSPECTION_REDIS_TTL_SECONDS", "1800"))

PROSPECTION_VECTOR_STORE = os.environ.get("PROSPECTION_VECTOR_STORE", "chroma")
PROSPECTION_CHROMA_DIR = os.environ.get("PROSPECTION_CHROMA_DIR", str(BASE_DIR / "chroma_db"))

PROSPECTION_MAX_RESULTS = int(os.environ.get("PROSPECTION_MAX_RESULTS", "10"))
PROSPECTION_LLM_TIMEOUT = int(os.environ.get("PROSPECTION_LLM_TIMEOUT", "45"))
PROSPECTION_GEMINI_MAX_OUTPUT_TOKENS = int(os.environ.get("PROSPECTION_GEMINI_MAX_OUTPUT_TOKENS", "512"))
PROSPECTION_GEMINI_SDK_ATTEMPTS = int(os.environ.get("PROSPECTION_GEMINI_SDK_ATTEMPTS", "1"))
PROSPECTION_GEMINI_APP_RETRIES = int(os.environ.get("PROSPECTION_GEMINI_APP_RETRIES", "0"))
PROSPECTION_GEMINI_RETRY_DELAY_SECONDS = float(os.environ.get("PROSPECTION_GEMINI_RETRY_DELAY_SECONDS", "1.0"))
PROSPECTION_GEMINI_MAX_RETRY_DELAY_SECONDS = float(os.environ.get("PROSPECTION_GEMINI_MAX_RETRY_DELAY_SECONDS", "3.0"))
PROSPECTION_GEMINI_CIRCUIT_FAILURES = int(os.environ.get("PROSPECTION_GEMINI_CIRCUIT_FAILURES", "1"))
PROSPECTION_GEMINI_CIRCUIT_COOLDOWN_SECONDS = int(os.environ.get("PROSPECTION_GEMINI_CIRCUIT_COOLDOWN_SECONDS", "300"))
PROSPECTION_DISCOVERY_MAX_ITERATIONS = int(os.environ.get("PROSPECTION_DISCOVERY_MAX_ITERATIONS", "8"))
PROSPECTION_DISCOVERY_TIMEOUT = int(os.environ.get("PROSPECTION_DISCOVERY_TIMEOUT", "120"))
PROSPECTION_DISCOVERY_MAX_RESULTS = int(os.environ.get("PROSPECTION_DISCOVERY_MAX_RESULTS", "50"))
PROSPECTION_DISCOVERY_MAX_QUERIES = int(os.environ.get("PROSPECTION_DISCOVERY_MAX_QUERIES", "10"))
PROSPECTION_DISCOVERY_MAX_QUERY_REFINEMENTS = int(os.environ.get("PROSPECTION_DISCOVERY_MAX_QUERY_REFINEMENTS", "3"))
PROSPECTION_DISCOVERY_RESULT_SAMPLE_SIZE = int(os.environ.get("PROSPECTION_DISCOVERY_RESULT_SAMPLE_SIZE", "15"))
PROSPECTION_ENRICHMENT_MAX_ITERATIONS = int(os.environ.get("PROSPECTION_ENRICHMENT_MAX_ITERATIONS", "10"))
PROSPECTION_ENRICHMENT_TIMEOUT = int(os.environ.get("PROSPECTION_ENRICHMENT_TIMEOUT", "180"))
PROSPECTION_ENRICHMENT_MAX_SOURCES = int(os.environ.get("PROSPECTION_ENRICHMENT_MAX_SOURCES", "4"))
PROSPECTION_ENRICHMENT_MAX_WEBSITE_PAGES = int(os.environ.get("PROSPECTION_ENRICHMENT_MAX_WEBSITE_PAGES", "3"))
PROSPECTION_ENRICHMENT_MAX_SOURCE_RETRIES = int(os.environ.get("PROSPECTION_ENRICHMENT_MAX_SOURCE_RETRIES", "1"))
PROSPECTION_ENRICHMENT_MAX_CONTENT_CHARS = int(os.environ.get("PROSPECTION_ENRICHMENT_MAX_CONTENT_CHARS", "30000"))
PROSPECTION_ENRICHMENT_MAX_SOURCE_CONTENT_CHARS = int(os.environ.get("PROSPECTION_ENRICHMENT_MAX_SOURCE_CONTENT_CHARS", "12000"))
PROSPECTION_SESSION_LOCK_TTL = int(os.environ.get("PROSPECTION_SESSION_LOCK_TTL", "300"))

# ============================================================
# META ADS LIBRARY MCP
# ============================================================

META_ADS_MCP_ENABLED = os.environ.get(
    "META_ADS_MCP_ENABLED",
    "false"
).lower() in {
    "1",
    "true",
    "yes",
    "on",
}

META_ADS_MCP_TRANSPORT = os.environ.get(
    "META_ADS_MCP_TRANSPORT",
    "stdio"
)

META_ADS_MCP_SERVER_NAME = os.environ.get(
    "META_ADS_MCP_SERVER_NAME",
    "viewise-meta-ads"
)

META_ADS_MCP_COMMAND = os.environ.get(
    "META_ADS_MCP_COMMAND",
    sys.executable if META_ADS_MCP_ENABLED else ""
)

META_ADS_MCP_ARGS = os.environ.get(
    "META_ADS_MCP_ARGS",
    "-m agentProspection.mcp.meta_ads_server"
    if META_ADS_MCP_ENABLED
    else ""
)

META_ADS_MCP_ENV_JSON = os.environ.get(
    "META_ADS_MCP_ENV_JSON",
    "{}"
)

META_ADS_MCP_TOOL_NAME = os.environ.get(
    "META_ADS_MCP_TOOL_NAME",
    "ads_library_search"
)

META_ADS_MCP_TIMEOUT_SECONDS = int(
    os.environ.get(
        "META_ADS_MCP_TIMEOUT_SECONDS",
        "20"
    )
)

META_ACCESS_TOKEN = os.environ.get(
    "META_ACCESS_TOKEN",
    ""
)

META_GRAPH_API_VERSION = os.environ.get(
    "META_GRAPH_API_VERSION",
    "v26.0"
)

META_GRAPH_API_BASE_URL = os.environ.get(
    "META_GRAPH_API_BASE_URL",
    "https://graph.facebook.com"
)

META_ADS_DEFAULT_COUNTRY = os.environ.get(
    "META_ADS_DEFAULT_COUNTRY",
    "TN"
)

META_ADS_DEFAULT_LANGUAGE = os.environ.get(
    "META_ADS_DEFAULT_LANGUAGE",
    "fr"
)

META_ADS_MAX_RESULTS = int(
    os.environ.get(
        "META_ADS_MAX_RESULTS",
        "50"
    )
)

META_ADS_MAX_PAGES = int(
    os.environ.get(
        "META_ADS_MAX_PAGES",
        "3"
    )
)

META_ADS_REQUEST_TIMEOUT_SECONDS = int(
    os.environ.get(
        "META_ADS_REQUEST_TIMEOUT_SECONDS",
        "20"
    )
)

# ============================================================
# DISCOVERY - LIMITES DE RECHERCHE
# ============================================================

PROSPECTION_MAX_EXTRA_SEARCHES = int(
    os.environ.get(
        "PROSPECTION_MAX_EXTRA_SEARCHES",
        "1",
    )
)

PROSPECTION_META_VERIFICATION_LIMIT = int(
    os.environ.get(
        "PROSPECTION_META_VERIFICATION_LIMIT",
        "5",
    )
)
ENGAGEMENT_AGENT_AUTO_SEND_ENABLED = False
ENGAGEMENT_AGENT_BATCH_LIMIT = 25

# settings.py
SERPAPI_KEY = os.environ.get("SERPAPI_KEY", "")  # Laisser vide → mock automatique

SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", not DEBUG)
SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", not DEBUG)
CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", not DEBUG)
SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "31536000" if not DEBUG else "0"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", not DEBUG)
SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", not DEBUG)
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = env_bool("CSRF_COOKIE_HTTPONLY", False)
SESSION_COOKIE_SAMESITE = os.environ.get("SESSION_COOKIE_SAMESITE", "Lax")
CSRF_COOKIE_SAMESITE = os.environ.get("CSRF_COOKIE_SAMESITE", "Lax")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "prospects": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
    },
}
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
]
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_URL = os.environ.get("MEDIA_URL", "/media/")
MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", BASE_DIR / "media"))

PROSPECT_DOCUMENT_MAX_SIZE = int(os.environ.get("PROSPECT_DOCUMENT_MAX_SIZE", str(10 * 1024 * 1024)))
