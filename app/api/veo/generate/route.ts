import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set in environment variables.");
}

const client = new GoogleGenAI({ apiKey });

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const prompt: string | undefined = body?.prompt;
    const duration: number | undefined = body?.duration;

    if (!prompt) {
      return NextResponse.json(
        { error: "Missing prompt" },
        { status: 400 }
      );
    }

    const operation = await client.models.generateVideos({
      model: "veo-3.0-generate-001",
      prompt,
      config: {
        aspectRatio: "9:16",
        motion: "cinematic",
        frameRate: 30,
        ...(duration ? { duration } : {}),
      },
    });

    const opName = operation?.name;
    if (!opName) {
      return NextResponse.json(
        { error: "Operation did not return a name" },
        { status: 500 }
      );
    }

    // Polling da operação
    let result = await client.operations.getVideosOperation({ operation: opName });

    let attempts = 0;
    while (!result.done && attempts < 60) {
      await new Promise((res) => setTimeout(res, 5000));
      result = await client.operations.getVideosOperation({ operation: opName });
      attempts++;
    }

    if (!result.done) {
      return NextResponse.json(
        { error: "Video generation timeout" },
        { status: 504 }
      );
    }

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message ?? "Unknown error" },
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
  } catch (e) {
    const err = e instanceof Error ? e.message : "Unknown error";
    console.error("VEO API ERROR:", err);
    return NextResponse.json(
      { error: err },
      { status: 500 }
    );
  }
}
