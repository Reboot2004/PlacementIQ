from pathlib import Path
from typing import Dict, List, Optional
from io import StringIO

import joblib
import pandas as pd
import shap
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "ml" / "models" / "pitch"
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


class BorrowerPortfolioRecord(BaseModel):
    borrower_id: str
    institute_name: str
    city: str
    nirf_rank: int
    nirf_score: float
    institute_tier: int
    course: str
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


class ScoredBorrower(BorrowerScoreResponse):
    institute_name: str
    city: str
    loan_amount_lakh: float
    moratorium_days_left: int


class PortfolioStatsResponse(BaseModel):
    total_borrowers: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    avg_prs: float
    total_exposure_crore: float
    high_risk_borrowers: List[str]


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


def load_portfolio() -> pd.DataFrame:
    """Load portfolio from CSV. Returns empty DataFrame if file doesn't exist."""
    if PORTFOLIO_FILE.exists():
        return pd.read_csv(PORTFOLIO_FILE)
    return pd.DataFrame()


def save_portfolio(df: pd.DataFrame) -> None:
    """Save portfolio DataFrame to CSV."""
    PORTFOLIO_FILE.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(PORTFOLIO_FILE, index=False)


def record_to_score_request(record: pd.Series) -> BorrowerScoreRequest:
    """Convert portfolio record to scoring request."""
    return BorrowerScoreRequest(
        borrower_id=record["borrower_id"],
        nirf_rank=int(record["nirf_rank"]),
        nirf_score=float(record["nirf_score"]),
        institute_tier=int(record["institute_tier"]),
        course=record["course"],
        normalized_cgpa_10=float(record["normalized_cgpa_10"]),
        backlogs=int(record["backlogs"]),
        internships=int(record["internships"]),
        certifications=int(record["certifications"]),
        job_portal_activity=float(record["job_portal_activity"]),
        interview_count=int(record["interview_count"]),
        placement_cell_index=float(record["placement_cell_index"]),
        sector_demand_index=float(record["sector_demand_index"]),
        historical_course_placement_rate=float(record["historical_course_placement_rate"]),
        loan_amount_lakh=float(record["loan_amount_lakh"]),
        moratorium_days_left=int(record["moratorium_days_left"]),
    )


def score_portfolio_record(record: pd.Series) -> Dict:
    """Score a single portfolio record."""
    req = record_to_score_request(record)
    base_score = score_payload(req)
    return {
        **base_score,
        "institute_name": record["institute_name"],
        "city": record["city"],
        "loan_amount_lakh": float(record["loan_amount_lakh"]),
        "moratorium_days_left": int(record["moratorium_days_left"]),
    }


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
    return {"status": "ok", "model_dir": str(MODEL_DIR), "portfolio_file": str(PORTFOLIO_FILE)}


@app.post("/score", response_model=BorrowerScoreResponse)
def score(payload: BorrowerScoreRequest):
    """Score a single borrower."""
    return score_payload(payload)


@app.get("/borrowers", response_model=List[BorrowerPortfolioRecord])
def list_borrowers(risk: Optional[str] = Query(None)):
    """List all borrowers in portfolio, optionally filtered by risk level."""
    portfolio = load_portfolio()
    if portfolio.empty:
        return []
    
    # Score each borrower to get risk level if filtering
    if risk:
        scored = []
        for _, record in portfolio.iterrows():
            score_result = score_portfolio_record(record)
            if score_result["risk_flag"] == risk:
                scored.append(record)
        portfolio = pd.DataFrame(scored)
    
    return [
        BorrowerPortfolioRecord(**row.to_dict())
        for _, row in portfolio.iterrows()
    ]


@app.get("/borrowers/{borrower_id}", response_model=BorrowerPortfolioRecord)
def get_borrower(borrower_id: str):
    """Get a single borrower record."""
    portfolio = load_portfolio()
    record = portfolio[portfolio["borrower_id"] == borrower_id]
    if record.empty:
        raise HTTPException(status_code=404, detail=f"Borrower {borrower_id} not found")
    return BorrowerPortfolioRecord(**record.iloc[0].to_dict())


@app.post("/borrowers", response_model=BorrowerPortfolioRecord)
def create_borrower(borrower: BorrowerPortfolioRecord):
    """Create a new borrower record in portfolio."""
    portfolio = load_portfolio()
    
    if not portfolio.empty and (portfolio["borrower_id"] == borrower.borrower_id).any():
        raise HTTPException(status_code=409, detail=f"Borrower {borrower.borrower_id} already exists")
    
    new_record = pd.DataFrame([borrower.model_dump()])
    portfolio = pd.concat([portfolio, new_record], ignore_index=True)
    save_portfolio(portfolio)
    return borrower


@app.put("/borrowers/{borrower_id}", response_model=BorrowerPortfolioRecord)
def update_borrower(borrower_id: str, borrower: BorrowerPortfolioRecord):
    """Update an existing borrower record."""
    portfolio = load_portfolio()
    
    if portfolio.empty or not (portfolio["borrower_id"] == borrower_id).any():
        raise HTTPException(status_code=404, detail=f"Borrower {borrower_id} not found")
    
    portfolio.loc[portfolio["borrower_id"] == borrower_id] = pd.Series(borrower.model_dump())
    save_portfolio(portfolio)
    return borrower


@app.delete("/borrowers/{borrower_id}")
def delete_borrower(borrower_id: str):
    """Delete a borrower record."""
    portfolio = load_portfolio()
    
    if portfolio.empty or not (portfolio["borrower_id"] == borrower_id).any():
        raise HTTPException(status_code=404, detail=f"Borrower {borrower_id} not found")
    
    portfolio = portfolio[portfolio["borrower_id"] != borrower_id]
    save_portfolio(portfolio)
    return {"message": f"Borrower {borrower_id} deleted"}


@app.post("/score-portfolio", response_model=List[ScoredBorrower])
def score_portfolio():
    """Score all borrowers in the portfolio."""
    portfolio = load_portfolio()
    if portfolio.empty:
        raise HTTPException(status_code=400, detail="Portfolio is empty")
    
    scored_borrowers = []
    for _, record in portfolio.iterrows():
        scored = score_portfolio_record(record)
        scored_borrowers.append(scored)
    
    return scored_borrowers


@app.post("/batch-score")
async def batch_score(file: UploadFile = File(...)):
    """Score borrowers from uploaded CSV file."""
    try:
        content = await file.read()
        df = pd.read_csv(StringIO(content.decode("utf-8")))
        
        # Validate required columns
        required_cols = [
            "nirf_rank", "nirf_score", "institute_tier", "course",
            "normalized_cgpa_10", "backlogs", "internships", "certifications",
            "job_portal_activity", "interview_count", "placement_cell_index",
            "sector_demand_index", "historical_course_placement_rate",
            "loan_amount_lakh", "moratorium_days_left"
        ]
        
        missing = [col for col in required_cols if col not in df.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing columns: {missing}")
        
        # Add borrower_id if not present
        if "borrower_id" not in df.columns:
            df["borrower_id"] = [f"B-BATCH-{i:06d}" for i in range(len(df))]
        
        scored_results = []
        for _, record in df.iterrows():
            req = BorrowerScoreRequest(**{col: record[col] for col in required_cols})
            req.borrower_id = record["borrower_id"]
            scored_results.append(score_payload(req))
        
        return scored_results
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/portfolio-stats", response_model=PortfolioStatsResponse)
def portfolio_stats():
    """Get portfolio statistics."""
    portfolio = load_portfolio()
    if portfolio.empty:
        return PortfolioStatsResponse(
            total_borrowers=0,
            high_risk_count=0,
            medium_risk_count=0,
            low_risk_count=0,
            avg_prs=0,
            total_exposure_crore=0,
            high_risk_borrowers=[]
        )
    
    scored = []
    for _, record in portfolio.iterrows():
        scored.append(score_portfolio_record(record))
    
    high_risk = [s for s in scored if s["risk_flag"] == "High"]
    medium_risk = [s for s in scored if s["risk_flag"] == "Medium"]
    low_risk = [s for s in scored if s["risk_flag"] == "Low"]
    
    avg_prs = sum(s["placement_risk_score"] for s in scored) / len(scored) if scored else 0
    total_exposure = sum(s["loan_amount_lakh"] for s in scored) / 100  # Convert to crores
    
    return PortfolioStatsResponse(
        total_borrowers=len(scored),
        high_risk_count=len(high_risk),
        medium_risk_count=len(medium_risk),
        low_risk_count=len(low_risk),
        avg_prs=round(avg_prs, 1),
        total_exposure_crore=round(total_exposure, 2),
        high_risk_borrowers=[s["borrower_id"] for s in high_risk]
    )


@app.post("/portfolio-export")
def export_portfolio():
    """Export scored portfolio as CSV."""
    portfolio = load_portfolio()
    if portfolio.empty:
        raise HTTPException(status_code=400, detail="Portfolio is empty")
    
    scored = []
    for _, record in portfolio.iterrows():
        scored.append(score_portfolio_record(record))
    
    # Create DataFrame from scored results
    export_df = pd.DataFrame(scored)
    
    csv_buffer = StringIO()
    export_df.to_csv(csv_buffer, index=False)
    csv_buffer.seek(0)
    
    return StreamingResponse(
        iter([csv_buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=scored_portfolio.csv"}
    )
