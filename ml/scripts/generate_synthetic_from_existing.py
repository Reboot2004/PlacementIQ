import argparse
import csv
import random
from pathlib import Path
from copy import deepcopy


def read_rows(path):
    with path.open(newline="", encoding="utf-8") as h:
        reader = list(csv.DictReader(h))
    return reader


def detect_numeric_columns(rows):
    numeric = {}
    for k in rows[0].keys():
        vals = []
        for r in rows:
            v = r.get(k, "")
            if v is None or v == "":
                continue
            try:
                vals.append(float(v))
            except Exception:
                vals = []
                break
        if vals:
            mn = min(vals)
            mx = max(vals)
            # compute std
            mean = sum(vals) / len(vals)
            var = sum((x - mean) ** 2 for x in vals) / len(vals)
            std = var ** 0.5
            numeric[k] = {"min": mn, "max": mx, "mean": mean, "std": std}
    return numeric


def is_integer_column(colname):
    ints = {
        "nirf_rank",
        "institute_tier",
        "gpa_scale",
        "backlogs",
        "internships",
        "certifications",
        "interview_count",
        "moratorium_days_left",
        "loan_amount_lakh",
    }
    # treat placed_* and early_delinquency as integers too
    if colname.startswith("placed_") or colname == "early_delinquency":
        return True
    return colname in ints


def jitter_value(base_val, meta, rng, noise_scale):
    if meta is None:
        return base_val
    try:
        v = float(base_val)
    except Exception:
        return base_val
    std = meta.get("std", 0.0)
    std = max(std, 0.01)
    newv = v + rng.gauss(0, std * noise_scale)
    # clamp
    newv = max(meta["min"], min(meta["max"], newv))
    return newv


def generate(rows, numeric_meta, out_path, rows_to_generate, seed, noise_scale):
    rng = random.Random(seed)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(rows[0].keys())

    start_idx = 1
    with out_path.open("w", newline="", encoding="utf-8") as h:
        writer = csv.DictWriter(h, fieldnames=fieldnames)
        writer.writeheader()
        for i in range(rows_to_generate):
            base = deepcopy(rng.choice(rows))
            new = {}
            for k, v in base.items():
                if k == "borrower_id":
                    new[k] = f"B{start_idx + i:06d}"
                    continue
                meta = numeric_meta.get(k)
                if meta:
                    nv = jitter_value(v, meta, rng, noise_scale)
                    if is_integer_column(k):
                        # integer columns
                        try:
                            nv_i = int(round(nv))
                        except Exception:
                            nv_i = int(float(v)) if v != "" else 0
                        new[k] = nv_i
                    else:
                        # float with 2 decimals
                        try:
                            new[k] = round(float(nv), 3) if k.endswith("_index") or k.endswith("rate") else round(float(nv), 2)
                        except Exception:
                            new[k] = v
                else:
                    # categorical - keep same or with small chance sample another
                    if rng.random() < 0.02:
                        # pick a random value from observed set for this column
                        vals = [r[k] for r in rows if r.get(k) not in (None, "")]
                        if vals:
                            new[k] = rng.choice(vals)
                        else:
                            new[k] = v
                    else:
                        new[k] = v

            # enforce placement monotonicity: placed_3m <= placed_6m <= placed_12m
            try:
                p3 = int(new.get("placed_3m", 0))
                p6 = int(new.get("placed_6m", 0))
                p12 = int(new.get("placed_12m", 0))
            except Exception:
                p3 = p6 = p12 = 0
            # small chance flip bits according to global rates
            if rng.random() < 0.05:
                # recompute using observed rates
                obs_p3 = sum(int(r.get("placed_3m", 0)) for r in rows) / len(rows)
                obs_p6 = sum(int(r.get("placed_6m", 0)) for r in rows) / len(rows)
                obs_p12 = sum(int(r.get("placed_12m", 0)) for r in rows) / len(rows)
                p3 = 1 if rng.random() < obs_p3 else 0
                p6 = 1 if rng.random() < obs_p6 else 0
                p12 = 1 if rng.random() < obs_p12 else 0

            p6 = max(p3, p6)
            p12 = max(p6, p12)
            new["placed_3m"] = p3
            new["placed_6m"] = p6
            new["placed_12m"] = p12

            # ensure booleans are ints
            for flag in ("early_delinquency",):
                if flag in new:
                    try:
                        new[flag] = int(round(float(new[flag])))
                    except Exception:
                        new[flag] = 0

            writer.writerow(new)

    print(f"Wrote {rows_to_generate} synthetic rows to {out_path}")


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic PlacementIQ data from existing training CSV.")
    parser.add_argument("--rows", type=int, default=100000, help="Number of synthetic rows to generate")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--seed-csv", default="ml/data/processed/placementiq_training.csv")
    parser.add_argument("--out", default="ml/data/processed/placementiq_training_100k.csv")
    parser.add_argument("--noise-scale", type=float, default=0.4, help="Scale of numeric jitter relative to observed stddev")
    args = parser.parse_args()

    seed_path = Path(args.seed_csv)
    out_path = Path(args.out)
    rows = read_rows(seed_path)
    if not rows:
        raise SystemExit("Seed CSV appears empty or missing")

    numeric_meta = detect_numeric_columns(rows)
    # make sure std is not zero
    for m in numeric_meta.values():
        if m["std"] < 1e-3:
            m["std"] = max(0.01, (m["max"] - m["min"]) * 0.05)

    generate(rows, numeric_meta, out_path, args.rows, args.seed, args.noise_scale)


if __name__ == "__main__":
    main()
