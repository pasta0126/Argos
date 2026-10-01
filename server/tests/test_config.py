import pytest
from pydantic import ValidationError

from argos_api.config import Settings, parse_api_keys


def test_parses_named_keys():
    assert parse_api_keys(" kaizen:abc , cli:def ") == {"abc": "kaizen", "def": "cli"}


@pytest.mark.parametrize("raw", ["", " , ", "nokey", "id:", ":key"])
def test_rejects_bad_or_empty_keys(raw):
    with pytest.raises(ValueError):
        parse_api_keys(raw)


def test_rejects_duplicate_key():
    with pytest.raises(ValueError, match="duplicate"):
        parse_api_keys("a:same,b:same")


def test_settings_fail_without_keys(monkeypatch):
    monkeypatch.delenv("ARGOS_API_KEYS", raising=False)
    with pytest.raises(ValidationError):
        Settings(_env_file=None)
    with pytest.raises(ValidationError, match="no API keys configured"):
        Settings(_env_file=None, argos_api_keys="")
