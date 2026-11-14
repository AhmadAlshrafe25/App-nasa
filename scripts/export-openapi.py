"""Update the shared contract from FastAPI without starting or seeding a DB."""
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
# Importing the app does not touch storage; point it at a throwaway path to be safe.
os.environ.setdefault("ASTRONAUT_DB_PATH", str(Path(tempfile.mkdtemp(prefix="openapi-export-")) / "export.db"))

import yaml
from backend.main import app

contract = app.openapi()
# Generated clients assume the title "Api" and the shared /api preview prefix.
contract["info"]["title"] = "Api"
contract["servers"] = [{"url": "/api", "description": "Shared preview API prefix; root aliases are also available"}]
output = ROOT / "lib/api-spec/openapi.yaml"
output.write_text(yaml.safe_dump(contract, sort_keys=False, allow_unicode=True))
print(f"Updated {output.relative_to(ROOT)}; run pnpm --filter @workspace/api-spec run codegen.")
