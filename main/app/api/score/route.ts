import { NextResponse } from "next/server";
import { postScore } from "@/lib/placementiq-api";
import type { ScoreRequest } from "@/lib/placementiq";

export async function POST(request: Request) {
  let payload: ScoreRequest | null = null;
  try {
    payload = (await request.json()) as ScoreRequest;
    const data = await postScore(payload);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Score API route error", { error, payload });
    return NextResponse.json(
      {
        error: "Unable to score borrower",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
