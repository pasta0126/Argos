from functools import cached_property

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration, read from the environment (and a local .env in dev)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Comma-separated `id:key` pairs, one per client, e.g. "kaizen:abc,cli:def".
    # The id only appears in logs; removing a pair revokes that key.
    argos_api_keys: str

    # Hugging Face commit of convaiinnovations/laya, pinned so weights cannot
    # change under a running deployment. Empty means "latest" (dev only).
    argos_model_revision: str = ""
    # Torch intra-op threads. The Pi has 4 cores; keep one for other services.
    argos_threads: int = 3
    # Requests allowed to wait while an inference is running; beyond -> 503.
    argos_max_queue: int = 4
    # Comma-separated browser origins allowed to call the API (the web wizard). Empty disables CORS.
    argos_cors_origins: str = "https://argos.northernarchive.com"

    @field_validator("argos_api_keys")
    @classmethod
    def _keys_present(cls, value: str) -> str:
        parse_api_keys(value)
        return value

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.argos_cors_origins.split(",") if o.strip()]

    @cached_property
    def api_keys(self) -> dict[str, str]:
        """Key -> client id."""
        return parse_api_keys(self.argos_api_keys)


def parse_api_keys(raw: str) -> dict[str, str]:
    keys: dict[str, str] = {}
    for pair in raw.split(","):
        pair = pair.strip()
        if not pair:
            continue
        client_id, sep, key = pair.partition(":")
        client_id, key = client_id.strip(), key.strip()
        if not sep or not client_id or not key:
            raise ValueError(f"ARGOS_API_KEYS entries must be 'id:key' (bad entry for id {client_id!r})")
        if key in keys:
            raise ValueError(f"ARGOS_API_KEYS: duplicate key for ids {keys[key]!r} and {client_id!r}")
        keys[key] = client_id
    if not keys:
        raise ValueError("no API keys configured: set ARGOS_API_KEYS")
    return keys
