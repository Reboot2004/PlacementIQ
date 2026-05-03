"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  BorrowerDetail,
  BorrowerUpdateRequest,
  DashboardBorrower,
  DashboardPayload,
  RiskFlag,
} from "@/lib/placementiq";

const riskStyles: Record<RiskFlag, string> = {
  High: "border-rose-200 bg-rose-50 text-rose-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-800",
  Low: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const riskDot: Record<RiskFlag, string> = {
  High: "bg-rose-500",
  Medium: "bg-amber-500",
  Low: "bg-emerald-500",
};

const courseOptions = [
  { value: "btech_cse", label: "B.Tech CSE" },
  { value: "core_engineering", label: "Core Engineering" },
  { value: "mba", label: "MBA" },
  { value: "commerce_arts", label: "Arts / Commerce" },
] as const;

const tierOptions = [
  { value: 1, label: "Tier 1" },
  { value: 2, label: "Tier 2" },
  { value: 3, label: "Tier 3" },
] as const;

type DashboardViewProps = {
  data: DashboardPayload;
};

function formatDrivers(drivers: DashboardBorrower["top_drivers"]) {
  return drivers
    .map((driver) => ({
      ...driver,
      width: Math.min(100, Math.max(18, Math.abs(driver.impact) * 8)),
    }))
    .sort((left, right) => Math.abs(right.impact) - Math.abs(left.impact));
}

function MetricCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <article className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{detail}</div>
    </article>
  );
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

function ScoreDial({ score }: { score: number }) {
  return (
    <div className="relative grid h-36 w-36 place-items-center rounded-full border border-slate-200 bg-white shadow-[inset_0_0_0_12px_rgba(15,23,42,0.03)]">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#0ea5e9 ${score}%, rgba(148,163,184,0.12) 0)`,
          maskImage: "radial-gradient(circle, transparent 62%, #000 63%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 62%, #000 63%)",
        }}
      />
      <div className="relative grid h-[9rem] w-[9rem] place-items-center rounded-full border border-slate-200 bg-slate-50 text-center">
        <div>
          <div className="text-4xl font-semibold tracking-tight text-slate-900">{score}</div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Placement Confidence</div>
        </div>
      </div>
    </div>
  );
}

export function DashboardView({ data }: DashboardViewProps) {
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFlag | "all">("all");
  const [descending, setDescending] = useState(true);
  const [borrowersState, setBorrowersState] = useState<DashboardBorrower[]>(data.borrowers);
  const [selectedId, setSelectedId] = useState(data.borrowers[0]?.borrower_id ?? "");
  const [editBorrowerId, setEditBorrowerId] = useState<string | null>(null);
  const [editState, setEditState] = useState<BorrowerUpdateRequest | null>(null);
  const [editStatus, setEditStatus] = useState<"idle" | "loading" | "saving" | "error">("idle");
  const [editError, setEditError] = useState<string | null>(null);
  const riskRank: Record<RiskFlag, number> = {
    Low: 0,
    Medium: 1,
    High: 2,
  };

  const borrowers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...borrowersState]
      .filter((borrower) => {
        const matchesRisk = riskFilter === "all" || borrower.risk_flag === riskFilter;
        const matchesQuery = !normalized
          || `${borrower.borrower_name} ${borrower.city} ${borrower.course} ${borrower.institute}`.toLowerCase().includes(normalized);
        return matchesRisk && matchesQuery;
      })
      .sort((left, right) => {
        const rankDiff = riskRank[left.risk_flag] - riskRank[right.risk_flag];
        if (rankDiff !== 0) {
          return descending ? -rankDiff : rankDiff;
        }
        return descending
          ? right.placement_risk_score - left.placement_risk_score
          : left.placement_risk_score - right.placement_risk_score;
      });
  }, [borrowersState, descending, query, riskFilter]);

  useEffect(() => {
    if (!borrowers.some((borrower) => borrower.borrower_id === selectedId)) {
      setSelectedId(borrowers[0]?.borrower_id ?? borrowersState[0]?.borrower_id ?? "");
    }
  }, [borrowers, borrowersState, selectedId]);

  useEffect(() => {
    if (editBorrowerId && editBorrowerId !== selectedId) {
      setEditBorrowerId(null);
      setEditState(null);
      setEditStatus("idle");
      setEditError(null);
    }
  }, [editBorrowerId, selectedId]);

  const selected = borrowers.find((borrower) => borrower.borrower_id === selectedId) ?? borrowers[0] ?? data.borrowers[0];
  const drivers = selected ? formatDrivers(selected.top_drivers) : [];
  const isEditing = selected ? editBorrowerId === selected.borrower_id : false;

  async function startEdit(borrowerId: string) {
    setEditBorrowerId(borrowerId);
    setEditStatus("loading");
    setEditError(null);

    try {
      const response = await fetch(`/api/borrowers/${borrowerId}`);
      const responseBody = (await response.json().catch(() => null)) as BorrowerDetail | { detail?: string } | null;

      if (!response.ok) {
        const detail = isErrorDetail(responseBody) ? responseBody.detail : null;
        throw new Error(detail || `Unable to load borrower ${response.status}`);
      }

      const detail = responseBody as BorrowerDetail;
      const { borrower_id: _id, ...rest } = detail;
      setEditState(rest);
      setEditStatus("idle");
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Unable to load borrower.");
      setEditStatus("error");
    }
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editState || !editBorrowerId) {
      return;
    }

    setEditStatus("saving");
    setEditError(null);

    try {
      const response = await fetch(`/api/borrowers/${editBorrowerId}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(editState),
      });

      const responseBody = (await response.json().catch(() => null)) as DashboardBorrower | { detail?: string } | null;

      if (!response.ok) {
        const detail = isErrorDetail(responseBody) ? responseBody.detail : null;
        throw new Error(detail || `Unable to update borrower ${response.status}`);
      }

      const updated = responseBody as DashboardBorrower;
      setBorrowersState((current) => current.map((borrower) => (borrower.borrower_id === updated.borrower_id ? updated : borrower)));
      setEditBorrowerId(null);
      setEditState(null);
      setEditStatus("idle");
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Unable to update borrower.");
      setEditStatus("error");
    }
  }

  function cancelEdit() {
    setEditBorrowerId(null);
    setEditState(null);
    setEditStatus("idle");
    setEditError(null);
  }

  function updateEdit<K extends keyof BorrowerUpdateRequest>(key: K, value: BorrowerUpdateRequest[K]) {
    setEditState((current) => (current ? { ...current, [key]: value } : current));
  }

  return (
    <div className="grid gap-6 xl:gap-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total active loans"
          value={data.summary.total_active_loans.toLocaleString("en-IN")}
          detail="Education-loan accounts currently under monitoring."
        />
        <MetricCard
          label="High risk"
          value={data.summary.high_risk_count.toLocaleString("en-IN")}
          detail={data.summary.monitoring_window}
        />
        <MetricCard
          label="Average PRS"
          value={data.summary.average_prs}
          detail="Portfolio-wide placement confidence."
        />
        <MetricCard
          label="Expected exposure"
          value={data.summary.expected_exposure}
          detail="Borrowers that need direct intervention."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_minmax(360px,0.8fr)]">
        <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">
                Portfolio monitoring queue
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Borrower records from API</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Search, filter, and sort live borrower records that will be populated from your FastAPI routes.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Search</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Borrower, institute, city"
                  className="mt-2 w-full min-w-[230px] border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </label>
              <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Risk</span>
                <select
                  value={riskFilter}
                  onChange={(event) => setRiskFilter(event.target.value as RiskFlag | "all")}
                  className="mt-2 min-w-[150px] border-0 bg-transparent text-sm text-slate-900 outline-none"
                >
                  <option value="all">All</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => setDescending((current) => !current)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                {descending ? "Sort: High to Low Risk" : "Sort: Low to High Risk"}
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full border-collapse text-left">
                <thead className="bg-slate-50 text-[0.68rem] uppercase tracking-[0.28em] text-slate-500">
                  <tr>
                    <th className="px-4 py-4 font-semibold">Borrower</th>
                    <th className="px-4 py-4 font-semibold">Course</th>
                    <th className="px-4 py-4 font-semibold">Institute</th>
                    <th className="px-4 py-4 font-semibold">Moratorium</th>
                    <th className="px-4 py-4 font-semibold">PRS</th>
                    <th className="px-4 py-4 font-semibold">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {borrowers.map((borrower) => {
                    const active = borrower.borrower_id === selected?.borrower_id;
                    return (
                      <tr
                        key={borrower.borrower_id}
                        tabIndex={0}
                        onClick={() => setSelectedId(borrower.borrower_id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedId(borrower.borrower_id);
                          }
                        }}
                        className={`cursor-pointer border-t border-slate-100 transition ${active ? "bg-amber-50" : "hover:bg-slate-50"}`}
                      >
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-900">{borrower.borrower_name}</div>
                          <div className="text-sm text-slate-500">{borrower.city}</div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{borrower.course}</td>
                        <td className="px-4 py-4 text-sm text-slate-600">{borrower.institute}</td>
                        <td className="px-4 py-4 text-sm text-slate-600">{borrower.moratorium_days_left} days</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="text-lg font-semibold text-slate-900">{borrower.placement_risk_score}</div>
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                                style={{ width: `${borrower.placement_risk_score}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${riskStyles[borrower.risk_flag]}`}>
                            <span className={`h-2.5 w-2.5 rounded-full ${riskDot[borrower.risk_flag]}`} />
                            {borrower.risk_flag}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {borrowers.length === 0 ? (
              <div className="border-t border-white/8 px-5 py-8 text-sm text-slate-300/75">No borrower records matched the current search and risk filters.</div>
            ) : null}
          </div>
        </article>

        <div className="grid gap-6">
          {selected ? (
            <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Individual borrower card</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{selected.borrower_name}</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {selected.course}, {selected.city} | {selected.institute}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => (isEditing ? cancelEdit() : startEdit(selected.borrower_id))}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    disabled={editStatus === "loading" || editStatus === "saving"}
                  >
                    {isEditing ? "Cancel edit" : editStatus === "loading" ? "Loading..." : "Edit details"}
                  </button>
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${riskStyles[selected.risk_flag]}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${riskDot[selected.risk_flag]}`} />
                    {selected.risk_flag}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
                <ScoreDial score={selected.placement_risk_score} />
                <div className="min-w-0 flex-1 rounded-[1.45rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500" />
                    </div>
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
                      <span>Low</span>
                      <span>Medium</span>
                      <span>High</span>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-700">{selected.recommended_action}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">3-month placement</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{selected.placement_probability.three_month}%</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">6-month placement</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{selected.placement_probability.six_month}%</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">12-month placement</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{selected.placement_probability.twelve_month}%</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Salary band</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{selected.expected_salary_band}</div>
                </div>
              </div>

              {isEditing ? (
                <div className="mt-5 rounded-[1.45rem] border border-slate-200 bg-white p-4">
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Update borrower details</div>
                  {editStatus === "loading" ? (
                    <p className="mt-3 text-sm text-slate-600">Loading borrower details...</p>
                  ) : editState ? (
                    <form onSubmit={saveEdit} className="mt-4 grid gap-4 md:grid-cols-2">
                      <FieldWrapper>
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Name</span>
                        <input
                          type="text"
                          value={editState.borrower_name}
                          onChange={(event) => updateEdit("borrower_name", event.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
                        />
                      </FieldWrapper>

                      <FieldWrapper>
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">City</span>
                        <input
                          type="text"
                          value={editState.city}
                          onChange={(event) => updateEdit("city", event.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
                        />
                      </FieldWrapper>

                      <FieldWrapper>
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Institute</span>
                        <input
                          type="text"
                          value={editState.institute}
                          onChange={(event) => updateEdit("institute", event.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
                        />
                      </FieldWrapper>

                      <FieldWrapper>
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Course</span>
                        <select
                          value={editState.course}
                          onChange={(event) => updateEdit("course", event.target.value as BorrowerUpdateRequest["course"])}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
                        >
                          {courseOptions.map((course) => (
                            <option key={course.value} value={course.value}>
                              {course.label}
                            </option>
                          ))}
                        </select>
                      </FieldWrapper>

                      <FieldWrapper>
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Institute tier</span>
                        <select
                          value={editState.institute_tier}
                          onChange={(event) => updateEdit("institute_tier", Number(event.target.value) as BorrowerUpdateRequest["institute_tier"])}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
                        >
                          {tierOptions.map((tier) => (
                            <option key={tier.value} value={tier.value}>
                              {tier.label}
                            </option>
                          ))}
                        </select>
                      </FieldWrapper>

                      <FieldWrapper>
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">NIRF rank</span>
                        <input
                          type="number"
                          min={1}
                          max={300}
                          value={Number.isFinite(editState.nirf_rank) ? editState.nirf_rank : ""}
                          onChange={(event) => updateEdit("nirf_rank", numberValue(event.target.value))}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
                        />
                      </FieldWrapper>

                      <FieldWrapper>
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">NIRF score</span>
                        <input
                          type="number"
                          step="0.1"
                          min={0}
                          max={100}
                          value={Number.isFinite(editState.nirf_score) ? editState.nirf_score : ""}
                          onChange={(event) => updateEdit("nirf_score", numberValue(event.target.value))}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
                        />
                      </FieldWrapper>

                      <FieldWrapper>
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">CGPA (10-point)</span>
                        <input
                          type="number"
                          step="0.1"
                          min={0}
                          max={10}
                          value={Number.isFinite(editState.normalized_cgpa_10) ? editState.normalized_cgpa_10 : ""}
                          onChange={(event) => updateEdit("normalized_cgpa_10", numberValue(event.target.value))}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
                        />
                      </FieldWrapper>

                      <FieldWrapper>
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Backlogs</span>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={Number.isFinite(editState.backlogs) ? editState.backlogs : ""}
                          onChange={(event) => updateEdit("backlogs", numberValue(event.target.value))}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
                        />
                      </FieldWrapper>

                      <FieldWrapper>
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Internships</span>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={Number.isFinite(editState.internships) ? editState.internships : ""}
                          onChange={(event) => updateEdit("internships", numberValue(event.target.value))}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
                        />
                      </FieldWrapper>

                      <FieldWrapper>
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Certifications</span>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={Number.isFinite(editState.certifications) ? editState.certifications : ""}
                          onChange={(event) => updateEdit("certifications", numberValue(event.target.value))}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
                        />
                      </FieldWrapper>

                      <FieldWrapper>
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Job portal activity</span>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          max={1}
                          value={Number.isFinite(editState.job_portal_activity) ? editState.job_portal_activity : ""}
                          onChange={(event) => updateEdit("job_portal_activity", numberValue(event.target.value))}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
                        />
                      </FieldWrapper>

                      <FieldWrapper>
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Interview count</span>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={Number.isFinite(editState.interview_count) ? editState.interview_count : ""}
                          onChange={(event) => updateEdit("interview_count", numberValue(event.target.value))}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
                        />
                      </FieldWrapper>

                      <FieldWrapper>
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Placement cell activity</span>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          max={1}
                          value={Number.isFinite(editState.placement_cell_index) ? editState.placement_cell_index : ""}
                          onChange={(event) => updateEdit("placement_cell_index", numberValue(event.target.value))}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
                        />
                      </FieldWrapper>

                      <FieldWrapper>
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Sector demand index</span>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          max={1}
                          value={Number.isFinite(editState.sector_demand_index) ? editState.sector_demand_index : ""}
                          onChange={(event) => updateEdit("sector_demand_index", numberValue(event.target.value))}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
                        />
                      </FieldWrapper>

                      <FieldWrapper>
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Historical placement rate</span>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          max={1}
                          value={Number.isFinite(editState.historical_course_placement_rate) ? editState.historical_course_placement_rate : ""}
                          onChange={(event) => updateEdit("historical_course_placement_rate", numberValue(event.target.value))}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
                        />
                      </FieldWrapper>

                      <FieldWrapper>
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Loan amount (lakh)</span>
                        <input
                          type="number"
                          step="0.1"
                          min={0}
                          max={100}
                          value={Number.isFinite(editState.loan_amount_lakh) ? editState.loan_amount_lakh : ""}
                          onChange={(event) => updateEdit("loan_amount_lakh", numberValue(event.target.value))}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
                        />
                      </FieldWrapper>

                      <FieldWrapper>
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-slate-500">Moratorium days</span>
                        <input
                          type="number"
                          min={0}
                          max={730}
                          value={Number.isFinite(editState.moratorium_days_left) ? editState.moratorium_days_left : ""}
                          onChange={(event) => updateEdit("moratorium_days_left", numberValue(event.target.value))}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-900 outline-none transition focus:border-sky-400"
                        />
                      </FieldWrapper>

                      <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm text-slate-600">
                          Updates are saved back to placementiq_training.csv.
                          {editError ? <span className="ml-2 text-rose-700">{editError}</span> : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={editStatus === "saving"}
                            className="rounded-2xl bg-linear-to-r from-slate-900 to-slate-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:scale-[1.01] disabled:cursor-wait disabled:opacity-80 disabled:hover:scale-100"
                          >
                            {editStatus === "saving" ? "Saving..." : "Save updates"}
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <p className="mt-3 text-sm text-slate-600">Select a borrower to edit their details.</p>
                  )}
                </div>
              ) : null}

              <div className="mt-5 rounded-[1.45rem] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Top SHAP-style drivers</h4>
                  <span className="text-xs uppercase tracking-[0.26em] text-slate-400">Impact on PRS</span>
                </div>
                <div className="mt-4 grid gap-3">
                  {drivers.map((driver) => {
                    const positive = driver.impact >= 0;
                    return (
                      <div key={driver.feature} className="grid grid-cols-[150px_minmax(0,1fr)_56px] items-center gap-3 text-sm max-sm:grid-cols-1">
                        <div className="font-medium text-slate-900">{driver.feature}</div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${positive ? "bg-emerald-400" : "bg-rose-400"}`}
                            style={{ width: `${driver.width}%` }}
                          />
                        </div>
                        <div className={`text-right font-semibold ${positive ? "text-emerald-700" : "text-rose-700"}`}>
                          {positive ? "+" : ""}{driver.impact.toFixed(1)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>
          ) : null}
        </div>
      </section>
    </div>
  );
}
