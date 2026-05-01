import argparse
import csv
import math
import random
from pathlib import Path


COURSES = ["btech_cse", "mba", "core_engineering", "commerce_arts"]
COURSE_PRIOR = {
    "btech_cse": 0.55,
    "mba": 0.48,
    "core_engineering": -0.18,
    "commerce_arts": -0.30,
}
SECTOR_BASE = {
    "btech_cse": 0.70,
    "mba": 0.60,
    "core_engineering": 0.44,
    "commerce_arts": 0.40,
}


def sigmoid(value):
    return 1.0 / (1.0 + math.exp(-value))


def clamp(value, low, high):
    return max(low, min(high, value))


def institute_tier(rank):
    if rank <= 25:
        return 1
    if rank <= 75:
        return 2
    return 3


def read_seed(path):
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def bernoulli(rng, probability):
    return 1 if rng.random() < probability else 0


def generate_row(rng, institutes, borrower_id):
    institute = rng.choice(institutes)
    rank = int(institute["nirf_rank"])
    score = float(institute["nirf_score"])
    tier = institute_tier(rank)
    course = rng.choices(COURSES, weights=[0.42, 0.22, 0.22, 0.14], k=1)[0]
    applicant_origin = rng.choices(["indian", "foreign"], weights=[0.94, 0.06], k=1)[0]
    gpa_scale = 4 if applicant_origin == "foreign" else rng.choices([10, 4], weights=[0.86, 0.14], k=1)[0]

    cgpa_base = {1: 8.0, 2: 7.35, 3: 6.95}[tier]
    normalized_cgpa_10 = clamp(rng.gauss(cgpa_base, 0.65), 5.0, 10.0)
    raw_gpa = normalized_cgpa_10 if gpa_scale == 10 else normalized_cgpa_10 * 4.0 / 10.0
    backlogs = max(0, int(rng.gauss(0.5 if tier == 1 else 1.2 if tier == 2 else 1.9, 1.1)))
    internships = max(0, min(5, int(rng.gauss(2.1 if tier == 1 else 1.1 if tier == 2 else 0.5, 1.0))))
    certifications = max(0, min(8, int(rng.gauss(2.5 if course == "btech_cse" else 1.5, 1.4))))
    job_portal_activity = clamp(rng.gauss(0.72 if internships else 0.45, 0.18), 0.0, 1.0)
    interview_count = max(0, int(rng.gauss(3.2 * job_portal_activity + internships, 1.4)))
    placement_cell_index = clamp((score / 100.0) + rng.gauss(0, 0.08), 0.15, 0.95)
    sector_demand_index = clamp(SECTOR_BASE[course] + rng.gauss(0, 0.09), 0.1, 0.95)
    historical_course_placement_rate = clamp(
        0.35 + (score / 125.0) + COURSE_PRIOR[course] * 0.22 + rng.gauss(0, 0.07),
        0.18,
        0.96,
    )
    loan_amount_lakh = round(
        clamp(
            rng.gauss(18 if course == "mba" else 14, 4.5)
            + (2.0 if tier == 1 else 0.0)
            - (2.0 if tier == 3 else 0.0),
            4.0,
            36.0,
        ),
        2,
    )
    moratorium_days_left = rng.randint(15, 240)

    base = (
        -2.2
        + (score - 50.0) / 18.0
        + COURSE_PRIOR[course]
        + (normalized_cgpa_10 - 7.0) * 0.42
        - backlogs * 0.20
        + internships * 0.38
        + certifications * 0.14
        + job_portal_activity * 0.75
        + interview_count * 0.18
        + placement_cell_index * 0.85
        + sector_demand_index * 0.95
        + historical_course_placement_rate * 1.15
    )

    p3 = clamp(sigmoid(base - 1.0), 0.02, 0.97)
    p6 = clamp(sigmoid(base - 0.15), p3 + 0.02, 0.99)
    p12 = clamp(sigmoid(base + 0.70), p6 + 0.02, 0.995)

    placed_3m = bernoulli(rng, p3)
    placed_6m = max(placed_3m, bernoulli(rng, p6))
    placed_12m = max(placed_6m, bernoulli(rng, p12))

    salary_lpa = 0.0
    if placed_12m:
        course_salary = {
            "btech_cse": 5.8,
            "mba": 6.6,
            "core_engineering": 4.1,
            "commerce_arts": 3.6,
        }[course]
        salary_lpa = round(
            clamp(
                rng.gauss(course_salary + (score - 50) * 0.11 + internships * 0.55 + certifications * 0.18, 1.2),
                2.4,
                26.0,
            ),
            2,
        )

    delinquency_logit = (
        1.8
        - p6 * 2.2
        - p12 * 1.1
        + loan_amount_lakh * 0.035
        - salary_lpa * 0.13
        + (1 if moratorium_days_left < 90 else 0) * 0.32
    )
    early_delinquency = bernoulli(rng, clamp(sigmoid(delinquency_logit), 0.03, 0.85))

    return {
        "borrower_id": f"B{borrower_id:06d}",
        "institute_id": institute["institute_id"],
        "institute_name": institute["name"],
        "city": institute["city"],
        "state": institute["state"],
        "nirf_rank": rank,
        "nirf_score": round(score, 2),
        "institute_tier": tier,
        "course": course,
        "applicant_origin": applicant_origin,
        "gpa_scale": gpa_scale,
        "raw_gpa": round(raw_gpa, 2),
        "normalized_cgpa_10": round(normalized_cgpa_10, 2),
        "backlogs": backlogs,
        "internships": internships,
        "certifications": certifications,
        "job_portal_activity": round(job_portal_activity, 3),
        "interview_count": interview_count,
        "placement_cell_index": round(placement_cell_index, 3),
        "sector_demand_index": round(sector_demand_index, 3),
        "historical_course_placement_rate": round(historical_course_placement_rate, 3),
        "loan_amount_lakh": loan_amount_lakh,
        "moratorium_days_left": moratorium_days_left,
        "placed_3m": placed_3m,
        "placed_6m": placed_6m,
        "placed_12m": placed_12m,
        "actual_salary_lpa": salary_lpa,
        "early_delinquency": early_delinquency,
    }


def main():
    parser = argparse.ArgumentParser(description="Generate PlacementIQ synthetic training data.")
    parser.add_argument("--rows", type=int, default=25000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--seed-data", default="ml/data/seed/nirf_engineering_2024_seed.csv")
    parser.add_argument("--out", default="ml/data/processed/placementiq_training.csv")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    seed_path = Path(args.seed_data)
    output_path = Path(args.out)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    institutes = read_seed(seed_path)
    rows = [generate_row(rng, institutes, index + 1) for index in range(args.rows)]

    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {output_path}")


if __name__ == "__main__":
    main()
