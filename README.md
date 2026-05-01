# PlacementIQ

AI-powered placement risk modelling for education loan portfolios.

PlacementIQ is a lender-facing prototype for NBFC education loan monitoring. It predicts whether a borrower is likely to be placed before or soon after moratorium exit, then gives risk teams a forward-looking Placement Risk Score, placement probabilities, expected salary band, explainability drivers, and recommended interventions.

## What This Prototype Includes

- Lender dashboard for portfolio monitoring
- Borrower-level Placement Risk Score
- 3, 6, and 12 month placement probability models
- Expected salary band prediction
- Stage 1 XGBoost institute-course prior models
- Stage 2 LightGBM student-level adjustment models
- SHAP explainability artifacts
- FastAPI `POST /score` endpoint
- Synthetic/public-seed training dataset
- Dockerfile for API deployment
- Model card and implementation sweep

## Project Structure

```text
prototype/                 Static lender dashboard prototype
ml/scripts/                Data generation, scraping, and model training scripts
ml/models/pitch/           Trained XGBoost, LightGBM, and SHAP artifacts
ml/data/                   Seed data, generated training data, and sample borrower JSON
ml/api.py                  FastAPI scoring API
docs/IMPLEMENTATION_SWEEP.md
requirements.txt           Python dependencies
Dockerfile                 API container setup
```

## Run The Dashboard

Open this file in a browser:

```text
prototype/index.html
```

The dashboard is static and can be hosted directly on GitHub Pages.

## Run The Scoring API

Create a virtual environment and install dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

On the development machine used for this project, the working venv is `.venv-win`:

```powershell
.\.venv-win\Scripts\python.exe -m uvicorn ml.api:app --reload
```

Open:

```text
http://127.0.0.1:8000/docs
```

Smoke-test the trained model without starting the server:

```powershell
.\.venv-win\Scripts\python.exe ml/scripts/score_with_pitch_model.py
```

## Train The Models

Generate the synthetic training dataset:

```powershell
.\.venv-win\Scripts\python.exe ml/scripts/generate_synthetic_data.py --rows 25000
```

Train the pitch-aligned models:

```powershell
.\.venv-win\Scripts\python.exe ml/scripts/train_boosted_models.py
```

## Current Metrics

Trained on 25,000 synthetic rows with a 20,000 / 5,000 train-test split:

- 3-month placement, Stage 2 LightGBM: AUC `0.8122`, accuracy `0.7462`
- 6-month placement, Stage 2 LightGBM: AUC `0.8676`, accuracy `0.8812`
- 12-month placement, Stage 2 LightGBM: AUC `0.8967`, accuracy `0.9542`
- Salary LightGBM: MAE `0.9625 LPA`, RMSE `1.2041 LPA`

## Data Approach

The prototype uses public NIRF Engineering 2024 seed signals plus transparent synthetic borrower, employability, placement, salary, and loan labels. This is intentional because verified NBFC repayment and placement labels are private.

GPA handling is normalized:

- Indian applicants may have a 10-point or 4-point grade scale.
- Foreign applicants are generated with a 4-point grade scale.
- The model uses only `normalized_cgpa_10`.
- Applicant origin is excluded from model features and retained only for auditability.

## Responsible AI

PlacementIQ is decision support, not an automated loan rejection tool.

Excluded model features include:

- Gender
- Caste
- Religion
- Applicant origin / nationality
- Direct demographic identifiers

Every model score is backed by SHAP explainability artifacts so a lender can inspect the drivers behind the score.

## Docker

```powershell
docker build -t placementiq-api .
docker run -p 8000:8000 placementiq-api
```

Then open:

```text
http://127.0.0.1:8000/docs
```

## Next Improvements

- Connect the browser dashboard directly to FastAPI `POST /score`
- Add batch portfolio scoring from uploaded CSV/JSON
- Replace synthetic labels with verified NBFC placement and repayment outcomes
- Add calibration, drift, and fairness monitoring views
- Add audit logging for every score request and intervention recommendation
