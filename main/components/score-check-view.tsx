"use client";

import { useMemo, useState } from "react";
import { demoScoreRequest, type ScoreRequest, type ScoreResponse } from "@/lib/placementiq";

type ScoreInput = Omit<ScoreRequest, "borrower_id">;

const { borrower_id: _borrowerId, ...demoInput } = demoScoreRequest;
const initialFormState: ScoreInput = demoInput;

const courseOptions = [
  { value: "btech_cse", label: "B.Tech CSE" },
  { value: "mba", label: "MBA" },
  { value: "core_engineering", label: "Core Engineering" },
  { value: "commerce_arts", label: "Arts / Commerce" },
] as const;

type ScoreErrors = Partial<Record<keyof ScoreInput, string>>;

function validateScoreRequest(input: ScoreInput): ScoreErrors {
  const errors: ScoreErrors = {};

  const numberInRange = (
    key: keyof ScoreInput,
    value: number,
    min: number,
    max: number,
    label: string,
    integerOnly = false,
  ) => {
    if (!Number.isFinite(value)) {
      errors[key] = `${label} is required.`;
      return;
    }
    if (integerOnly && !Number.isInteger(value)) {
      errors[key] = `${label} must be a whole number.`;
      return;
    }
    if (value < min || value > max) {
      errors[key] = `${label} must be between ${min} and ${max}.`;
    }
  };

  numberInRange("nirf_rank", input.nirf_rank, 1, 300, "NIRF rank", true);
  numberInRange("nirf_score", input.nirf_score, 0, 100, "NIRF score");
  numberInRange("institute_tier", input.institute_tier, 1, 3, "Institute tier", true);
  numberInRange("normalized_cgpa_10", input.normalized_cgpa_10, 0, 10, "CGPA");
  numberInRange("backlogs", input.backlogs, 0, 30, "Backlogs", true);
  numberInRange("internships", input.internships, 0, 10, "Internships", true);
  numberInRange("certifications", input.certifications, 0, 20, "Certifications", true);
  numberInRange("job_portal_activity", input.job_portal_activity, 0, 1, "Job portal activity");
  numberInRange("interview_count", input.interview_count, 0, 50, "Interview count", true);
  numberInRange("placement_cell_index", input.placement_cell_index, 0, 1, "Placement cell activity");
  numberInRange("sector_demand_index", input.sector_demand_index, 0, 1, "Sector demand");
  numberInRange(
    "historical_course_placement_rate",
    input.historical_course_placement_rate,
    0,
    1,
    "Historical placement rate",
  );
  numberInRange("loan_amount_lakh", input.loan_amount_lakh, 0.1, 100, "Loan amount");
  numberInRange("moratorium_days_left", input.moratorium_days_left, 0, 730, "Moratorium days left", true);

  return errors;
}

function FieldWrapper({ children, error }: { children: React.ReactNode; error?: string }) {
  return (
    <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      {children}
      {error ? <p className="text-xs font-medium text-rose-700">{error}</p> : null}
    </div>
  );
}

function numberValue(value: string) {
  if (value.trim() === "") {
    return Number.NaN;
  }
  return Number(value);
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function ScoreDial({ score }: { score: number }) {
  return (
    <div className="relative mx-auto grid h-40 w-40 place-items-center rounded-full border border-slate-200 bg-white shadow-[inset_0_0_0_14px_rgba(15,23,42,0.03)]">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#0284c7 ${score}%, rgba(148,163,184,0.12) 0)`,
          maskImage: "radial-gradient(circle, transparent 62%, #000 63%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 62%, #000 63%)",
        }}
      />
      <div className="relative grid h-40 w-40 place-items-center rounded-full border border-slate-200 bg-slate-50 text-center">
        <div>
          <div className="text-5xl font-semibold tracking-tight text-slate-900">{score}</div>
          <div className="mt-1 text-[0.68rem] uppercase tracking-[0.32em] text-slate-500">Placement Confidence</div>
        </div>
      </div>
    </div>
  );
}

function toApiPreview(request: ScoreRequest, response: ScoreResponse) {
  return {
    endpoint: "POST /score",
    request,
    response,
  };
}

function isErrorDetail(value: unknown): value is { detail?: string } {
  return typeof value === "object" && value !== null && "detail" in value;
}

export function ScoreCheckView() {
  const [formState, setFormState] = useState<ScoreInput>(initialFormState);
  const [result, setResult] = useState<ScoreResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errors, setErrors] = useState<ScoreErrors>({});
  const [lastPayload, setLastPayload] = useState<ScoreRequest | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isLoading = status === "loading";

  const emptyResponse = useMemo<ScoreResponse>(
    () => ({
      borrower_id: "",
      placement_risk_score: 0,
      risk_flag: "Low",
      placement_probability: {
        three_month: 0,
        six_month: 0,
        twelve_month: 0,
      },
      expected_salary_lpa: 0,
      expected_salary_band: "-",
      top_drivers: [],
      recommended_action: "Run a score check to see recommendations.",
      model_family: "Stage 1 XGBoost + Stage 2 LightGBM + SHAP",
    }),
    [],
  );
  const active = status === "ready" && result ? result : emptyResponse;

  function generateBorrowerId() {
    const stamp = Date.now().toString().slice(-6);
    return `B-UI-${stamp}`;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateScoreRequest(formState);
    setErrors(validation);

    if (Object.keys(validation).length > 0) {
      setStatus("idle");
      return;
    }

    const payload: ScoreRequest = {
      borrower_id: generateBorrowerId(),
      ...formState,
    };
    setLastPayload(payload);
    setErrorMessage(null);
    setStatus("loading");

    try {
      const response = await fetch("/api/score", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseBody = (await response.json().catch(() => null)) as ScoreResponse | { detail?: string } | null;

      if (!response.ok) {
        const detail = isErrorDetail(responseBody) ? responseBody.detail : null;
        throw new Error(detail || `Score request failed with ${response.status}`);
      }

      setResult(responseBody as ScoreResponse);
      setStatus("ready");
    } catch (error) {
      setResult(null);
      setErrorMessage(error instanceof Error ? error.message : "Score request failed.");
      setStatus("error");
    }
  }

  function update<K extends keyof ScoreInput>(key: K, value: ScoreInput[K]) {
    setFormState((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) {
        return current;
      }
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function resetForm() {
    setFormState(initialFormState);
    setResult(null);
    setStatus("idle");
    setErrors({});
    setLastPayload(null);
    setErrorMessage(null);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_minmax(380px,0.9fr)]">
      <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">POST /score simulation</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Borrower Score Lab</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Tune the payload you will expose in <span className="font-medium text-slate-900">api.py</span> and submit it to the same endpoint your FastAPI service will use.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Reset sample
            </button>
            <span className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Live preview updates as you type
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
          <FieldWrapper error={errors.nirf_rank}>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">NIRF rank</span>
            <input
              type="number"
              min={1}
              max={300}
              value={Number.isFinite(formState.nirf_rank) ? formState.nirf_rank : ""}
              onChange={(event) => update("nirf_rank", numberValue(event.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
            />
          </FieldWrapper>

          <FieldWrapper error={errors.nirf_score}>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">NIRF score</span>
            <input
              type="number"
              step="0.1"
              min={0}
              max={100}
              value={Number.isFinite(formState.nirf_score) ? formState.nirf_score : ""}
              onChange={(event) => update("nirf_score", numberValue(event.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
            />
          </FieldWrapper>

          <FieldWrapper error={errors.institute_tier}>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Institute tier</span>
            <select
              value={formState.institute_tier}
              onChange={(event) => update("institute_tier", Number(event.target.value) as 1 | 2 | 3)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
            >
              <option value={1}>Tier 1</option>
              <option value={2}>Tier 2</option>
              <option value={3}>Tier 3</option>
            </select>
          </FieldWrapper>

          <FieldWrapper>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Course</span>
            <select
              value={formState.course}
              onChange={(event) => update("course", event.target.value as ScoreRequest["course"])}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
            >
              {courseOptions.map((course) => (
                <option key={course.value} value={course.value}>
                  {course.label}
                </option>
              ))}
            </select>
          </FieldWrapper>

          <FieldWrapper error={errors.normalized_cgpa_10}>
            <span className="flex items-center justify-between text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">
              <span>CGPA</span>
              <span className="text-slate-900">{Number.isFinite(formState.normalized_cgpa_10) ? formState.normalized_cgpa_10.toFixed(1) : "-"}</span>
            </span>
            <input
              type="range"
              min={5}
              max={10}
              step={0.1}
              value={Number.isFinite(formState.normalized_cgpa_10) ? formState.normalized_cgpa_10 : 7}
              onChange={(event) => update("normalized_cgpa_10", Number(event.target.value))}
              className="accent-cyan-400"
            />
          </FieldWrapper>

          <FieldWrapper error={errors.backlogs}>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Backlogs</span>
            <input
              type="number"
              min={0}
              max={30}
              value={Number.isFinite(formState.backlogs) ? formState.backlogs : ""}
              onChange={(event) => update("backlogs", numberValue(event.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
            />
          </FieldWrapper>

          <FieldWrapper error={errors.internships}>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Internships</span>
            <input
              type="number"
              min={0}
              max={10}
              value={Number.isFinite(formState.internships) ? formState.internships : ""}
              onChange={(event) => update("internships", numberValue(event.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
            />
          </FieldWrapper>

          <FieldWrapper error={errors.certifications}>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Certifications</span>
            <input
              type="number"
              min={0}
              max={20}
              value={Number.isFinite(formState.certifications) ? formState.certifications : ""}
              onChange={(event) => update("certifications", numberValue(event.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
            />
          </FieldWrapper>

          <FieldWrapper error={errors.job_portal_activity}>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Job portal activity</span>
            <input
              type="number"
              step="0.01"
              min={0}
              max={1}
              value={Number.isFinite(formState.job_portal_activity) ? formState.job_portal_activity : ""}
              onChange={(event) => update("job_portal_activity", numberValue(event.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
            />
          </FieldWrapper>

          <FieldWrapper error={errors.interview_count}>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Interview count</span>
            <input
              type="number"
              min={0}
              max={50}
              value={Number.isFinite(formState.interview_count) ? formState.interview_count : ""}
              onChange={(event) => update("interview_count", numberValue(event.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
            />
          </FieldWrapper>

          <FieldWrapper error={errors.placement_cell_index}>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Placement cell activity</span>
            <input
              type="number"
              step="0.01"
              min={0}
              max={1}
              value={Number.isFinite(formState.placement_cell_index) ? formState.placement_cell_index : ""}
              onChange={(event) => update("placement_cell_index", numberValue(event.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
            />
          </FieldWrapper>

          <FieldWrapper error={errors.sector_demand_index}>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Sector demand</span>
            <input
              type="number"
              step="0.01"
              min={0}
              max={1}
              value={Number.isFinite(formState.sector_demand_index) ? formState.sector_demand_index : ""}
              onChange={(event) => update("sector_demand_index", numberValue(event.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
            />
          </FieldWrapper>

          <FieldWrapper error={errors.historical_course_placement_rate}>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Historical placement rate</span>
            <input
              type="number"
              step="0.01"
              min={0}
              max={1}
              value={Number.isFinite(formState.historical_course_placement_rate) ? formState.historical_course_placement_rate : ""}
              onChange={(event) => update("historical_course_placement_rate", numberValue(event.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
            />
          </FieldWrapper>

          <FieldWrapper error={errors.loan_amount_lakh}>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Loan amount (lakh)</span>
            <input
              type="number"
              step="0.1"
              min={0}
              max={100}
              value={Number.isFinite(formState.loan_amount_lakh) ? formState.loan_amount_lakh : ""}
              onChange={(event) => update("loan_amount_lakh", numberValue(event.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
            />
          </FieldWrapper>

          <FieldWrapper error={errors.moratorium_days_left}>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Moratorium days left</span>
            <input
              type="number"
              min={0}
              max={730}
              value={Number.isFinite(formState.moratorium_days_left) ? formState.moratorium_days_left : ""}
              onChange={(event) => update("moratorium_days_left", numberValue(event.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
            />
          </FieldWrapper>

          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-sm text-slate-600">
              Borrower ID is auto-generated from the score check request.
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-2xl bg-linear-to-r from-slate-900 to-slate-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:scale-[1.01] disabled:cursor-wait disabled:opacity-80 disabled:hover:scale-100"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                  Running score check
                </span>
              ) : (
                "Run score check"
              )}
            </button>
          </div>
        </form>
      </article>

      <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Live model output</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Placement Confidence Score</h3>
            <p className="mt-2 text-sm text-slate-600">
              {status === "ready"
                ? "Backend response returned from your API route."
                : status === "loading"
                  ? "Sending request to the scoring API..."
                  : status === "error"
                    ? "Scoring failed. Verify the API is running and try again."
                    : "Adjust the form and submit to run the live scoring flow."}
            </p>
            {status === "error" && errorMessage ? (
              <p className="mt-2 text-xs font-medium text-rose-700">{errorMessage}</p>
            ) : null}
          </div>
          <span
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              status === "ready"
                ? active.risk_flag === "High"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : active.risk_flag === "Medium"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-50 text-slate-500"
            }`}
          >
            {status === "loading" ? "Loading" : status === "ready" ? active.risk_flag : "0"}
          </span>
        </div>

        <div className="mt-6">
          <ScoreDial score={active.placement_risk_score} />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <ResultMetric label="3-month placement" value={`${active.placement_probability.three_month}%`} />
          <ResultMetric label="6-month placement" value={`${active.placement_probability.six_month}%`} />
          <ResultMetric label="12-month placement" value={`${active.placement_probability.twelve_month}%`} />
          <ResultMetric label="Salary band" value={active.expected_salary_band} />
        </div>

        <div className="mt-6 rounded-[1.45rem] border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Top SHAP-style drivers</h4>
            <span className="text-xs uppercase tracking-[0.26em] text-slate-400">Impact on PRS</span>
          </div>
          {status === "ready" && active.top_drivers.length > 0 ? (
            <div className="mt-4 grid gap-3">
              {active.top_drivers.map((driver) => {
                const positive = driver.impact >= 0;
                const width = Math.min(100, Math.max(18, Math.abs(driver.impact) * 8));
                return (
                  <div key={driver.feature} className="grid grid-cols-[150px_minmax(0,1fr)_56px] items-center gap-3 text-sm max-sm:grid-cols-1">
                    <div className="font-medium text-slate-900">{driver.feature}</div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full rounded-full ${positive ? "bg-emerald-400" : "bg-rose-400"}`} style={{ width: `${width}%` }} />
                    </div>
                    <div className={`text-right font-semibold ${positive ? "text-emerald-700" : "text-rose-700"}`}>
                      {positive ? "+" : ""}{driver.impact.toFixed(1)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Run a score check to view driver contributions.</p>
          )}
        </div>

        <div className="mt-6 rounded-[1.45rem] border border-slate-200 bg-white p-4">
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Recommended action</div>
          <div className="mt-2 text-base font-medium text-slate-900">{active.recommended_action}</div>
          <div className="mt-2 text-sm text-slate-600">Model family: {active.model_family}</div>
        </div>

        <div className="mt-6 rounded-[1.45rem] border border-slate-200 bg-slate-50 p-4">
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">API preview</div>
          <pre className="mt-3 overflow-auto text-xs leading-6 text-slate-700">
            {JSON.stringify(lastPayload ? toApiPreview(lastPayload, active) : { message: "No request sent yet." }, null, 2)}
          </pre>
        </div>
      </article>
    </div>
  );
}
