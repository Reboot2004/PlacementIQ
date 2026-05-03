from datetime import datetime
from pathlib import Path
from typing import Dict, List

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field, field_validator


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "ml" / "models" / "pitch_pickle"
TRAINING_FILE = ROOT / "ml" / "data" / "processed" / "placementiq_training.csv"
PORTFOLIO_FILE = ROOT / "ml" / "data" / "portfolio.csv"
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

DASHBOARD_REQUIRED_COLUMNS = [
    "borrower_id",
    "name",
    "institute_name",
    "city",
    "course",
    "nirf_rank",
    "nirf_score",
    "institute_tier",
    "normalized_cgpa_10",
    "backlogs",
    "internships",
    "certifications",
    "job_portal_activity",
    "interview_count",
    "placement_cell_index",
    "sector_demand_index",
    "historical_course_placement_rate",
    "loan_amount_lakh",
    "moratorium_days_left",
]


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


class DashboardBorrowerResponse(BaseModel):
    borrower_id: str
    borrower_name: str
    name: str
    city: str
    course: str
    institute: str
    loan_amount_lakh: float
    moratorium_days_left: int
    placement_risk_score: int
    risk_flag: str
    placement_probability: ProbabilityResponse
    expected_salary_band: str
    recommended_action: str
    top_drivers: List[DriverResponse]


class BorrowerDetailResponse(BaseModel):
    borrower_id: str
    borrower_name: str
    city: str
    institute: str
    course: str
    institute_tier: int
    nirf_rank: int
    nirf_score: float
    normalized_cgpa_10: float
    backlogs: int
    internships: int
    certifications: int
    job_portal_activity: float
    interview_count: int
    placement_cell_index: float
    sector_demand_index: float
    historical_course_placement_rate: float
    loan_amount_lakh: float
    moratorium_days_left: int


class BorrowerUpdateRequest(BaseModel):
    borrower_name: str = Field(min_length=1)
    city: str = Field(min_length=1)
    institute: str = Field(min_length=1)
    course: str
    institute_tier: int = Field(ge=1, le=3)
    nirf_rank: int = Field(ge=1, le=300)
    nirf_score: float = Field(ge=0, le=100)
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

class DashboardSummaryResponse(BaseModel):
    total_active_loans: int
    high_risk_count: int
    average_prs: int
    expected_exposure: str
    monitoring_window: str


class DashboardModelResponse(BaseModel):
    family: str
    stage: str
    updated_at: str
    description: str


class DashboardResponse(BaseModel):
    summary: DashboardSummaryResponse
    borrowers: List[DashboardBorrowerResponse]
    model: DashboardModelResponse


app = FastAPI(
    title="PlacementIQ Scoring API",
    version="2.0.0",
    description="PlacementIQ API using trained XGBoost + LightGBM + SHAP artifacts.",
)


def load_artifacts():
    stage1 = {target: joblib.load(MODEL_DIR / f"stage1_xgboost_{target}.pickle") for target in TARGETS}
    stage2 = {target: joblib.load(MODEL_DIR / f"stage2_lightgbm_{target}.pickle") for target in TARGETS}
    salary_model = joblib.load(MODEL_DIR / "salary_lightgbm.pickle")
    
    # Try loading SHAP explainers; skip if numba serialization fails
    explainers = {}
    for target in TARGETS:
        try:
            explainers[target] = joblib.load(MODEL_DIR / f"shap_explainer_{target}.pickle")
        except TypeError as e:
            print(f"Warning: Could not load SHAP explainer for {target}: {e}")
            explainers[target] = None
    
    return stage1, stage2, explainers, salary_model


STAGE1_MODELS, STAGE2_MODELS, SHAP_EXPLAINERS, SALARY_MODEL = load_artifacts()


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


def humanize_feature_name(raw: str) -> str:
    name = raw.split("__", 1)[-1]
    labels = {
        "nirf_rank": "NIRF rank",
        "nirf_score": "NIRF score",
        "normalized_cgpa_10": "CGPA (10-point)",
        "backlogs": "Backlogs",
        "internships": "Internships",
        "certifications": "Certifications",
        "job_portal_activity": "Job portal activity",
        "interview_count": "Interview count",
        "placement_cell_index": "Placement cell activity",
        "sector_demand_index": "Sector demand index",
        "historical_course_placement_rate": "Historical placement rate",
        "loan_amount_lakh": "Loan amount (lakh)",
        "moratorium_days_left": "Moratorium days left",
        "placed_3m_stage1_prior": "Stage 1 placement prior (3m)",
        "placed_6m_stage1_prior": "Stage 1 placement prior (6m)",
        "placed_12m_stage1_prior": "Stage 1 placement prior (12m)",
    }
    if name in labels:
        return labels[name]
    if name.startswith("course_"):
        course = name.replace("course_", "")
        course_labels = {
            "btech_cse": "B.Tech CSE",
            "mba": "MBA",
            "core_engineering": "Core Engineering",
            "commerce_arts": "Arts / Commerce",
        }
        return f"Course: {course_labels.get(course, course)}"
    if name.startswith("institute_tier_"):
        tier = name.replace("institute_tier_", "")
        return f"Institute tier {tier}"
    return " ".join(word.capitalize() for word in name.split("_"))


def shap_drivers(model, explainer, frame: pd.DataFrame, features: List[str], limit: int = 5) -> List[DriverResponse]:
    if explainer is None:
        return []
    
    try:
        transformed = model.named_steps["prep"].transform(frame[features])
        feature_names = model.named_steps["prep"].get_feature_names_out()
        values = explainer.shap_values(transformed)
        if isinstance(values, list):
            values = values[-1]
        row_values = values[0]
        ranked = sorted(zip(feature_names, row_values), key=lambda item: abs(item[1]), reverse=True)[:limit]
        return [{"feature": humanize_feature_name(str(name)), "impact": round(float(value), 3)} for name, value in ranked]
    except Exception as e:
        print(f"Warning: SHAP drivers calculation failed: {e}")
        return []


def fallback_drivers(payload: BorrowerScoreRequest, limit: int = 5) -> List[DriverResponse]:
    demand_impact = 12 if payload.sector_demand_index >= 0.75 else 2 if payload.sector_demand_index >= 0.45 else -12
    drivers = [
        {"feature": "CGPA (10-point)", "impact": round((payload.normalized_cgpa_10 - 7) * 7, 3)},
        {"feature": "Internships", "impact": round(min(payload.internships, 3) * 7 - (9 if payload.internships == 0 else 0), 3)},
        {"feature": "Certifications", "impact": round(min(payload.certifications, 4) * 3 - (5 if payload.certifications == 0 else 0), 3)},
        {"feature": "Institute tier", "impact": float({1: 16, 2: 1, 3: -14}.get(payload.institute_tier, 0))},
        {"feature": "Sector demand", "impact": float(demand_impact)},
        {"feature": "Placement cell activity", "impact": round((payload.placement_cell_index - 0.5) * 18, 3)},
        {"feature": "Job portal activity", "impact": round((payload.job_portal_activity - 0.5) * 14, 3)},
        {"feature": "Moratorium timing", "impact": float(-6 if payload.moratorium_days_left < 90 else 5 if payload.moratorium_days_left > 180 else 0)},
    ]

    ranked = sorted(drivers, key=lambda item: abs(item["impact"]), reverse=True)[:limit]
    return [{"feature": item["feature"], "impact": item["impact"]} for item in ranked]


def score_payload(payload: BorrowerScoreRequest) -> Dict:
    frame = as_frame(payload)

    probabilities: Dict[str, float] = {}
    for target in TARGETS:
        frame[f"{target}_stage1_prior"] = STAGE1_MODELS[target].predict_proba(frame[STAGE1_FEATURES])[:, 1]
        features = STAGE2_BASE_FEATURES + [f"{target}_stage1_prior"]
        probabilities[target] = float(STAGE2_MODELS[target].predict_proba(frame[features])[:, 1][0])

    salary_lpa = float(SALARY_MODEL.predict(frame[SALARY_FEATURES])[0])
    prs = round(probabilities["placed_6m"] * 100)
    flag = risk_flag(prs)

    top_drivers = shap_drivers(
        STAGE2_MODELS["placed_6m"],
        SHAP_EXPLAINERS["placed_6m"],
        frame,
        STAGE2_BASE_FEATURES + ["placed_6m_stage1_prior"],
    )
    if not top_drivers:
        top_drivers = fallback_drivers(payload)

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
        "top_drivers": top_drivers,
        "recommended_action": recommendation(flag),
        "model_family": "Stage 1 XGBoost + Stage 2 LightGBM + SHAP",
    }


def course_label(raw_course: str) -> str:
    mapping = {
        "btech_cse": "B.Tech CSE",
        "mba": "MBA",
        "core_engineering": "Core Engineering",
        "commerce_arts": "Arts / Commerce",
    }
    return mapping.get(raw_course, raw_course)


def dashboard_borrower_name(borrower_id: str) -> str:
    suffix = borrower_id[-6:] if len(borrower_id) > 6 else borrower_id
    return f"Borrower {suffix}"


def exposure_to_cr(lakh_amount: float) -> str:
    crore = lakh_amount / 100
    return f"₹{crore:.1f}Cr"


def validate_dashboard_file(df: pd.DataFrame) -> None:
    missing = [col for col in DASHBOARD_REQUIRED_COLUMNS if col not in df.columns]
    if missing:
        raise HTTPException(
            status_code=500,
            detail=f"Training CSV is missing required columns: {', '.join(missing)}",
        )


def load_portfolio() -> pd.DataFrame:
    if not PORTFOLIO_FILE.exists():
        raise HTTPException(status_code=500, detail=f"Portfolio file not found: {PORTFOLIO_FILE}")

    df = pd.read_csv(PORTFOLIO_FILE)
    validate_dashboard_file(df)
    return df


def save_portfolio(df: pd.DataFrame) -> None:
    df.to_csv(PORTFOLIO_FILE, index=False)


def row_to_score_request(row: pd.Series) -> BorrowerScoreRequest:
    return BorrowerScoreRequest(
        borrower_id=str(row["borrower_id"]),
        nirf_rank=int(row["nirf_rank"]),
        nirf_score=float(row["nirf_score"]),
        institute_tier=int(row["institute_tier"]),
        course=str(row["course"]),
        normalized_cgpa_10=float(row["normalized_cgpa_10"]),
        backlogs=int(row["backlogs"]),
        internships=int(row["internships"]),
        certifications=int(row["certifications"]),
        job_portal_activity=float(row["job_portal_activity"]),
        interview_count=int(row["interview_count"]),
        placement_cell_index=float(row["placement_cell_index"]),
        sector_demand_index=float(row["sector_demand_index"]),
        historical_course_placement_rate=float(row["historical_course_placement_rate"]),
        loan_amount_lakh=float(row["loan_amount_lakh"]),
        moratorium_days_left=int(row["moratorium_days_left"]),
    )


def score_row(row: pd.Series) -> Dict:
    return score_payload(row_to_score_request(row))


def row_to_dashboard_borrower(row: pd.Series) -> Dict:
    scored = score_row(row)
    request = row_to_score_request(row)
    return {
        "borrower_id": request.borrower_id,
        "borrower_name": str(row["name"]),
        "name": str(row["name"]),
        "city": str(row["city"]),
        "course": course_label(request.course),
        "institute": str(row["institute_name"]),
        "loan_amount_lakh": request.loan_amount_lakh,
        "moratorium_days_left": request.moratorium_days_left,
        "placement_risk_score": scored["placement_risk_score"],
        "risk_flag": scored["risk_flag"],
        "placement_probability": scored["placement_probability"],
        "expected_salary_band": scored["expected_salary_band"],
        "recommended_action": scored["recommended_action"],
        "top_drivers": scored["top_drivers"],
    }


def row_to_borrower_detail(row: pd.Series) -> Dict:
    return {
        "borrower_id": str(row["borrower_id"]),
        "borrower_name": str(row["name"]),
        "city": str(row["city"]),
        "institute": str(row["institute_name"]),
        "course": str(row["course"]),
        "institute_tier": int(row["institute_tier"]),
        "nirf_rank": int(row["nirf_rank"]),
        "nirf_score": float(row["nirf_score"]),
        "normalized_cgpa_10": float(row["normalized_cgpa_10"]),
        "backlogs": int(row["backlogs"]),
        "internships": int(row["internships"]),
        "certifications": int(row["certifications"]),
        "job_portal_activity": float(row["job_portal_activity"]),
        "interview_count": int(row["interview_count"]),
        "placement_cell_index": float(row["placement_cell_index"]),
        "sector_demand_index": float(row["sector_demand_index"]),
        "historical_course_placement_rate": float(row["historical_course_placement_rate"]),
        "loan_amount_lakh": float(row["loan_amount_lakh"]),
        "moratorium_days_left": int(row["moratorium_days_left"]),
    }


def find_borrower_index(df: pd.DataFrame, borrower_id: str) -> int:
    matches = df.index[df["borrower_id"].astype(str) == borrower_id].tolist()
    if not matches:
        raise HTTPException(status_code=404, detail=f"Borrower not found: {borrower_id}")
    return int(matches[0])


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_dir": str(MODEL_DIR),
        "training_file": str(TRAINING_FILE),
        "model_files": sorted([p.name for p in MODEL_DIR.glob("*.pickle")]),
    }


@app.post("/score", response_model=BorrowerScoreResponse)
def score(payload: BorrowerScoreRequest):
    return score_payload(payload)


@app.get("/dashboard", response_model=DashboardResponse)
def dashboard(limit: int = Query(default=150, ge=10, le=1000)):
    df = load_portfolio()

    sample = df[DASHBOARD_REQUIRED_COLUMNS].head(limit)
    borrowers: List[Dict] = []

    for _, row in sample.iterrows():
        borrowers.append(row_to_dashboard_borrower(row))

    if not borrowers:
        raise HTTPException(status_code=500, detail="No borrower rows available in portfolio file")

    high_risk_count = sum(1 for borrower in borrowers if borrower["risk_flag"] == "High")
    medium_risk_count = sum(1 for borrower in borrowers if borrower["risk_flag"] == "Medium")
    action_borrowers = [borrower for borrower in borrowers if borrower["risk_flag"] in {"High", "Medium"}]
    avg_prs = round(sum(b["placement_risk_score"] for b in borrowers) / len(borrowers))
    exposure_lakh = sum(b["loan_amount_lakh"] for b in action_borrowers)

    model_updated_at = datetime.fromtimestamp(max(p.stat().st_mtime for p in MODEL_DIR.glob("*.pickle"))).strftime("%Y-%m-%d")

    return {
        "summary": {
            "total_active_loans": len(borrowers),
            "high_risk_count": high_risk_count,
            "average_prs": avg_prs,
            "expected_exposure": exposure_to_cr(exposure_lakh),
            "monitoring_window": f"{high_risk_count + medium_risk_count} borrowers need proactive review",
        },
        "borrowers": borrowers,
        "model": {
            "family": "Stage 1 XGBoost + Stage 2 LightGBM + SHAP",
            "stage": "PlacementIQ education-loan risk stack",
            "updated_at": model_updated_at,
            "description": "Dashboard records come directly from portfolio.csv and are scored with trained model artifacts.",
        },
    }


@app.get("/borrowers/{borrower_id}", response_model=BorrowerDetailResponse)
def get_borrower(borrower_id: str):
    df = load_portfolio()
    row = df.iloc[find_borrower_index(df, borrower_id)]
    return row_to_borrower_detail(row)


@app.put("/borrowers/{borrower_id}", response_model=DashboardBorrowerResponse)
def update_borrower(borrower_id: str, payload: BorrowerUpdateRequest):
    df = load_portfolio()
    row_index = find_borrower_index(df, borrower_id)

    df.loc[row_index, "name"] = payload.borrower_name
    df.loc[row_index, "city"] = payload.city
    df.loc[row_index, "institute_name"] = payload.institute
    df.loc[row_index, "course"] = payload.course
    df.loc[row_index, "institute_tier"] = payload.institute_tier
    df.loc[row_index, "nirf_rank"] = payload.nirf_rank
    df.loc[row_index, "nirf_score"] = payload.nirf_score
    df.loc[row_index, "normalized_cgpa_10"] = payload.normalized_cgpa_10
    df.loc[row_index, "backlogs"] = payload.backlogs
    df.loc[row_index, "internships"] = payload.internships
    df.loc[row_index, "certifications"] = payload.certifications
    df.loc[row_index, "job_portal_activity"] = payload.job_portal_activity
    df.loc[row_index, "interview_count"] = payload.interview_count
    df.loc[row_index, "placement_cell_index"] = payload.placement_cell_index
    df.loc[row_index, "sector_demand_index"] = payload.sector_demand_index
    df.loc[row_index, "historical_course_placement_rate"] = payload.historical_course_placement_rate
    df.loc[row_index, "loan_amount_lakh"] = payload.loan_amount_lakh
    df.loc[row_index, "moratorium_days_left"] = payload.moratorium_days_left

    save_portfolio(df)
    return row_to_dashboard_borrower(df.iloc[row_index])
