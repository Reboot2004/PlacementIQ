from pathlib import Path
from typing import Dict, List

import joblib
import pandas as pd
import shap
from fastapi import FastAPI
from pydantic import BaseModel, Field, field_validator


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "ml" / "models" / "pitch"
TARGETS = ["placed_3m", "placed_6m", "placed_12m"]
STAGE1_FEATURES = [
    "nirf_rank",
    "nirf_score",
    "institute_tier",
    "course",
    "placement_cell_index",
    "sector_demand_index",
    "historical_course_placement_rate",
]
STAGE2_BASE_FEATURES = STAGE1_FEATURES + [
    "normalized_cgpa_10",
    "backlogs",
    "internships",
    "certifications",
    "job_portal_activity",
    "interview_count",
    "loan_amount_lakh",
    "moratorium_days_left",
]
SALARY_FEATURES = STAGE2_BASE_FEATURES + ["placed_6m_stage1_prior", "placed_12m_stage1_prior"]


class BorrowerScoreRequest(BaseModel):
    borrower_id: str = Field(default="B-DEMO-001")
    nirf_rank: int = Field(ge=1, le=300)
    nirf_score: float = Field(ge=0, le=100)
    institute_tier: int = Field(ge=1, le=3)
    course: str
    normalized_cgpa_10: float = Field(ge=0, le=10)
    backlogs: int = Field(ge=0, le=30)
    internships: int = Field(ge=0, le=10)
    certifications: int = Field(ge=0, le=20)
    job_portal_activity: float = Field(ge=0, le=1)
    interview_count: int = Field(ge=0, le=50)
    placement_cell_index: float = Field(ge=0, le=1)
    sector_demand_index: float = Field(ge=0, le=1)
    historical_course_placement_rate: float = Field(ge=0, le=1)
    loan_amount_lakh: float = Field(gt=0, le=100)
    moratorium_days_left: int = Field(ge=0, le=730)

    @field_validator("course")
    @classmethod
    def valid_course(cls, value: str) -> str:
        allowed = {"btech_cse", "mba", "core_engineering", "commerce_arts"}
        if value not in allowed:
            raise ValueError(f"course must be one of {sorted(allowed)}")
        return value


class ProbabilityResponse(BaseModel):
    three_month: float
    six_month: float
    twelve_month: float


class DriverResponse(BaseModel):
    feature: str
    impact: float


class BorrowerScoreResponse(BaseModel):
    borrower_id: str
    placement_risk_score: int
    risk_flag: str
    placement_probability: ProbabilityResponse
    expected_salary_lpa: float
    expected_salary_band: str
    top_drivers: List[DriverResponse]
    recommended_action: str
    model_family: str


app = FastAPI(
    title="PlacementIQ Scoring API",
    version="1.0.0",
    description="Pitch-aligned XGBoost + LightGBM + SHAP placement-risk scoring API.",
)


def load_artifacts():
    stage1 = {target: joblib.load(MODEL_DIR / f"stage1_xgboost_{target}.joblib") for target in TARGETS}
    stage2 = {target: joblib.load(MODEL_DIR / f"stage2_lightgbm_{target}.joblib") for target in TARGETS}
    explainers = {target: joblib.load(MODEL_DIR / f"shap_explainer_{target}.joblib") for target in TARGETS}
    salary_model = joblib.load(MODEL_DIR / "salary_lightgbm.joblib")
    salary_explainer = joblib.load(MODEL_DIR / "shap_explainer_salary.joblib")
    return stage1, stage2, explainers, salary_model, salary_explainer


STAGE1_MODELS, STAGE2_MODELS, SHAP_EXPLAINERS, SALARY_MODEL, SALARY_EXPLAINER = load_artifacts()


def as_frame(payload: BorrowerScoreRequest) -> pd.DataFrame:
    return pd.DataFrame([payload.model_dump()])


def salary_band(salary_lpa: float) -> str:
    if salary_lpa >= 12:
        return "12+ LPA"
    if salary_lpa >= 8:
        return "8-12 LPA"
    if salary_lpa >= 5:
        return "5-8 LPA"
    return "3-5 LPA"


def risk_flag(score: int) -> str:
    if score >= 75:
        return "Low"
    if score >= 52:
        return "Medium"
    return "High"


def recommendation(flag: str) -> str:
    if flag == "High":
        return "Trigger skill-up referral, placement-cell follow-up, and EMI restructure review."
    if flag == "Medium":
        return "Monitor monthly and request updated interview pipeline status."
    return "Keep in normal monitoring queue and refresh score after offer confirmation."


def shap_drivers(model, explainer, frame: pd.DataFrame, features: List[str], limit: int = 6) -> List[DriverResponse]:
    transformed = model.named_steps["prep"].transform(frame[features])
    feature_names = model.named_steps["prep"].get_feature_names_out()
    values = explainer.shap_values(transformed)
    if isinstance(values, list):
        values = values[-1]
    row_values = values[0]
    ranked = sorted(zip(feature_names, row_values), key=lambda item: abs(item[1]), reverse=True)[:limit]
    return [{"feature": str(name), "impact": round(float(value), 4)} for name, value in ranked]


def score_payload(payload: BorrowerScoreRequest) -> Dict:
    frame = as_frame(payload)

    probabilities = {}
    for target in TARGETS:
        frame[f"{target}_stage1_prior"] = STAGE1_MODELS[target].predict_proba(frame[STAGE1_FEATURES])[:, 1]
        features = STAGE2_BASE_FEATURES + [f"{target}_stage1_prior"]
        probabilities[target] = float(STAGE2_MODELS[target].predict_proba(frame[features])[:, 1][0])

    salary_lpa = float(SALARY_MODEL.predict(frame[SALARY_FEATURES])[0])
    prs = round(probabilities["placed_6m"] * 100)
    flag = risk_flag(prs)

    return {
        "borrower_id": payload.borrower_id,
        "placement_risk_score": prs,
        "risk_flag": flag,
        "placement_probability": {
            "three_month": round(probabilities["placed_3m"] * 100, 1),
            "six_month": round(probabilities["placed_6m"] * 100, 1),
            "twelve_month": round(probabilities["placed_12m"] * 100, 1),
        },
        "expected_salary_lpa": round(max(0.0, salary_lpa), 2),
        "expected_salary_band": salary_band(salary_lpa),
        "top_drivers": shap_drivers(
            STAGE2_MODELS["placed_6m"],
            SHAP_EXPLAINERS["placed_6m"],
            frame,
            STAGE2_BASE_FEATURES + ["placed_6m_stage1_prior"],
        ),
        "recommended_action": recommendation(flag),
        "model_family": "Stage 1 XGBoost + Stage 2 LightGBM + SHAP",
    }


@app.get("/health")
def health():
    return {"status": "ok", "model_dir": str(MODEL_DIR)}


@app.post("/score", response_model=BorrowerScoreResponse)
def score(payload: BorrowerScoreRequest):
    return score_payload(payload)
