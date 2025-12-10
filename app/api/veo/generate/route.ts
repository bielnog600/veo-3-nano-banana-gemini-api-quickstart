import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

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
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    // --- INICIAR GERAÇÃO DE VÍDEO ---
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
        { error: "Operation did not return a name" },
        { status: 500 }
      );
    }

    // --- POLLING USANDO OPERATIONS.GETVIDEOOPERATION (API NOVA) ---
    let tries = 0;
    const maxTries = 60; // 60 * 5s = 5 minutos

    // a tipagem nova geralmente usa um objeto com { name: string }
    // mas o erro anterior era justamente porque passava a prop errada.
    let result = await client.operations.getVideosOperation({ name: opName });

    while (!result.done && tries < maxTries) {
      await new Promise((r) => setTimeout(r, 5000));
      result = await client.operations.getVideosOperation({ name: opName });
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

    // SDK novo costuma devolver algo como:
    // result.response.generatedVideos[0].video.uri
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
