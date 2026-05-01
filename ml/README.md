# PlacementIQ Model Pipeline

This folder contains the pitch-aligned PlacementIQ training pipeline.

## Architecture

The implementation follows the pitch deck:

- Stage 1: XGBoost institute-course prior score
- Stage 2: LightGBM student-level adjustment
- SHAP: ranked explainability drivers

The trained outputs cover:

- `placed_3m`
- `placed_6m`
- `placed_12m`
- `actual_salary_lpa`

## Data

The training dataset is generated from:

- Public NIRF Engineering 2024 institute ranking seed signals
- Synthetic borrower, employability, placement, salary, and loan labels

This is permissible for the prototype because verified NBFC repayment and placement labels are private. Synthetic data is transparent, reproducible, and marked as synthetic.

## GPA Handling

The dataset stores:

- `gpa_scale`: either `10` or `4`
- `raw_gpa`: the original grade value
- `normalized_cgpa_10`: the comparable 10-point score used by the model

Foreign applicants are generated on a 4-point grading scale. Indian applicants may be generated on either a 10-point or 4-point scale. Applicant origin is excluded from model features and retained only for auditability.

## Run

From the repository root:

```bash
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe ml/scripts/generate_synthetic_data.py --rows 25000
.\.venv\Scripts\python.exe ml/scripts/train_boosted_models.py
```

On this machine, the working environment is `.venv-win` because the default Python created an MSYS-style venv:

```bash
.\.venv-win\Scripts\python.exe ml/scripts/train_boosted_models.py
```

## Serve The Scoring API

The pitch deck calls for a FastAPI `POST /score` endpoint. It is implemented in `ml/api.py`.

Run locally:

```bash
.\.venv-win\Scripts\python.exe -m uvicorn ml.api:app --reload
```

Then open:

```text
http://127.0.0.1:8000/docs
```

Smoke-test the saved models without starting a server:

```bash
.\.venv-win\Scripts\python.exe ml/scripts/score_with_pitch_model.py
```

Sample request payload:

```text
ml/data/sample_borrower.json
```

## Artifacts

Generated pitch artifacts are saved in `ml/models/pitch`:

- `stage1_xgboost_placed_3m.joblib`
- `stage1_xgboost_placed_6m.joblib`
- `stage1_xgboost_placed_12m.joblib`
- `stage2_lightgbm_placed_3m.joblib`
- `stage2_lightgbm_placed_6m.joblib`
- `stage2_lightgbm_placed_12m.joblib`
- `salary_lightgbm.joblib`
- `shap_explainer_placed_3m.joblib`
- `shap_explainer_placed_6m.joblib`
- `shap_explainer_placed_12m.joblib`
- `shap_explainer_salary.joblib`
- `metrics.json`
- `metadata.json`

## Docker

The repo includes a Dockerfile for the API:

```bash
docker build -t placementiq-api .
docker run -p 8000:8000 placementiq-api
```

## Current Metrics

Trained on 25,000 synthetic rows with a 20,000 / 5,000 train-test split:

- 3-month placement, stage-2 LightGBM: AUC 0.8122, accuracy 0.7462
- 6-month placement, stage-2 LightGBM: AUC 0.8676, accuracy 0.8812
- 12-month placement, stage-2 LightGBM: AUC 0.8967, accuracy 0.9542
- Salary LightGBM: MAE 0.9625 LPA, RMSE 1.2041 LPA

## Production Replacement

For the finale, replace synthetic labels with verified internal data:

- Confirmed placement timeline
- Actual joining salary
- EMI start status
- Delinquency/default/NPA outcomes
- Verified institute placement records
