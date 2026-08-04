import { NextResponse } from "next/server";
import { generateAnswer } from "@/lib/generation";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { repoId, question } = body;

    if (!repoId || typeof repoId !== "string") {
      return NextResponse.json(
        { success: false, error: "Repository ID is required. Please ingest a repository first." },
        { status: 400 }
      );
    }

    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { success: false, error: "Please enter a non-empty question." },
        { status: 400 }
      );
    }

    console.log(`[API /api/chat] Question for ${repoId}: "${question}"`);
    const answer = await generateAnswer(question.trim(), repoId);

    return NextResponse.json({
      success: true,
      answer,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[API /api/chat Error]:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage || "An error occurred while generating the answer.",
      },
      { status: 500 }
    );
  }
}
