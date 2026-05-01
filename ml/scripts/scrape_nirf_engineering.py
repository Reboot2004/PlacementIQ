import argparse
import csv
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen


class TextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []

    def handle_data(self, data):
        cleaned = " ".join(data.split())
        if cleaned:
            self.text.append(cleaned)


def parse_nirf_engineering(html):
    parser = TextParser()
    parser.feed(html)
    tokens = parser.text
    rows = []

    for index, token in enumerate(tokens):
        if not token.startswith("IR-E-"):
            continue
        window = tokens[index : index + 18]
        joined = " | ".join(window)
        rank_candidates = [item for item in window if re.fullmatch(r"\d{1,3}", item)]
        score_candidates = [item for item in window if re.fullmatch(r"\d{2}\.\d{2}", item)]
        if not rank_candidates or not score_candidates:
            continue
        rank = int(rank_candidates[-1])
        score = float(score_candidates[-1])
        if rank > 300:
            continue
        rows.append(
            {
                "institute_id": token,
                "raw_text": joined,
                "nirf_rank": rank,
                "nirf_score": score,
            }
        )
    return rows


def main():
    parser = argparse.ArgumentParser(description="Best-effort NIRF Engineering ranking scraper.")
    parser.add_argument("--url", default="https://nirfindia.org/Rankings/2024/EngineeringRanking.html")
    parser.add_argument("--out", default="ml/data/raw/nirf_engineering_2024_scraped.csv")
    args = parser.parse_args()

    request = Request(args.url, headers={"User-Agent": "PlacementIQ hackathon prototype"})
    with urlopen(request, timeout=30) as response:
        html = response.read().decode("utf-8", errors="replace")

    rows = parse_nirf_engineering(html)
    output_path = Path(args.out)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["institute_id", "raw_text", "nirf_rank", "nirf_score"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} scraped rows to {output_path}")


if __name__ == "__main__":
    main()
