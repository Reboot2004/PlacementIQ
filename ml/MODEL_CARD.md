# PlacementIQ Model Card

## Model Purpose

PlacementIQ predicts forward-looking placement readiness for education-loan borrowers before moratorium exit. It is designed for NBFC portfolio monitoring and human decision support, not automated loan rejection.

## Current Artifact

- Model folder: `ml/models/pitch`
- Metrics file: `ml/models/pitch/metrics.json`
- Metadata file: `ml/models/pitch/metadata.json`
- Training data: `ml/data/processed/placementiq_training.csv`
- Training rows: 25,000
- Train/test split: 80/20

## Model Family

The trained implementation matches the pitch deck:

- Stage 1: XGBoost institute-course prior
- Stage 2: LightGBM student-level adjustment
- Explainability: SHAP TreeExplainer artifacts
- Salary estimate: LightGBMRegressor

## Data

The current dataset combines:

- Public institute ranking seed signals from NIRF Engineering 2024
- Synthetic student, employability, loan, placement, salary, and early delinquency labels

Synthetic labels are used because real NBFC repayment outcomes and verified placement timelines are private. The dataset is explicitly marked synthetic and is intended for prototype validation only.

## GPA Normalization

GPA values are generated with permissible normalization:

- Indian applicants may have a 10-point or 4-point grade scale.
- Foreign applicants are generated with a 4-point grade scale.
- The model uses only `normalized_cgpa_10`.
- Applicant origin is retained only for auditability and is not a model feature.

## Features

Stage 1 features:

- NIRF rank
- NIRF score
- Institute tier
- Course
- Placement cell index
- Sector demand index
- Historical course placement rate

Stage 2 features:

- Stage 1 prior score
- Normalized CGPA on a 10-point scale
- Backlogs
- Internships
- Certifications
- Job portal activity
- Interview count
- Loan amount
- Moratorium days left
- Stage 1 institute/course/market features

Excluded features:

- Gender
- Caste
- Religion
- Applicant origin / nationality
- Direct demographic identifiers

## Targets

- `placed_3m`
- `placed_6m`
- `placed_12m`
- `actual_salary_lpa`

## Validation Metrics

On the generated 5,000-row test split:

- 3-month placement, stage-2 LightGBM: AUC 0.8122, accuracy 0.7462
- 6-month placement, stage-2 LightGBM: AUC 0.8676, accuracy 0.8812
- 12-month placement, stage-2 LightGBM: AUC 0.8967, accuracy 0.9542
- Salary LightGBM: MAE 0.9625 LPA, RMSE 1.2041 LPA

## Intended Use

Appropriate:

- Prioritizing borrowers for placement support before moratorium exit
- Portfolio-level monitoring
- Explaining risk drivers to human portfolio managers
- Testing the future FastAPI `POST /score` contract

Not appropriate:

- Automated loan rejection
- Final collections decisions without human review
- Assessing protected or sensitive demographic attributes
