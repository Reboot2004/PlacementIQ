# PlacementIQ API — Quick Start Guide

## ⚡ 5-Minute Setup

### 1. Install & Run
```bash
cd PlacementIQ
pip install -r requirements.txt
python -m uvicorn ml.api:app --reload
```

### 2. Open Swagger UI
```
http://127.0.0.1:8000/docs
```

### 3. Try It Out
- Click any endpoint
- Fill in example data
- Click "Execute"

---

## 🎯 Common Operations

### Score One Borrower
```bash
curl -X POST http://localhost:8000/score \
  -H "Content-Type: application/json" \
  -d '{
    "borrower_id": "B-TEST-001",
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
  }'
```

### Get All Borrowers
```bash
curl http://localhost:8000/borrowers
```

### Get High-Risk Only
```bash
curl "http://localhost:8000/borrowers?risk=High"
```

### Portfolio Stats
```bash
curl http://localhost:8000/portfolio-stats
```

### Score All & Export
```bash
curl -X POST http://localhost:8000/portfolio-export --output results.csv
```

### Batch Upload CSV
```bash
curl -X POST http://localhost:8000/batch-score \
  -F "file=@borrowers.csv"
```

---

## 📁 Files Created/Modified

| File | Purpose |
|------|---------|
| `ml/api.py` | ✅ Extended with 11 endpoints |
| `ml/data/portfolio.csv` | ✅ Created - 10 demo borrowers |
| `API_ENDPOINTS.md` | ✅ Full endpoint documentation |
| `API_IMPLEMENTATION_SUMMARY.md` | ✅ Implementation overview |
| `test_api.py` | ✅ Validation tests |
| `API_QUICK_START.md` | ✅ This file |

---

## 📊 Data Storage

**CSV-Based Portfolio:**
- File: `ml/data/portfolio.csv`
- Records: 10 demo borrowers
- Columns: 18 (identity, academics, employability, loan details)
- Format: Transparent, version-controllable, audit-friendly

**No database required** — CSV is persisted and reloaded on each request.

---

## 🔧 Endpoint Reference

```
GET  /health                    — System status
POST /score                     — Score one borrower
GET  /borrowers                 — List all (filter by ?risk=)
GET  /borrowers/{id}            — Get one
POST /borrowers                 — Create
PUT  /borrowers/{id}            — Update
DEL  /borrowers/{id}            — Delete
POST /score-portfolio           — Score all
POST /batch-score               — Upload CSV & score
GET  /portfolio-stats           — Portfolio KPIs
POST /portfolio-export          — Download scored CSV
```

---

## ✅ Validation

All endpoints tested and validated:

```bash
python test_api.py
```

Output: ✓ 11 endpoints ✓ 5 response models ✓ 10 demo records ✓ All tests passing

---

## 🚀 Integration Examples

### Python
```python
import requests

# Score a borrower
r = requests.post('http://localhost:8000/score', json={
    'borrower_id': 'B-001',
    'nirf_rank': 50,
    # ... other fields
})
print(r.json())
```

### JavaScript
```javascript
// Fetch API
const response = await fetch('http://localhost:8000/score', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(borrowerData)
});
const result = await response.json();
```

### Dashboard Connection
Update `prototype/app.js`:
```javascript
// Replace local scoring with API call
const scores = await fetch('http://localhost:8000/score-portfolio').then(r => r.json());
```

---

## 🎓 What Each Endpoint Does

### `/score` (POST)
**Purpose:** Score a single borrower  
**Use:** Real-time lending decisions  
**Returns:** PRS, probabilities, salary band, top drivers, recommendation  

### `/borrowers` (GET, POST, PUT, DELETE)
**Purpose:** Manage portfolio records  
**Use:** CRUD operations on borrowers  
**Returns:** Portfolio record(s)  

### `/score-portfolio` (POST)
**Purpose:** Score all borrowers in portfolio  
**Use:** Batch refresh of all scores  
**Returns:** List of scored borrowers  

### `/batch-score` (POST)
**Purpose:** Upload CSV and get scores  
**Use:** Evaluate prospective loans in bulk  
**Returns:** Scored results  

### `/portfolio-stats` (GET)
**Purpose:** Portfolio analytics  
**Use:** KPI dashboard, risk reporting  
**Returns:** Risk breakdown, averages, high-risk list  

### `/portfolio-export` (POST)
**Purpose:** Download scored portfolio as CSV  
**Use:** Risk reporting, external systems  
**Returns:** CSV file download  

---

## 🔍 Request/Response Example

### Request
```json
POST /score
{
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
```

### Response
```json
{
  "borrower_id": "B-001",
  "placement_risk_score": 58,
  "risk_flag": "Medium",
  "placement_probability": {
    "three_month": 35.2,
    "six_month": 52.8,
    "twelve_month": 71.5
  },
  "expected_salary_lpa": 6.25,
  "expected_salary_band": "5-8 LPA",
  "top_drivers": [
    {"feature": "internships", "impact": 0.18},
    {"feature": "placement_cell_index", "impact": 0.15},
    {"feature": "sector_demand_index", "impact": 0.12}
  ],
  "recommended_action": "Monitor monthly and request updated interview pipeline status.",
  "model_family": "Stage 1 XGBoost + Stage 2 LightGBM + SHAP"
}
```

---

## 📈 Portfolio Stats Example

```json
GET /portfolio-stats

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

## 🎯 Next: Connect the Dashboard

Update `prototype/app.js` to use these endpoints instead of local scoring:

```javascript
// OLD: Local scoring
const score = scoreBorrower(record);

// NEW: API call
const response = await fetch('http://localhost:8000/score', {
  method: 'POST',
  body: JSON.stringify(record)
});
const score = await response.json();
```

---

## 💡 Tips

1. **Test in Swagger first:** http://localhost:8000/docs
2. **All endpoints documented:** Read `API_ENDPOINTS.md`
3. **CSV is version-controlled:** Track portfolio changes in git
4. **No database required:** CSV is the source of truth
5. **Extensible:** Add new endpoints by following the pattern

---

## ❓ Troubleshooting

**Port 8000 already in use:**
```bash
python -m uvicorn ml.api:app --port 8001
```

**Module not found errors:**
```bash
pip install -r requirements.txt
```

**CSV not found:**
- Check: `ml/data/portfolio.csv` exists
- Run tests: `python test_api.py`

**Endpoint returns 404:**
- Check borrower_id spelling
- Try listing all: `GET /borrowers`

---

## 📚 Full Documentation

- **API Reference:** `API_ENDPOINTS.md` (complete with examples)
- **Implementation Details:** `API_IMPLEMENTATION_SUMMARY.md`
- **Source Code:** `ml/api.py` (with docstrings)

---

**Ready to go!** 🚀

Start the API and visit http://127.0.0.1:8000/docs to explore all endpoints.
