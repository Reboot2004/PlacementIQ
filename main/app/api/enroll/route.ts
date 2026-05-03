import { NextResponse } from "next/server";
import { postEnrollment } from "@/lib/placementiq-api";
import type { EnrollmentRequest } from "@/lib/placementiq";

export async function POST(request: Request) {
  let payload: EnrollmentRequest | null = null;
  try {
    payload = (await request.json()) as EnrollmentRequest;
    const data = await postEnrollment(payload);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Enrollment API route error", { error, payload });
    return NextResponse.json(
      {
        error: "Unable to enroll borrower",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
