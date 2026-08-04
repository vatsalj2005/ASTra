import { NextResponse } from "next/server";
import { ingestRepository } from "@/lib/ingestion";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid GitHub repository URL." },
        { status: 400 }
      );
    }

    console.log(`[API /api/ingest] Request received for URL: ${url}`);
    const result = await ingestRepository(url.trim());

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[API /api/ingest Error]:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage || "Failed to ingest repository.",
      },
      { status: 500 }
    );
  }
}
