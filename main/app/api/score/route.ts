import { NextResponse } from "next/server";
import { postScore } from "@/lib/placementiq-api";
import type { ScoreRequest } from "@/lib/placementiq";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ScoreRequest;
    const data = await postScore(payload);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to score borrower",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
