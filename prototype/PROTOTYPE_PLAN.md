# PlacementIQ Prototype Plan

## What Needs to Be Developed

PlacementIQ should be a lender-facing decision-support prototype for NBFC education loan portfolios. The product must help a portfolio or risk manager identify students whose moratorium is ending soon and who may not get placed in time to begin repayment comfortably.

The prototype should not look like a student coaching app or a generic credit-score page. It should demonstrate the missing forward-looking placement signal described in the pitch deck.

## Core User

Risk, collections, or portfolio monitoring teams at Poonawalla Fincorp / NBFC education lenders.

## Demo Goals

1. Show portfolio-level monitoring for active education loans.
2. Highlight borrowers with moratorium ending within 90 days.
3. Generate a Placement Risk Score for each borrower.
4. Show placement probability at 3, 6, and 12 months.
5. Estimate salary band using course and institute context.
6. Explain the score with SHAP-style ranked drivers.
7. Recommend proactive interventions such as skill-up referral, placement-cell follow-up, or EMI restructure review.
8. Show how the frontend maps to the implemented scoring API through a live JSON preview.

## Prototype Build Scope

Current implementation:

- Static HTML/CSS/JS dashboard
- Portfolio queue with search, risk filter, sort, and selectable borrower rows
- Borrower card with PRS, risk flag, probabilities, salary band, drivers, and recommendation
- Score Lab form that changes model inputs and updates the score live
- API-style JSON preview for the implemented `POST /score` endpoint
- Model explanation screen covering data layers, two-stage model flow, and responsible AI controls

## Implementation Logic

The prototype uses the pitch-aligned model pipeline:

- Stage 1 XGBoost institute-course prior
- Stage 2 LightGBM student-level adjustment
- SHAP explainability artifacts

The backend API now serves trained XGBoost/LightGBM predictions and SHAP-style drivers from the pitch-aligned model artifacts.

## Next Engineering Milestones

1. Move sample portfolio data into a JSON or database layer.
2. Connect the browser dashboard directly to FastAPI in a hosted deployment.
3. Replace synthetic labels with verified NBFC historical outcomes.
4. Add authentication and audit logging for lender users.
