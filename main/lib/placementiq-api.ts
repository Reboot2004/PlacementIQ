import { buildScorePreview, demoDashboardPayload, type DashboardPayload, type ScoreRequest, type ScoreResponse } from "@/lib/placementiq";

const API_BASE_URL =
  process.env.PLACEMENTIQ_API_URL ??
  process.env.NEXT_PUBLIC_PLACEMENTIQ_API_URL ??
  "http://127.0.0.1:8000";

const DASHBOARD_PATH = process.env.PLACEMENTIQ_DASHBOARD_PATH ?? "/dashboard";
const SCORE_PATH = process.env.PLACEMENTIQ_SCORE_PATH ?? "/score";

async function fetchJson<T>(path: string, init: RequestInit, fallback: T): Promise<T> {
  try {
    const response = await fetch(new URL(path, API_BASE_URL), {
      ...init,
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export function getDashboardData(): Promise<DashboardPayload> {
  return fetchJson<DashboardPayload>(DASHBOARD_PATH, { method: "GET" }, demoDashboardPayload);
}

export function postScore(payload: ScoreRequest): Promise<ScoreResponse> {
  return fetchJson<ScoreResponse>(SCORE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  }, buildScorePreview(payload));
}
