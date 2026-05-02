export type RiskFlag = "High" | "Medium" | "Low";

export type ProbabilityBreakdown = {
  three_month: number;
  six_month: number;
  twelve_month: number;
};

export type Driver = {
  feature: string;
  impact: number;
};

export type ModelSnapshot = {
  family: string;
  stage: string;
  updated_at: string;
  description: string;
};

export type DashboardBorrower = {
  borrower_id: string;
  borrower_name: string;
  city: string;
  course: string;
  institute: string;
  loan_amount_lakh: number;
  moratorium_days_left: number;
  placement_risk_score: number;
  risk_flag: RiskFlag;
  placement_probability: ProbabilityBreakdown;
  expected_salary_band: string;
  recommended_action: string;
  top_drivers: Driver[];
};

export type DashboardSummary = {
  total_active_loans: number;
  high_risk_count: number;
  average_prs: number;
  expected_exposure: string;
  monitoring_window: string;
};

export type DashboardPayload = {
  summary: DashboardSummary;
  borrowers: DashboardBorrower[];
  model: ModelSnapshot;
};

export type ScoreRequest = {
  borrower_id: string;
  nirf_rank: number;
  nirf_score: number;
  institute_tier: 1 | 2 | 3;
  course: "btech_cse" | "mba" | "core_engineering" | "commerce_arts";
  normalized_cgpa_10: number;
  backlogs: number;
  internships: number;
  certifications: number;
  job_portal_activity: number;
  interview_count: number;
  placement_cell_index: number;
  sector_demand_index: number;
  historical_course_placement_rate: number;
  loan_amount_lakh: number;
  moratorium_days_left: number;
};

export type ScoreResponse = {
  borrower_id: string;
  placement_risk_score: number;
  risk_flag: RiskFlag;
  placement_probability: ProbabilityBreakdown;
  expected_salary_lpa: number;
  expected_salary_band: string;
  top_drivers: Driver[];
  recommended_action: string;
  model_family: string;
};

export const demoDashboardPayload: DashboardPayload = {
  summary: {
    total_active_loans: 2847,
    high_risk_count: 312,
    average_prs: 67,
    expected_exposure: "₹41.8Cr",
    monitoring_window: "Moratorium exits in next 90 days",
  },
  borrowers: [
    {
      borrower_id: "B-1001",
      borrower_name: "Ravi K.",
      city: "Hyderabad",
      course: "B.Tech CSE",
      institute: "Tier-2 Institute",
      loan_amount_lakh: 18,
      moratorium_days_left: 62,
      placement_risk_score: 42,
      risk_flag: "High",
      placement_probability: {
        three_month: 18,
        six_month: 41,
        twelve_month: 67,
      },
      expected_salary_band: "₹3-5 LPA",
      recommended_action: "Skill-up referral + EMI restructure review",
      top_drivers: [
        { feature: "Internships", impact: -8.4 },
        { feature: "Placement cell strength", impact: -6.7 },
        { feature: "CGPA", impact: -5.1 },
        { feature: "Institute tier", impact: -4.8 },
        { feature: "Sector demand", impact: 2.6 },
      ],
    },
    {
      borrower_id: "B-1002",
      borrower_name: "Ananya S.",
      city: "Pune",
      course: "MBA",
      institute: "Tier-1 Business School",
      loan_amount_lakh: 22,
      moratorium_days_left: 118,
      placement_risk_score: 79,
      risk_flag: "Low",
      placement_probability: {
        three_month: 63,
        six_month: 84,
        twelve_month: 94,
      },
      expected_salary_band: "₹8-12 LPA",
      recommended_action: "Normal monitoring queue",
      top_drivers: [
        { feature: "Sector demand", impact: 9.4 },
        { feature: "Placement cell strength", impact: 7.8 },
        { feature: "Internships", impact: 6.2 },
        { feature: "Institute tier", impact: 5.6 },
        { feature: "CGPA", impact: 4.1 },
      ],
    },
    {
      borrower_id: "B-1003",
      borrower_name: "Mohit R.",
      city: "Indore",
      course: "Core Engineering",
      institute: "Tier-3 College",
      loan_amount_lakh: 12,
      moratorium_days_left: 41,
      placement_risk_score: 36,
      risk_flag: "High",
      placement_probability: {
        three_month: 15,
        six_month: 34,
        twelve_month: 58,
      },
      expected_salary_band: "₹3-5 LPA",
      recommended_action: "Placement-cell review + repayment outreach",
      top_drivers: [
        { feature: "Institute tier", impact: -9.8 },
        { feature: "Sector demand", impact: -8.4 },
        { feature: "Internships", impact: -6.5 },
        { feature: "CGPA", impact: -4.7 },
        { feature: "Moratorium timing", impact: -3.1 },
      ],
    },
    {
      borrower_id: "B-1004",
      borrower_name: "Nisha P.",
      city: "Bengaluru",
      course: "B.Tech CSE",
      institute: "NIT Program",
      loan_amount_lakh: 16,
      moratorium_days_left: 142,
      placement_risk_score: 83,
      risk_flag: "Low",
      placement_probability: {
        three_month: 72,
        six_month: 88,
        twelve_month: 95,
      },
      expected_salary_band: "₹8-12 LPA",
      recommended_action: "Normal monitoring queue",
      top_drivers: [
        { feature: "CGPA", impact: 8.7 },
        { feature: "Placement cell strength", impact: 7.6 },
        { feature: "Internships", impact: 6.9 },
        { feature: "Sector demand", impact: 6.1 },
        { feature: "Institute tier", impact: 5.4 },
      ],
    },
    {
      borrower_id: "B-1005",
      borrower_name: "Aman V.",
      city: "Jaipur",
      course: "Arts / Commerce",
      institute: "Tier-2 University",
      loan_amount_lakh: 9,
      moratorium_days_left: 86,
      placement_risk_score: 58,
      risk_flag: "Medium",
      placement_probability: {
        three_month: 28,
        six_month: 56,
        twelve_month: 74,
      },
      expected_salary_band: "₹5-8 LPA",
      recommended_action: "Monitor monthly and update interview pipeline",
      top_drivers: [
        { feature: "Sector demand", impact: 4.8 },
        { feature: "CGPA", impact: 3.5 },
        { feature: "Certifications", impact: 3.1 },
        { feature: "Placement cell strength", impact: 2.6 },
        { feature: "Moratorium timing", impact: -2.1 },
      ],
    },
    {
      borrower_id: "B-1006",
      borrower_name: "Meera I.",
      city: "Chennai",
      course: "MBA",
      institute: "Tier-2 Business School",
      loan_amount_lakh: 20,
      moratorium_days_left: 57,
      placement_risk_score: 64,
      risk_flag: "Medium",
      placement_probability: {
        three_month: 36,
        six_month: 61,
        twelve_month: 81,
      },
      expected_salary_band: "₹5-8 LPA",
      recommended_action: "Monitor monthly and update interview pipeline",
      top_drivers: [
        { feature: "Internships", impact: 6.7 },
        { feature: "Sector demand", impact: 5.2 },
        { feature: "Placement cell strength", impact: 4.3 },
        { feature: "CGPA", impact: 3.6 },
        { feature: "Moratorium timing", impact: -2.8 },
      ],
    },
  ],
  model: {
    family: "Stage 1 XGBoost + Stage 2 LightGBM + SHAP",
    stage: "Pitch-aligned education loan risk pipeline",
    updated_at: "2026-05-02",
    description: "Portfolio scores update from live borrower records, then surface explainable interventions.",
  },
};

export const demoScoreRequest: ScoreRequest = {
  borrower_id: "B-DEMO-001",
  nirf_rank: 182,
  nirf_score: 73.4,
  institute_tier: 2,
  course: "btech_cse",
  normalized_cgpa_10: 7.1,
  backlogs: 0,
  internships: 0,
  certifications: 1,
  job_portal_activity: 0.42,
  interview_count: 2,
  placement_cell_index: 0.54,
  sector_demand_index: 0.46,
  historical_course_placement_rate: 0.51,
  loan_amount_lakh: 18,
  moratorium_days_left: 75,
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function riskTone(value: RiskFlag) {
  switch (value) {
    case "Low":
      return "emerald";
    case "Medium":
      return "amber";
    default:
      return "rose";
  }
}

export function salaryBandFromLpa(value: number) {
  if (value >= 12) return "12+ LPA";
  if (value >= 8) return "8-12 LPA";
  if (value >= 5) return "5-8 LPA";
  return "3-5 LPA";
}

export function recommendationFromFlag(flag: RiskFlag) {
  if (flag === "High") {
    return "Trigger skill-up referral, placement-cell follow-up, and EMI restructure review.";
  }
  if (flag === "Medium") {
    return "Monitor monthly and request an updated interview pipeline status.";
  }
  return "Keep in the normal monitoring queue and refresh after offer confirmation.";
}

export function buildScorePreview(request: ScoreRequest): ScoreResponse {
  const tierEffect = { 1: 15, 2: 2, 3: -13 }[request.institute_tier];
  const courseEffect = {
    btech_cse: 7,
    mba: 8,
    core_engineering: -6,
    commerce_arts: -4,
  }[request.course];

  const cgpaEffect = (request.normalized_cgpa_10 - 7) * 8.5;
  const backlogEffect = -Math.min(request.backlogs, 6) * 6.5;
  const internshipEffect = Math.min(request.internships, 4) * 5 - (request.internships === 0 ? 7 : 0);
  const certificationEffect = Math.min(request.certifications, 6) * 2.4 - (request.certifications === 0 ? 4 : 0);
  const portalEffect = (request.job_portal_activity - 0.5) * 14;
  const interviewEffect = Math.min(request.interview_count, 10) * 1.6;
  const placementCellEffect = (request.placement_cell_index - 0.5) * 18;
  const sectorEffect = (request.sector_demand_index - 0.5) * 20;
  const historicalEffect = (request.historical_course_placement_rate - 0.5) * 16;
  const moratoriumEffect = request.moratorium_days_left < 90 ? -7 : request.moratorium_days_left > 180 ? 4 : 0;
  const loanEffect = request.loan_amount_lakh > 25 ? -3 : request.loan_amount_lakh > 18 ? -1 : 0;

  const placement_risk_score = clamp(
    Math.round(
      59 +
        tierEffect +
        courseEffect +
        cgpaEffect +
        backlogEffect +
        internshipEffect +
        certificationEffect +
        portalEffect +
        interviewEffect +
        placementCellEffect +
        sectorEffect +
        historicalEffect +
        moratoriumEffect +
        loanEffect,
    ),
    8,
    96,
  );

  const risk_flag: RiskFlag = placement_risk_score >= 75 ? "Low" : placement_risk_score >= 52 ? "Medium" : "High";
  const three_month = clamp(Math.round(placement_risk_score * 0.58 - 6), 5, 92);
  const six_month = clamp(Math.round(placement_risk_score * 0.74 + 6), 8, 97);
  const twelve_month = clamp(Math.round(placement_risk_score * 0.87 + 3), 14, 99);

  const salaryBase = {
    btech_cse: 4.8,
    mba: 6.5,
    core_engineering: 4.4,
    commerce_arts: 3.9,
  }[request.course];
  const expected_salary_lpa = clamp(Number((salaryBase + (placement_risk_score - 50) / 7.5).toFixed(1)), 3, 18);

  const driverMap: Array<[string, number]> = [
    ["Institute tier", tierEffect],
    ["CGPA", cgpaEffect],
    ["Sector demand", sectorEffect],
    ["Placement cell strength", placementCellEffect],
    ["Internships", internshipEffect],
    ["Certifications", certificationEffect],
    ["Historical placement rate", historicalEffect],
    ["Job portal activity", portalEffect],
    ["Interview count", interviewEffect],
    ["Moratorium timing", moratoriumEffect],
    ["Loan size", loanEffect],
    ["Backlogs", backlogEffect],
  ];

  const top_drivers = driverMap
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .slice(0, 5)
    .map(([feature, impact]) => ({ feature, impact: Number(impact.toFixed(1)) }));

  return {
    borrower_id: request.borrower_id,
    placement_risk_score,
    risk_flag,
    placement_probability: {
      three_month,
      six_month,
      twelve_month,
    },
    expected_salary_lpa,
    expected_salary_band: salaryBandFromLpa(expected_salary_lpa),
    top_drivers,
    recommended_action: recommendationFromFlag(risk_flag),
    model_family: "Stage 1 XGBoost + Stage 2 LightGBM + SHAP",
  };
}
