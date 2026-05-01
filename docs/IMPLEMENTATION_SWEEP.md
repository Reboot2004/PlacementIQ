# PlacementIQ Implementation Sweep

## Deck Alignment

### Slide 5: PlacementIQ Solution

Implemented:

- Placement Risk Score for borrowers
- 3, 6, and 12 month placement probabilities
- Expected salary band
- Risk flag
- SHAP-style top drivers
- Recommended next action

Where:

- Dashboard: `prototype/index.html`
- API: `ml/api.py`
- Models: `ml/models/pitch`

### Slide 6: Data Architecture

Implemented:

- Student academic profile: normalized CGPA, backlogs, internships, certifications
- Institute and program intelligence: NIRF rank, NIRF score, institute tier, historical course placement rate
- Industry and labor market signals: sector demand index
- Real-time employability signals: job portal activity, interview count
- Historical repayment/outcome proxy: synthetic placement and salary labels

Important limitation:

- Real NBFC repayment outcomes are not available yet, so placement and repayment-style labels are synthetic and clearly marked.

### Slide 7: Model Architecture

Implemented:

- Stage 1 XGBoost institute-course prior
- Stage 2 LightGBM student-level adjustment
- SHAP explainers
- Salary LightGBM model
- Saved model artifacts as `.joblib`

Artifacts:

- `stage1_xgboost_placed_3m.joblib`
- `stage1_xgboost_placed_6m.joblib`
- `stage1_xgboost_placed_12m.joblib`
- `stage2_lightgbm_placed_3m.joblib`
- `stage2_lightgbm_placed_6m.joblib`
- `stage2_lightgbm_placed_12m.joblib`
- `salary_lightgbm.joblib`
- SHAP explainers for all placement models and salary model

### Slide 8: Lender Dashboard

Implemented:

- Portfolio KPI cards
- High-risk monitoring queue
- Borrower detail card
- PRS risk scale
- Probability tiles
- SHAP-style driver bars
- Recommendation box
- Score Lab for live demo exploration

### Slide 9: Responsible AI

Implemented:

- Excludes gender, caste, religion, applicant origin/nationality, and direct demographic identifiers
- Uses normalized CGPA instead of raw GPA scale
- Retains `gpa_scale` and `raw_gpa` only for auditability in the dataset
- Keeps the model as decision support, not an automated rejection engine
- Provides SHAP explainability artifacts

### Slide 11: Execution Plan

Implemented:

- Synthetic/public-seed data generation
- XGBoost and LightGBM training
- SHAP explainability
- FastAPI `POST /score`
- Dockerfile for API deployment
- Static lender dashboard prototype

Partially implemented:

- Scraper exists for NIRF, but local network restrictions blocked a live scrape in this environment.
- Dashboard is not yet wired directly to the FastAPI endpoint; it mirrors the same scoring contract locally for static demo use.

## Next Improvements

1. Connect the dashboard Score Lab directly to `POST /score`.
2. Add a portfolio JSON upload flow so evaluators can score a batch of borrowers.
3. Replace synthetic labels with verified NBFC outcomes during mentorship.
4. Add calibration plots for 3, 6, and 12 month placement probabilities.
5. Add model monitoring views: drift, feature missingness, score distribution, and cohort-level fairness checks.
6. Add lender audit logs for every score request and recommended intervention.
7. Add Streamlit or React-based portfolio analytics if the judges expect richer interactive charts.
8. Add tests for API schema, GPA normalization, protected-feature exclusion, and model artifact loading.
