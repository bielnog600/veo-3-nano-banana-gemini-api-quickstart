import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set in environment variables.");
}

const client = new GoogleGenAI({ apiKey });

export const runtime = "nodejs"; // ou "edge", se o projeto original usar edge

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt: string | undefined = body?.prompt;
    const duration: number | undefined = body?.duration;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'prompt' in request body." },
        { status: 400 }
      );
    }

    // Chamada ao Veo / geração de vídeo
    const operation = await client.models.generateVideos({
      model: "veo-2.0-generate-001", // ou o modelo que estás a usar
      prompt,
      config: {
        aspectRatio: "9:16",
        // ❌ REMOVIDO: quality
        // ❌ REMOVIDO: detail
        // Estes abaixo são aceites no teu tipo GenerateVideosConfig
        motion: "cinematic",
        frameRate: 30,
        ...(duration ? { duration } : {}),
      },
    });

    if (!operation.name) {
      return NextResponse.json(
        { error: "Video generation operation did not return a name." },
        { status: 500 }
      );
    }

    // Polling simples até terminar a operação
    let doneOp = operation;

    // Limite básico para não ficar em loop infinito
    for (let i = 0; i < 60 && !doneOp.done; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      doneOp = await client.operations.getVideosOperation({
        operation: operation.name,
      });
    }

    if (!doneOp.done) {
      return NextResponse.json(
        { error: "Video generation did not complete in time." },
        { status: 504 }
      );
    }

    if (doneOp.error) {
      return NextResponse.json(
        { error: doneOp.error.message ?? "Unknown error from Veo" },
        { status: 500 }
      );
    }

    const videoUri =
      doneOp.response?.generatedVideos?.[0]?.video?.uri ?? null;

    if (!videoUri) {
      return NextResponse.json(
        { error: "Generated video URI not found in response." },
        { status: 500 }
      );
    }

    // Devolve só o URI do vídeo (podes adaptar para devolver mais coisas)
    return NextResponse.json({ uri: videoUri });
  } catch (err: any) {
    console.error("Error in /api/veo/generate:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal server error." },
      { status: 500 }
    );
  }
}
