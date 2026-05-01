# PlacementIQ Prototype

PlacementIQ is a lender-facing prototype for education-loan portfolio monitoring. It turns the pitch deck concept into a functional demo that shows:

- Portfolio-level education loan risk queue
- Individual borrower Placement Risk Score
- 3, 6, and 12 month placement probability
- Expected salary band
- SHAP-style explainability drivers
- Recommended intervention before moratorium exit
- Live score lab that mirrors the implemented `POST /score` API response

## How to Run

Open `index.html` in any modern browser.

No build step, package install, backend, or internet connection is required. This makes the prototype easy to host with GitHub Pages.

## Model-Backed Pipeline

The repository also includes a runnable ML pipeline under `../ml`:

```bash
.\.venv-win\Scripts\python.exe ml/scripts/generate_synthetic_data.py --rows 25000
.\.venv-win\Scripts\python.exe ml/scripts/train_boosted_models.py
```

It creates synthetic borrower training data from public institute ranking seed signals and saves pitch-aligned XGBoost, LightGBM, and SHAP artifacts in `ml/models/pitch`.

## Suggested Evaluation Flow

1. Start on the Portfolio screen and filter for high-risk borrowers.
2. Select a borrower to inspect the individual risk card.
3. Review the SHAP-style drivers and recommended intervention.
4. Open Score Lab and change normalized CGPA, institute tier, internships, certifications, and sector demand.
5. Show the generated API-style JSON response, then run the FastAPI scorer from `ml/api.py`.

## Prototype Logic

The model pipeline follows the pitch architecture:

- Stage 1 XGBoost institute-course prior
- Stage 2 LightGBM student adjustment
- SHAP explainability artifacts

The browser-only dashboard still uses local JavaScript for display interactivity. The trained model artifacts are served by `ml/api.py` through FastAPI `POST /score`.
