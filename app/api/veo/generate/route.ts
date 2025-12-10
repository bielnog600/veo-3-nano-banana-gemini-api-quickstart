import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

export const runtime = "nodejs";

const client = new GoogleGenAI({ apiKey });

export async function POST(req: NextRequest) {
  try {
    const { prompt, duration } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    // INICIA A GERAÇÃO
    const operation = await client.models.generateVideos({
      model: "veo-3.0-generate-001",
      prompt,
      config: {
        aspectRatio: "9:16",
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

    // 🔥 AQUI É O POLLING **CORRETO PARA O TEU SDK**
    let result = await client.operations.get(opName);

    let tries = 0;
    const maxTries = 60;

    while (!result.done && tries < maxTries) {
      await new Promise(r => setTimeout(r, 5000));
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
        { error: result.error.message ?? "Unknown error" },
        { status: 500 }
      );
    }

    const uri =
      result.response?.generatedVideos?.[0]?.video?.uri ?? null;

    if (!uri) {
      return NextResponse.json(
        { error: "No URI returned" },
        { status: 500 }
      );
    }

    return NextResponse.json({ uri });
  } catch (err: any) {
    console.error("VEO API ERROR:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
