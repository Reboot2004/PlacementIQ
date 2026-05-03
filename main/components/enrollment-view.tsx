"use client";

import { useMemo, useState } from "react";
import {
  demoEnrollmentRequest,
  type EnrollmentRequest,
  type EnrollmentResponse,
} from "@/lib/placementiq";

type EnrollmentInput = EnrollmentRequest;

type EnrollmentErrors = Partial<Record<keyof EnrollmentInput, string>>;

const initialFormState: EnrollmentInput = demoEnrollmentRequest;

const courseOptions = [
  { value: "btech_cse", label: "B.Tech CSE" },
  { value: "core_engineering", label: "Core Engineering" },
  { value: "mba", label: "MBA" },
  { value: "commerce_arts", label: "Arts / Commerce" },
] as const;

function validateEnrollment(input: EnrollmentInput): EnrollmentErrors {
  const errors: EnrollmentErrors = {};

  const requiredText = (key: keyof EnrollmentInput, value: string, label: string) => {
    if (!value.trim()) {
      errors[key] = `${label} is required.`;
    }
  };

  const numberInRange = (
    key: keyof EnrollmentInput,
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

  requiredText("name", input.name, "Name");
  requiredText("city", input.city, "City");
  requiredText("institute", input.institute, "Institute");

  numberInRange("gpa", input.gpa, 0, 10, "GPA");
  numberInRange("backlogs", input.backlogs, 0, 30, "Backlogs", true);
  numberInRange("internships", input.internships, 0, 10, "Internships", true);
  numberInRange("interview_count", input.interview_count, 0, 50, "Interview count", true);
  numberInRange("certifications", input.certifications, 0, 20, "Certifications", true);
  numberInRange("loan_amount_lakh", input.loan_amount_lakh, 0.1, 100, "Loan amount");
  numberInRange("moratorium_days_left", input.moratorium_days_left, 0, 730, "Moratorium days", true);
  numberInRange("institute_tier", input.institute_tier, 1, 3, "Institute tier", true);
  numberInRange("nirf_rank", input.nirf_rank, 1, 300, "NIRF rank", true);
  numberInRange("nirf_score", input.nirf_score, 0, 100, "NIRF score");
  numberInRange("placement_cell_index", input.placement_cell_index, 0, 1, "Placement cell activity");
  numberInRange(
    "historical_course_placement_rate",
    input.historical_course_placement_rate,
    0,
    1,
    "Historical placement rate",
  );

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

function isErrorDetail(value: unknown): value is { detail?: string } {
  return typeof value === "object" && value !== null && "detail" in value;
}

export function EnrollmentView() {
  const [formState, setFormState] = useState<EnrollmentInput>(initialFormState);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errors, setErrors] = useState<EnrollmentErrors>({});
  const [result, setResult] = useState<EnrollmentResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isLoading = status === "loading";

  const emptyResponse = useMemo<EnrollmentResponse>(
    () => ({
      borrower_id: "",
      placement_risk_score: 0,
      message: "Submit the enrollment form to append a borrower record.",
    }),
    [],
  );

  const active = status === "success" && result ? result : emptyResponse;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateEnrollment(formState);
    setErrors(validation);

    if (Object.keys(validation).length > 0) {
      setStatus("idle");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/enroll", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(formState),
      });

      const responseBody = (await response.json().catch(() => null)) as EnrollmentResponse | { detail?: string } | null;

      if (!response.ok) {
        const detail = isErrorDetail(responseBody) ? responseBody.detail : null;
        throw new Error(detail || `Enrollment failed with ${response.status}`);
      }

      setResult(responseBody as EnrollmentResponse);
      setStatus("success");
    } catch (error) {
      setResult(null);
      setErrorMessage(error instanceof Error ? error.message : "Enrollment failed.");
      setStatus("error");
    }
  }

  function update<K extends keyof EnrollmentInput>(key: K, value: EnrollmentInput[K]) {
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
    setStatus("idle");
    setErrors({});
    setResult(null);
    setErrorMessage(null);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_minmax(380px,0.9fr)]">
      <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">New borrower enrollment</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Enrollment Intake</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Capture borrower and institute inputs. Submissions append directly to placementiq_training.csv.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Reset form
            </button>
            <span className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Enrollment writes to CSV
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
          <FieldWrapper error={errors.name}>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Name</span>
            <input
              type="text"
              value={formState.name}
              onChange={(event) => update("name", event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
            />
          </FieldWrapper>

          <FieldWrapper error={errors.city}>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">City</span>
            <input
              type="text"
              value={formState.city}
              onChange={(event) => update("city", event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
            />
          </FieldWrapper>

          <FieldWrapper error={errors.institute}>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Institute</span>
            <input
              type="text"
              value={formState.institute}
              onChange={(event) => update("institute", event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
            />
          </FieldWrapper>

          <FieldWrapper>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Course</span>
            <select
              value={formState.course}
              onChange={(event) => update("course", event.target.value as EnrollmentInput["course"])}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
            >
              {courseOptions.map((course) => (
                <option key={course.value} value={course.value}>
                  {course.label}
                </option>
              ))}
            </select>
          </FieldWrapper>

          <FieldWrapper error={errors.institute_tier}>
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Institute tier</span>
            <select
              value={formState.institute_tier}
              onChange={(event) => update("institute_tier", Number(event.target.value) as EnrollmentInput["institute_tier"])}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
            >
              <option value={1}>Tier 1</option>
              <option value={2}>Tier 2</option>
              <option value={3}>Tier 3</option>
            </select>
          </FieldWrapper>

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

          <FieldWrapper error={errors.gpa}>
            <span className="flex items-center justify-between text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">
              <span>GPA</span>
              <span className="text-slate-900">{Number.isFinite(formState.gpa) ? formState.gpa.toFixed(1) : "-"}</span>
            </span>
            <input
              type="range"
              min={5}
              max={10}
              step={0.1}
              value={Number.isFinite(formState.gpa) ? formState.gpa : 7}
              onChange={(event) => update("gpa", Number(event.target.value))}
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
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Moratorium days</span>
            <input
              type="number"
              min={0}
              max={730}
              value={Number.isFinite(formState.moratorium_days_left) ? formState.moratorium_days_left : ""}
              onChange={(event) => update("moratorium_days_left", numberValue(event.target.value))}
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

          <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-sm text-slate-600">Enrollment writes one new row to the training CSV.</div>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-2xl bg-linear-to-r from-slate-900 to-slate-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:scale-[1.01] disabled:cursor-wait disabled:opacity-80 disabled:hover:scale-100"
            >
              {isLoading ? "Submitting..." : "Enroll borrower"}
            </button>
          </div>
        </form>
      </article>

      <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Enrollment status</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Submission Result</h3>
            <p className="mt-2 text-sm text-slate-600">
              {status === "success"
                ? "Enrollment saved to the training dataset."
                : status === "loading"
                  ? "Submitting enrollment payload..."
                  : status === "error"
                    ? "Enrollment failed. Check the API and try again."
                    : "Submit the form to append a borrower record."}
            </p>
            {status === "error" && errorMessage ? (
              <p className="mt-2 text-xs font-medium text-rose-700">{errorMessage}</p>
            ) : null}
          </div>
          <span
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : status === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-slate-200 bg-slate-50 text-slate-500"
            }`}
          >
            {status === "loading" ? "Loading" : status === "success" ? "Saved" : "Idle"}
          </span>
        </div>

        <div className="mt-6 rounded-[1.45rem] border border-slate-200 bg-slate-50 p-4">
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Borrower ID</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">{active.borrower_id || "--"}</div>
          <div className="mt-2 text-sm text-slate-600">{active.message}</div>
        </div>

        <div className="mt-4 rounded-[1.45rem] border border-slate-200 bg-white p-4">
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Placement confidence score</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {status === "success" ? active.placement_risk_score : "--"}
          </div>
        </div>

        <div className="mt-6 rounded-[1.45rem] border border-slate-200 bg-white p-4">
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Payload preview</div>
          <pre className="mt-3 overflow-auto text-xs leading-6 text-slate-700">
            {JSON.stringify(formState, null, 2)}
          </pre>
        </div>
      </article>
    </div>
  );
}
