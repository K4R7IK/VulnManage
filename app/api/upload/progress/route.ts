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
    const operationId = searchParams.get("id");

    if (!operationId) {
      return NextResponse.json(
        { error: "Missing operation ID" },
        { status: 400 },
      );
    }

    // Get progress data with detailed logging
    console.log(`Fetching progress for operation: ${operationId}`);
    const progressData = ProgressTracker.get(operationId);

    if (!progressData) {
      console.log(
        `No progress data found for ${operationId}, returning default pending state`,
      );
      // Return a default "pending" status instead of 404 error
      // This makes the progress tracking more resilient
      return NextResponse.json({
        status: "pending",
        progress: 0,
        message: "Waiting for processing to start...",
        startTime: Date.now(),
        lastUpdateTime: Date.now(),
      });
    }

    console.log(
      `Returning progress for ${operationId}: ${progressData.status} - ${progressData.progress}%`,
    );
    return NextResponse.json(progressData);
  } catch (error) {
    console.error("Error fetching progress:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
