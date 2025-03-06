// app/api/upload/progress/route.ts
import { NextResponse } from "next/server";
import { ProgressTracker } from "@/utils/progressTracker";
import { verifyAuth } from "@/utils/verifyAuth";

export async function GET(request: Request) {
  try {
    // Verify authentication
    const auth = await verifyAuth();
    if (!auth.authenticated) return auth.response;

    // Get operation ID from query params
    const { searchParams } = new URL(request.url);
    const operationId = searchParams.get('id');

    if (!operationId) {
      return NextResponse.json({ error: 'Missing operation ID' }, { status: 400 });
    }

    // Get progress data
    const progressData = ProgressTracker.get(operationId);

    if (!progressData) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    return NextResponse.json(progressData);
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
