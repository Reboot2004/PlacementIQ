# PlacementIQ

AI-powered placement risk modelling for education loan portfolios.

PlacementIQ is a lender-facing prototype for NBFC education loan monitoring. It predicts whether a borrower is likely to be placed before or soon after moratorium exit, then gives risk teams a forward-looking Placement Risk Score, placement probabilities, expected salary band, explainability drivers, and recommended interventions.

## Requirements

- **Python**: 3.11.0 or above
- **Node.js**: 24 or above
- **NPM**: Latest version

## Project Structure

```text
main/                      Next.js frontend dashboard
ml/                        Python backend and ML models
ml/api.py                  FastAPI scoring API
ml/scripts/                Data generation and training scripts
ml/models/                 Trained model artifacts
ml/data/                   Seed and synthetic data
requirements.txt           Python dependencies
package.json               Frontend dependencies (in main/)
Dockerfile                 API container setup
```

## Setup & Running

### 1. Backend (FastAPI)

Create a virtual environment and install dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

Run the scoring API:

```powershell
python -m uvicorn ml.api:app --reload
```

The API will be available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### 2. Frontend (Next.js)

Navigate to the `main` folder and install dependencies:

```powershell
cd main
npm install
```

Run the development server:

```powershell
npm run dev
```

The dashboard will be available at [http://localhost:3000](http://localhost:3000).

---

## Train The Models

Generate the synthetic training dataset:

```powershell
python ml/scripts/generate_synthetic_data.py --rows 25000
```

Train the models:

```powershell
python ml/scripts/train_boosted_models.py
```

## Current Metrics

Trained on 25,000 synthetic rows with a 20,000 / 5,000 train-test split:

- 3-month placement, Stage 2 LightGBM: AUC `0.8122`, accuracy `0.7462`
- 6-month placement, Stage 2 LightGBM: AUC `0.8676`, accuracy `0.8812`
- 12-month placement, Stage 2 LightGBM: AUC `0.8967`, accuracy `0.9542`
- Salary LightGBM: MAE `0.9625 LPA`, RMSE `1.2041 LPA`

## Data Strategy

PlacementIQ uses a hybrid data approach to ensure both realism and privacy:

- **Institutional Data (Actual)**: The model is seeded with actual **NIRF Engineering 2024 rankings**. This provides a grounded baseline for institutional quality, placement history, and regional demand signals.
- **Student-Level Factors (Synthetic)**: Individual student attributes—such as academic performance (CGPA), internship history, certifications, and interview activity—are synthetically generated. This approach allows for a robust, diverse dataset without compromising sensitive private borrower information.

### Normalization & Bias Mitigation

- **GPA Scaling**: Academic results are normalized to a standard 10-point scale, accommodating both Indian and international grading systems.
- **Fairness by Design**: Sensitive demographic features (Gender, Caste, Religion, Origin) are excluded from the model features to prevent automated bias, used only for auditability and fairness monitoring.

## Responsible AI

PlacementIQ is decision support, not an automated loan rejection tool. Every model score is backed by SHAP explainability artifacts so a lender can inspect the drivers behind the score.

## Docker

```powershell
docker build -t placementiq-api .
docker run -p 8000:8000 placementiq-api
```
