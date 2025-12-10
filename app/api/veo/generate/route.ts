import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data" },
        { status: 400 }
      );
    }

    const form = await req.formData();

    const prompt = (form.get("prompt") as string) || "";
    const model = (form.get("model") as string) || "veo-3.0-generate-001";
    const negativePrompt = (form.get("negativePrompt") as string) || undefined;
    const aspectRatio = (form.get("aspectRatio") as string) || undefined;

    const imageFile = form.get("imageFile");
    const imageBase64 = (form.get("imageBase64") as string) || undefined;
    const imageMimeType = (form.get("imageMimeType") as string) || undefined;

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    let image: { imageBytes: string; mimeType: string } | undefined;

    // ✅ Corrigido: não usa mais "instanceof File" (que não existe no Node)
    if (imageFile && typeof (imageFile as any).arrayBuffer === "function") {
      const buf = await (imageFile as any).arrayBuffer();
      const b64 = Buffer.from(buf).toString("base64");

      const mimeType =
        (imageFile as any).type && typeof (imageFile as any).type === "string"
          ? (imageFile as any).type
          : "image/png";

      image = { imageBytes: b64, mimeType };
    } else if (imageBase64) {
      const cleaned = imageBase64.includes(",")
        ? imageBase64.split(",")[1]
        : imageBase64;
      image = { imageBytes: cleaned, mimeType: imageMimeType || "image/png" };
    }

    const operation = await ai.models.generateVideos({
      model,
      prompt,
      ...(image ? { image } : {}),
      config: {
        ...(aspectRatio ? { aspectRatio } : {}),
        ...(negativePrompt ? { negativePrompt } : {}),
      },
    });

    const name = (operation as unknown as { name?: string }).name;
    return NextResponse.json({ name });
  } catch (error: unknown) {
    console.error("Error starting Veo generation:", error);
    return NextResponse.json(
      { error: "Failed to start generation" },
      { status: 500 }
    );
  }
}
