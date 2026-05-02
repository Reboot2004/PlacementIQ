# PlacementIQ API Endpoints

## Overview

The PlacementIQ API provides endpoints for single-borrower scoring, portfolio management, batch operations, and statistics. All data is persisted in a CSV-based portfolio file at `ml/data/portfolio.csv`.

## Data Persistence Strategy

- **Storage**: CSV file at `ml/data/portfolio.csv`
- **Why CSV**: Transparent, human-readable, version-controllable, no database setup required
- **Columns**: borrower_id, institute_name, city, nirf_rank, nirf_score, institute_tier, course, normalized_cgpa_10, backlogs, internships, certifications, job_portal_activity, interview_count, placement_cell_index, sector_demand_index, historical_course_placement_rate, loan_amount_lakh, moratorium_days_left

## Endpoints

### Health & System

#### `GET /health`
Check API health and model status.

**Response:**
```json
{
  "status": "ok",
  "model_dir": "/path/to/models/pitch",
  "portfolio_file": "/path/to/portfolio.csv"
}
```

---

### Single Borrower Scoring

#### `POST /score`
Score a single borrower without adding to portfolio.

**Request Body:**
```json
{
  "borrower_id": "B-DEMO-001",
  "nirf_rank": 57,
  "nirf_score": 51.52,
  "institute_tier": 2,
  "course": "btech_cse",
  "normalized_cgpa_10": 7.1,
  "backlogs": 1,
  "internships": 0,
  "certifications": 0,
  "job_portal_activity": 0.34,
  "interview_count": 0,
  "placement_cell_index": 0.55,
  "sector_demand_index": 0.52,
  "historical_course_placement_rate": 0.62,
  "loan_amount_lakh": 18.0,
  "moratorium_days_left": 75
}
```

**Response:**
```json
{
  "borrower_id": "B-DEMO-001",
  "placement_risk_score": 42,
  "risk_flag": "High",
  "placement_probability": {
    "three_month": 18.5,
    "six_month": 41.2,
    "twelve_month": 67.8
  },
  "expected_salary_lpa": 4.85,
  "expected_salary_band": "3-5 LPA",
  "top_drivers": [
    {"feature": "internships", "impact": -0.25},
    {"feature": "institute_tier", "impact": -0.18},
    ...
  ],
  "recommended_action": "Trigger skill-up referral, placement-cell follow-up, and EMI restructure review.",
  "model_family": "Stage 1 XGBoost + Stage 2 LightGBM + SHAP"
}
```

---

### Portfolio Management (CRUD)

#### `GET /borrowers`
List all borrowers in portfolio.

**Query Parameters:**
- `risk` (optional): Filter by risk level (`High`, `Medium`, `Low`)

**Example:**
```
GET /borrowers?risk=High
```

**Response:**
```json
[
  {
    "borrower_id": "B-DEMO-001",
    "institute_name": "Tier-2 Institute",
    "city": "Hyderabad",
    "nirf_rank": 57,
    "nirf_score": 51.52,
    "institute_tier": 2,
    "course": "btech_cse",
    "normalized_cgpa_10": 7.1,
    "backlogs": 1,
    "internships": 0,
    "certifications": 0,
    "job_portal_activity": 0.34,
    "interview_count": 0,
    "placement_cell_index": 0.55,
    "sector_demand_index": 0.52,
    "historical_course_placement_rate": 0.62,
    "loan_amount_lakh": 18.0,
    "moratorium_days_left": 75
  }
]
```

---

#### `GET /borrowers/{borrower_id}`
Get a single borrower record by ID.

**Response:**
```json
{
  "borrower_id": "B-DEMO-001",
  "institute_name": "Tier-2 Institute",
  "city": "Hyderabad",
  ...
}
```

**Status Codes:**
- `200`: Success
- `404`: Borrower not found

---

#### `POST /borrowers`
Create a new borrower record in the portfolio.

**Request Body:**
```json
{
  "borrower_id": "B-NEW-001",
  "institute_name": "NIT Rourkee",
  "city": "Roorkee",
  "nirf_rank": 21,
  "nirf_score": 62.5,
  "institute_tier": 1,
  "course": "btech_cse",
  "normalized_cgpa_10": 8.2,
  "backlogs": 0,
  "internships": 2,
  "certifications": 2,
  "job_portal_activity": 0.75,
  "interview_count": 3,
  "placement_cell_index": 0.85,
  "sector_demand_index": 0.90,
  "historical_course_placement_rate": 0.95,
  "loan_amount_lakh": 15.0,
  "moratorium_days_left": 120
}
```

**Status Codes:**
- `200`: Created successfully
- `409`: Borrower already exists

---

#### `PUT /borrowers/{borrower_id}`
Update an existing borrower record.

**Request Body:** Same structure as POST

**Status Codes:**
- `200`: Updated successfully
- `404`: Borrower not found

---

#### `DELETE /borrowers/{borrower_id}`
Delete a borrower record from the portfolio.

**Response:**
```json
{
  "message": "Borrower B-DEMO-001 deleted"
}
```

**Status Codes:**
- `200`: Deleted successfully
- `404`: Borrower not found

---

### Batch Operations

#### `POST /score-portfolio`
Score all borrowers currently in the portfolio.

**Response:**
```json
[
  {
    "borrower_id": "B-DEMO-001",
    "placement_risk_score": 42,
    "risk_flag": "High",
    "placement_probability": {...},
    "expected_salary_lpa": 4.85,
    "expected_salary_band": "3-5 LPA",
    "top_drivers": [...],
    "recommended_action": "...",
    "model_family": "Stage 1 XGBoost + Stage 2 LightGBM + SHAP",
    "institute_name": "Tier-2 Institute",
    "city": "Hyderabad",
    "loan_amount_lakh": 18.0,
    "moratorium_days_left": 75
  },
  ...
]
```

**Status Codes:**
- `200`: Success
- `400`: Portfolio is empty

---

#### `POST /batch-score`
Score borrowers from an uploaded CSV file.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- File: CSV with columns for borrower features

**CSV Headers Required:**
```
nirf_rank, nirf_score, institute_tier, course, normalized_cgpa_10, backlogs, internships, 
certifications, job_portal_activity, interview_count, placement_cell_index, sector_demand_index,
historical_course_placement_rate, loan_amount_lakh, moratorium_days_left
```

**Optional:** `borrower_id` (auto-generated as `B-BATCH-000001`, etc. if not provided)

**Response:**
```json
[
  {
    "borrower_id": "B-BATCH-000001",
    "placement_risk_score": 58,
    "risk_flag": "Medium",
    ...
  },
  ...
]
```

**Status Codes:**
- `200`: Scored successfully
- `400`: Missing required columns or file parsing error

**Example using cURL:**
```bash
curl -X POST http://localhost:8000/batch-score \
  -F "file=@borrowers.csv"
```

---

### Portfolio Analytics

#### `GET /portfolio-stats`
Get high-level portfolio statistics and risk summary.

**Response:**
```json
{
  "total_borrowers": 10,
  "high_risk_count": 3,
  "medium_risk_count": 4,
  "low_risk_count": 3,
  "avg_prs": 58.2,
  "total_exposure_crore": 15.47,
  "high_risk_borrowers": ["B-DEMO-001", "B-DEMO-003", "B-DEMO-008"]
}
```

---

#### `POST /portfolio-export`
Export the entire scored portfolio as a CSV file.

**Response:** CSV file download with columns including all borrower features plus scoring results.

**Status Codes:**
- `200`: Export successful (file download)
- `400`: Portfolio is empty

**Example using cURL:**
```bash
curl -X POST http://localhost:8000/portfolio-export \
  --output scored_portfolio.csv
```

---

## Usage Examples

### 1. Start the API

```bash
# From repository root
.\.venv-win\Scripts\python.exe -m uvicorn ml.api:app --reload
```

Then navigate to: `http://127.0.0.1:8000/docs`

### 2. Score a Single Borrower (Python)

```python
import requests

response = requests.post(
    "http://localhost:8000/score",
    json={
        "borrower_id": "B-001",
        "nirf_rank": 50,
        "nirf_score": 55.0,
        "institute_tier": 2,
        "course": "btech_cse",
        "normalized_cgpa_10": 7.5,
        "backlogs": 0,
        "internships": 1,
        "certifications": 1,
        "job_portal_activity": 0.5,
        "interview_count": 2,
        "placement_cell_index": 0.6,
        "sector_demand_index": 0.7,
        "historical_course_placement_rate": 0.8,
        "loan_amount_lakh": 15.0,
        "moratorium_days_left": 90
    }
)
print(response.json())
```

### 3. Create and List Portfolio Borrowers (Python)

```python
import requests

# Create
requests.post("http://localhost:8000/borrowers", json={
    "borrower_id": "B-NEW-001",
    "institute_name": "IIT Bombay",
    "city": "Mumbai",
    "nirf_rank": 5,
    "nirf_score": 75.0,
    "institute_tier": 1,
    "course": "btech_cse",
    "normalized_cgpa_10": 8.5,
    "backlogs": 0,
    "internships": 3,
    "certifications": 2,
    "job_portal_activity": 0.8,
    "interview_count": 4,
    "placement_cell_index": 0.9,
    "sector_demand_index": 0.95,
    "historical_course_placement_rate": 0.98,
    "loan_amount_lakh": 20.0,
    "moratorium_days_left": 150
})

# List all
response = requests.get("http://localhost:8000/borrowers")
print(response.json())

# List high-risk only
response = requests.get("http://localhost:8000/borrowers?risk=High")
print(response.json())
```

### 4. Batch Score from CSV

```bash
# Create a CSV file (batch.csv)
# nirf_rank,nirf_score,institute_tier,course,normalized_cgpa_10,backlogs,...
# 50,55.0,2,btech_cse,7.5,0,...
# 100,50.0,3,core_engineering,6.5,2,...

# Upload and score
curl -X POST http://localhost:8000/batch-score \
  -F "file=@batch.csv" \
  > batch_results.json
```

### 5. Get Portfolio Statistics and Export

```python
import requests

# Stats
stats = requests.get("http://localhost:8000/portfolio-stats").json()
print(f"Total borrowers: {stats['total_borrowers']}")
print(f"High risk: {stats['high_risk_count']}")
print(f"Portfolio exposure: ₹{stats['total_exposure_crore']} Cr")

# Export as CSV
response = requests.post("http://localhost:8000/portfolio-export")
with open("scored_portfolio.csv", "wb") as f:
    f.write(response.content)
```

---

## Error Handling

All endpoints return standard HTTP status codes:

- `200`: Success
- `400`: Bad request (validation error, missing fields, empty portfolio)
- `404`: Resource not found (borrower ID)
- `409`: Conflict (duplicate borrower ID on create)
- `500`: Server error

Error responses include a detail message:
```json
{
  "detail": "Borrower B-UNKNOWN already exists"
}
```

---

## CSV Portfolio Format

The portfolio CSV stores all borrower records and is the source of truth for portfolio management.

**Location:** `ml/data/portfolio.csv`

**Columns:**
```
borrower_id, institute_name, city, nirf_rank, nirf_score, institute_tier, course, 
normalized_cgpa_10, backlogs, internships, certifications, job_portal_activity, 
interview_count, placement_cell_index, sector_demand_index, historical_course_placement_rate,
loan_amount_lakh, moratorium_days_left
```

**Sample rows included:** 10 demo borrowers (B-DEMO-001 through B-DEMO-010)

---

## Next Steps

1. Connect the dashboard (`prototype/index.html`) to use these endpoints instead of local JavaScript scoring
2. Add authentication (API keys / bearer tokens) for production deployments
3. Add request/response logging and audit trails
4. Implement pagination for `/borrowers` endpoint for large portfolios
5. Add scheduled batch retraining triggers via `/retrain` endpoint
