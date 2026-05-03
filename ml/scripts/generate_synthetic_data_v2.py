"""
PlacementIQ Synthetic Data Generator v2
========================================

Key design principles:
  1. CGPA is king — the single strongest predictor of placement.
     Low CGPA (< 6.5) massively hurts outcomes.
  2. Backlogs are severely penalized — each backlog is a strong
     negative signal. 3+ backlogs nearly guarantee poor outcomes.
  3. NIRF rank / score matters but is secondary — it provides a
     baseline (tier-1 colleges have better infra, placement cells)
     but cannot save a bad student.
  4. Internships and interviews are strong positive signals but
     cannot overcome terrible academics.
  5. Target placement rates are realistic:
       - placed_3m: ~40-45%
       - placed_6m: ~60-65%
       - placed_12m: ~78-82%
  6. Salary strongly correlates with GPA, tier, and course.
  7. Delinquency inversely correlates with placement + salary.

Indian Name Bank for realistic borrower names.
"""

import argparse
import csv
import math
import random
from pathlib import Path


# ─── Constants ──────────────────────────────────────────────────────────

COURSES = ["btech_cse", "mba", "core_engineering", "commerce_arts"]
COURSE_WEIGHTS = [0.40, 0.22, 0.24, 0.14]

# Course-level placement prior (additive logit)
COURSE_PLACEMENT_PRIOR = {
    "btech_cse":       0.45,
    "mba":             0.30,
    "core_engineering": -0.25,
    "commerce_arts":   -0.55,
}

# Course-level sector demand baseline
SECTOR_DEMAND_BASE = {
    "btech_cse":       0.72,
    "mba":             0.58,
    "core_engineering": 0.42,
    "commerce_arts":   0.35,
}

# Course-level base salary for placed students
COURSE_BASE_SALARY = {
    "btech_cse":       6.5,
    "mba":             7.2,
    "core_engineering": 4.5,
    "commerce_arts":   3.5,
}

# Indian names for realistic data
FIRST_NAMES = [
    "Aarav", "Aditya", "Akshay", "Ananya", "Arjun", "Arya", "Ashwin",
    "Bhavna", "Bhuvan", "Chirag", "Deepak", "Disha", "Divya", "Eshan",
    "Faisal", "Gaurav", "Geeta", "Harsh", "Harshita", "Hemant", "Hina",
    "Ishan", "Isha", "Ishita", "Jatin", "Jaya", "Jeet", "Jeetu",
    "Kamal", "Kanika", "Karan", "Karthik", "Kavya", "Keya", "Kishan",
    "Komal", "Kunal", "Kushal", "Lalit", "Leela", "Lokesh", "Maitri",
    "Manasa", "Mangal", "Manisha", "Manit", "Manoj", "Meera", "Meghna",
    "Mehul", "Milan", "Milind", "Mirza", "Mishti", "Mohan", "Mohini",
    "Mrinal", "Mukul", "Muneesh", "Murali", "Naina", "Nanda", "Nandini",
    "Naresh", "Narmada", "Naveen", "Neha", "Nikhil", "Nikita", "Nilesh",
    "Nisha", "Nitesh", "Nitin", "Niyati", "Noor", "Nutan", "Ojas",
    "Padma", "Parag", "Pari", "Parisha", "Parth", "Parvati", "Paras",
    "Pavitra", "Pawan", "Peeyush", "Priya", "Rahul", "Ravi", "Rohit",
    "Sakshi", "Shreya", "Siddharth", "Sneha", "Tanvi", "Varun", "Vipul",
]

LAST_NAMES = [
    "Bansal", "Bhat", "Bhatnagar", "Bhattacharya", "Bhindal", "Birla",
    "Chaurasia", "Chopra", "Choudhury", "Dasgupta", "Deshpande", "Dey",
    "Dixit", "Dutta", "Dwivedi", "Gopal", "Goyanka", "Gupta", "Hegde",
    "Iyer", "Iyengar", "Jain", "Joshi", "Kapoor", "Kapur", "Khanna",
    "Khurana", "Krishnan", "Kulkarni", "Kumar", "Kumaran", "Lakhanpal",
    "Lal", "Lamba", "Laxminarayan", "Loomba", "Luthra", "Mahajan",
    "Mahanti", "Malik", "Marwaha", "Masarrate", "Mathew", "Mathur",
    "Mazumdar", "Mehta", "Menon", "Merchant", "Mishra", "Mitra",
    "Mohan", "Mohindra", "Moonje", "Mookerjee", "Murthy", "Murty",
    "Nag", "Nair", "Nambiar", "Namboodiri", "Nanda", "Nander",
    "Namboothiri", "Patel", "Reddy", "Sharma", "Singh", "Verma",
]


# ─── Utility functions ─────────────────────────────────────────────────

def sigmoid(x):
    return 1.0 / (1.0 + math.exp(-max(-20, min(20, x))))


def clamp(val, lo, hi):
    return max(lo, min(hi, val))


def bernoulli(rng, p):
    return 1 if rng.random() < p else 0


def institute_tier(rank):
    if rank <= 25:
        return 1
    if rank <= 75:
        return 2
    return 3


def read_seed(path):
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


# ─── Row generator ─────────────────────────────────────────────────────

def generate_row(rng, institutes, borrower_id):
    inst = rng.choice(institutes)
    rank = int(inst["nirf_rank"])
    score = float(inst["nirf_score"])
    tier = institute_tier(rank)

    name = f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"
    course = rng.choices(COURSES, weights=COURSE_WEIGHTS, k=1)[0]
    origin = rng.choices(["indian", "foreign"], weights=[0.94, 0.06], k=1)[0]
    gpa_scale = 4 if origin == "foreign" else rng.choices([10, 4], weights=[0.86, 0.14], k=1)[0]

    # ── CGPA generation (tier-dependent, wide spread) ──
    cgpa_mean = {1: 8.1, 2: 7.3, 3: 6.7}[tier]
    normalized_cgpa_10 = round(clamp(rng.gauss(cgpa_mean, 0.85), 4.5, 10.0), 2)
    raw_gpa = round(normalized_cgpa_10 if gpa_scale == 10 else normalized_cgpa_10 * 4.0 / 10.0, 2)

    # ── Backlogs (strongly correlated with low CGPA) ──
    # Students with lower GPA tend to have more backlogs
    backlog_base = max(0, (7.5 - normalized_cgpa_10) * 0.8)
    backlogs = max(0, int(rng.gauss(backlog_base, 0.9)))
    backlogs = min(backlogs, 8)  # cap

    # ── Activity features ──
    internships = max(0, min(5, int(rng.gauss(
        2.5 if tier == 1 else 1.2 if tier == 2 else 0.5, 1.1
    ))))
    certifications = max(0, min(8, int(rng.gauss(
        2.8 if course == "btech_cse" else 1.8 if course == "mba" else 1.2, 1.5
    ))))
    job_portal_activity = round(clamp(
        rng.gauss(0.55 + internships * 0.08, 0.2), 0.0, 1.0
    ), 3)
    interview_count = max(0, int(rng.gauss(
        2.5 * job_portal_activity + internships * 0.7, 1.5
    )))

    # ── Institute-level features (influenced by NIRF) ──
    placement_cell_index = round(clamp(
        (score / 110.0) + rng.gauss(0, 0.10), 0.15, 0.95
    ), 3)
    sector_demand_index = round(clamp(
        SECTOR_DEMAND_BASE[course] + rng.gauss(0, 0.12), 0.10, 0.95
    ), 3)
    historical_course_placement_rate = round(clamp(
        0.30 + (score / 140.0) + COURSE_PLACEMENT_PRIOR[course] * 0.18 + rng.gauss(0, 0.08),
        0.15, 0.96
    ), 3)

    # ── Loan features ──
    loan_amount_lakh = round(clamp(
        rng.gauss(18 if course == "mba" else 14, 5.0)
        + (3.0 if tier == 1 else 0.0)
        - (2.0 if tier == 3 else 0.0),
        4.0, 35.0
    ), 2)
    moratorium_days_left = rng.randint(15, 240)

    # ════════════════════════════════════════════════════════════════════
    # PLACEMENT PROBABILITY — THE CORE LOGIC
    # ════════════════════════════════════════════════════════════════════
    #
    # Design:
    #   - CGPA is the #1 driver (~35% of variance)
    #   - Backlogs are the #2 driver (~20% of variance), strongly negative
    #   - NIRF / institute quality is #3 (~15% of variance)
    #   - Internships + interviews are #4 (~15%)
    #   - Everything else is ~15%
    #
    # Key behaviors:
    #   - CGPA < 6.0 + backlogs >= 3 → almost guaranteed no placement
    #   - CGPA > 8.5 + tier 1 + internships → almost guaranteed placement
    #   - A tier-3 student with 9.0 CGPA and 0 backlogs CAN get placed
    #   - A tier-1 student with 5.5 CGPA and 4 backlogs will NOT get placed

    # CGPA component — strong non-linear penalty below 6.5
    cgpa_centered = normalized_cgpa_10 - 7.0
    if normalized_cgpa_10 < 6.0:
        cgpa_effect = cgpa_centered * 1.2 - 0.8   # extra harsh below 6.0
    elif normalized_cgpa_10 < 6.5:
        cgpa_effect = cgpa_centered * 0.9 - 0.3   # harsh below 6.5
    elif normalized_cgpa_10 < 7.0:
        cgpa_effect = cgpa_centered * 0.7
    else:
        cgpa_effect = cgpa_centered * 0.55

    # Backlog component — SEVERE penalty, exponentially worse
    if backlogs == 0:
        backlog_effect = 0.15  # small bonus for clean record
    elif backlogs == 1:
        backlog_effect = -0.40
    elif backlogs == 2:
        backlog_effect = -0.95
    elif backlogs == 3:
        backlog_effect = -1.60
    else:
        backlog_effect = -1.60 - (backlogs - 3) * 0.55

    # NIRF / institute component — moderate importance
    nirf_effect = (score - 55.0) / 45.0  # roughly -0.25 to +0.75

    # Course prior
    course_effect = COURSE_PLACEMENT_PRIOR[course]

    # Activity component
    activity_effect = (
        internships * 0.25
        + certifications * 0.08
        + job_portal_activity * 0.50
        + interview_count * 0.12
    )

    # Institutional support
    support_effect = (
        placement_cell_index * 0.55
        + sector_demand_index * 0.60
        + historical_course_placement_rate * 0.80
    )

    # Assemble placement logit
    base_logit = (
        -1.8                    # intercept (pulls base rate down)
        + cgpa_effect           # ~35% weight
        + backlog_effect        # ~20% weight — HARSH
        + nirf_effect           # ~15% weight — moderate
        + course_effect         # course prior
        + activity_effect       # ~15% weight
        + support_effect        # ~15% weight
        + rng.gauss(0, 0.25)   # noise
    )

    # Time-horizon probabilities with natural monotonicity
    p3  = clamp(sigmoid(base_logit - 0.85), 0.02, 0.95)
    p6  = clamp(sigmoid(base_logit + 0.25), p3 + 0.03, 0.97)
    p12 = clamp(sigmoid(base_logit + 1.10), p6 + 0.03, 0.99)

    placed_3m  = bernoulli(rng, p3)
    placed_6m  = max(placed_3m, bernoulli(rng, p6))
    placed_12m = max(placed_6m, bernoulli(rng, p12))

    # ── Salary ──
    salary_lpa = 0.0
    if placed_12m:
        base_sal = COURSE_BASE_SALARY[course]
        salary_lpa = round(clamp(
            rng.gauss(
                base_sal
                + (normalized_cgpa_10 - 7.0) * 1.2   # GPA premium
                + (score - 55) * 0.05                 # NIRF premium (small)
                + internships * 0.45                   # internship premium
                + certifications * 0.12
                - backlogs * 0.35                      # backlogs reduce salary
                + ({1: 1.5, 2: 0.0, 3: -0.8}[tier]),  # tier premium
                1.3
            ),
            2.4, 28.0
        ), 2)

    # ── Delinquency ──
    delinquency_logit = (
        1.5
        - p6 * 2.0
        - p12 * 1.2
        + backlogs * 0.18
        + loan_amount_lakh * 0.03
        - salary_lpa * 0.12
        - (normalized_cgpa_10 - 7.0) * 0.15
        + (1 if moratorium_days_left < 90 else 0) * 0.30
    )
    early_delinquency = bernoulli(rng, clamp(sigmoid(delinquency_logit), 0.03, 0.80))

    return {
        "borrower_id": f"B{borrower_id:06d}",
        "borrower_name": name,
        "institute_id": inst["institute_id"],
        "institute_name": inst["name"],
        "city": inst["city"],
        "state": inst["state"],
        "nirf_rank": rank,
        "nirf_score": round(score, 2),
        "institute_tier": tier,
        "course": course,
        "applicant_origin": origin,
        "gpa_scale": gpa_scale,
        "raw_gpa": raw_gpa,
        "normalized_cgpa_10": normalized_cgpa_10,
        "backlogs": backlogs,
        "internships": internships,
        "certifications": certifications,
        "job_portal_activity": job_portal_activity,
        "interview_count": interview_count,
        "placement_cell_index": placement_cell_index,
        "sector_demand_index": sector_demand_index,
        "historical_course_placement_rate": historical_course_placement_rate,
        "loan_amount_lakh": loan_amount_lakh,
        "moratorium_days_left": moratorium_days_left,
        "placed_3m": placed_3m,
        "placed_6m": placed_6m,
        "placed_12m": placed_12m,
        "actual_salary_lpa": salary_lpa,
        "early_delinquency": early_delinquency,
    }


# ─── Main ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Generate PlacementIQ v2 synthetic training data with realistic GPA/backlog penalties."
    )
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
    if not institutes:
        raise SystemExit("ERROR: Seed CSV is empty or not found.")

    rows = [generate_row(rng, institutes, i + 1) for i in range(args.rows)]

    # ── Print distribution stats ──
    p3_rate  = sum(r["placed_3m"] for r in rows) / len(rows)
    p6_rate  = sum(r["placed_6m"] for r in rows) / len(rows)
    p12_rate = sum(r["placed_12m"] for r in rows) / len(rows)
    avg_sal  = sum(r["actual_salary_lpa"] for r in rows if r["actual_salary_lpa"] > 0) / max(1, sum(1 for r in rows if r["actual_salary_lpa"] > 0))
    delinq   = sum(r["early_delinquency"] for r in rows) / len(rows)
    avg_cgpa = sum(r["normalized_cgpa_10"] for r in rows) / len(rows)
    avg_back = sum(r["backlogs"] for r in rows) / len(rows)

    print(f"Generated {len(rows)} rows -> {output_path}")
    print(f"  placed_3m rate:  {p3_rate:.1%}")
    print(f"  placed_6m rate:  {p6_rate:.1%}")
    print(f"  placed_12m rate: {p12_rate:.1%}")
    print(f"  avg salary (placed): {avg_sal:.2f} LPA")
    print(f"  delinquency rate: {delinq:.1%}")
    print(f"  avg CGPA: {avg_cgpa:.2f}")
    print(f"  avg backlogs: {avg_back:.2f}")

    # Validate: check that backlogs actually hurt
    high_backlog = [r for r in rows if r["backlogs"] >= 3]
    no_backlog = [r for r in rows if r["backlogs"] == 0]
    if high_backlog and no_backlog:
        hb_p6 = sum(r["placed_6m"] for r in high_backlog) / len(high_backlog)
        nb_p6 = sum(r["placed_6m"] for r in no_backlog) / len(no_backlog)
        print(f"\n  VALIDATION - Backlog penalty:")
        print(f"    0 backlogs -> placed_6m: {nb_p6:.1%}")
        print(f"    3+ backlogs -> placed_6m: {hb_p6:.1%}")
        print(f"    Δ = {nb_p6 - hb_p6:.1%} (should be 20%+)")

    # Validate: check that low GPA hurts
    low_gpa = [r for r in rows if r["normalized_cgpa_10"] < 6.5]
    high_gpa = [r for r in rows if r["normalized_cgpa_10"] >= 8.0]
    if low_gpa and high_gpa:
        lg_p6 = sum(r["placed_6m"] for r in low_gpa) / len(low_gpa)
        hg_p6 = sum(r["placed_6m"] for r in high_gpa) / len(high_gpa)
        print(f"\n  VALIDATION - GPA penalty:")
        print(f"    GPA < 6.5 -> placed_6m: {lg_p6:.1%}")
        print(f"    GPA >= 8.0 -> placed_6m: {hg_p6:.1%}")
        print(f"    Δ = {hg_p6 - lg_p6:.1%} (should be 25%+)")

    # Validate: NIRF effect exists but is secondary
    tier1 = [r for r in rows if r["institute_tier"] == 1]
    tier3 = [r for r in rows if r["institute_tier"] == 3]
    if tier1 and tier3:
        t1_p6 = sum(r["placed_6m"] for r in tier1) / len(tier1)
        t3_p6 = sum(r["placed_6m"] for r in tier3) / len(tier3)
        print(f"\n  VALIDATION - NIRF/tier effect:")
        print(f"    Tier 1 -> placed_6m: {t1_p6:.1%}")
        print(f"    Tier 3 -> placed_6m: {t3_p6:.1%}")
        print(f"    Δ = {t1_p6 - t3_p6:.1%} (should be 10-20%)")

    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    print(f"\n[OK] Done! Wrote {len(rows)} rows to {output_path}")


if __name__ == "__main__":
    main()
