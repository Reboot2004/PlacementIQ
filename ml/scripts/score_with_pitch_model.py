import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from ml.api import BorrowerScoreRequest, score_payload


def main():
    sample_path = Path("ml/data/sample_borrower.json")
    payload = BorrowerScoreRequest(**json.loads(sample_path.read_text(encoding="utf-8")))
    print(json.dumps(score_payload(payload), indent=2))


if __name__ == "__main__":
    main()
