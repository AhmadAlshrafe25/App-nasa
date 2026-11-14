from dataclasses import dataclass, field
import os
from pathlib import Path
from urllib.parse import urlsplit


@dataclass(frozen=True)
class Settings:
    db_path: Path = Path(__file__).resolve().parents[1] / "astronaut_health.db"
    anomaly_method: str = "baseline"
    force_offline: bool = False
    llm_api_key: str = field(default="", repr=False)
    llm_base_url: str = ""
    llm_model: str = ""

    def __post_init__(self):
        if self.anomaly_method not in ("baseline", "isolation_forest"):
            raise ValueError("SPACEHEALTH_ANOMALY_METHOD must be baseline or isolation_forest")
        if self.llm_base_url:
            url = urlsplit(self.llm_base_url)
            if (url.scheme != "https" and not (url.scheme == "http" and url.hostname in ("localhost", "127.0.0.1", "::1"))) or not url.hostname or url.username or url.password or url.query or url.fragment:
                raise ValueError("LLM_BASE_URL must be an HTTPS API base URL without credentials, query or fragment (loopback HTTP is allowed for local testing).")

    @property
    def offline_mode(self) -> bool:
        return self.force_offline or not all((self.llm_api_key, self.llm_base_url, self.llm_model))

    @classmethod
    def from_env(cls):
        return cls(
            db_path=Path(os.environ.get("SPACEHEALTH_DB_PATH", str(cls().db_path))),
            anomaly_method=os.environ.get("SPACEHEALTH_ANOMALY_METHOD", "baseline"),
            force_offline=os.environ.get("SPACEHEALTH_OFFLINE", "").lower() in ("true", "1", "yes"),
            llm_api_key=os.environ.get("LLM_API_KEY", ""),
            llm_base_url=os.environ.get("LLM_BASE_URL", "").rstrip("/"),
            llm_model=os.environ.get("LLM_MODEL", ""),
        )
