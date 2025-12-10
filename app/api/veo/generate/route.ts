import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set.");
}

export const runtime = "nodejs";

const client = new GoogleGenAI({ apiKey });

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

    // INICIA A GERAÇÃO DE VÍDEO
    const operation = await client.models.generateVideos({
      model: "veo-3.0-generate-001",
      prompt,
      config: {
        aspectRatio: "9:16", // formato story
        ...(duration ? { duration } : {})
      }
    });

    const opName = operation?.name;
    if (!opName) {
      return NextResponse.json(
        { error: "No operation name returned" },
        { status: 500 }
      );
    }

    // POLLING → SDK ATUAL: operations.get(name: string)
    let result = await client.operations.get(opName);

    let tries = 0;
    const maxTries = 60; // 60 * 5s = ~5 minutos

    while (!result.done && tries < maxTries) {
      await new Promise((r) => setTimeout(r, 5000));
      result = await client.operations.get(opName);
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
    console.error("VEO API ERROR:", err);

    const message =
      err instanceof Error ? err.message : "Unknown error";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
