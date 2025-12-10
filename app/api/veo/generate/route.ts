import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set.");
}

const client = new GoogleGenAI({ apiKey });

export const runtime = "nodejs";

type GenerateRequestBody = {
  prompt?: string;
  duration?: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateRequestBody;

    const prompt = body.prompt;
    const duration = body.duration;

    if (!prompt) {
      return NextResponse.json(
        { error: "Missing prompt" },
        { status: 400 }
      );
    }

    // INICIAR GERAÇÃO DO VÍDEO
    const operation = await client.models.generateVideos({
      model: "veo-3.0-generate-001",
      prompt,
      config: {
        aspectRatio: "9:16", // Formato story
        ...(duration ? { duration } : {})
      }
    });

    const opName = operation?.name;

    if (!opName) {
      return NextResponse.json(
        { error: "Operation did not return a name" },
        { status: 500 }
      );
    }

    // 🔥 POLLING — FORMATO CORRETO DO SDK → { operation: string }
    let result = await client.operations.getVideosOperation({
      operation: opName
    });

    let tries = 0;
    const max = 60; // 5 minutos

    while (!result.done && tries < max) {
      await new Promise((r) => setTimeout(r, 5000)); // 5s
      result = await client.operations.getVideosOperation({
        operation: opName
      });
      tries++;
    }

    if (!result.done) {
      return NextResponse.json(
        { error: "Video generation timeout" },
        { status: 504 }
      );
    }

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message ?? "Unknown generation error" },
        { status: 500 }
      );
    }

    const videoUri =
      result.response?.generatedVideos?.[0]?.video?.uri ?? null;

    if (!videoUri) {
      return NextResponse.json(
        { error: "No video URI returned" },
        { status: 500 }
      );
    }

    return NextResponse.json({ uri: videoUri });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("VEO API ERROR:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
