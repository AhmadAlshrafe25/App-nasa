"""Update the shared contract from FastAPI without starting or seeding a DB."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import yaml
from backend.main import create_app
from backend.settings import Settings

contract = create_app(Settings()).openapi()
assert contract["info"]["title"] == "Api"
output = ROOT / "lib/api-spec/openapi.yaml"
output.write_text(yaml.safe_dump(contract, sort_keys=False, allow_unicode=True))
print(f"Updated {output.relative_to(ROOT)}; run pnpm --filter @workspace/api-spec run codegen.")
