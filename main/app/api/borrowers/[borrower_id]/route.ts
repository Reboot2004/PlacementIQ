import { NextResponse } from "next/server";
import { getBorrower, updateBorrower } from "@/lib/placementiq-api";
import type { BorrowerUpdateRequest } from "@/lib/placementiq";

type RouteParams = {
  params: Promise<{
    borrower_id: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { borrower_id } = await params;
  try {
    const data = await getBorrower(borrower_id);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Borrower detail API route error", { error, borrower_id });
    return NextResponse.json(
      {
        error: "Unable to load borrower details",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { borrower_id } = await params;
  let payload: BorrowerUpdateRequest | null = null;
  try {
    payload = (await request.json()) as BorrowerUpdateRequest;
    const data = await updateBorrower(borrower_id, payload);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Borrower update API route error", { error, borrower_id, payload });
    return NextResponse.json(
      {
        error: "Unable to update borrower",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
