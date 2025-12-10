import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// ✅ Type predicate válido: File é subtipo de FormDataEntryValue
function isFileValue(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value instanceof File;
}

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

    const userPrompt = (form.get("prompt") as string) || "";
    const model =
      (form.get("model") as string) || "veo-3.0-nano-001"; // ou o modelo que você estiver usando

    const durationStr = form.get("duration") as string | null;
    const duration = durationStr ? Number(durationStr) : undefined;

    const imageFileValue = form.get("imageFile");
    const imageBase64 = (form.get("imageBase64") as string) || "";
    const imageMimeType =
      (form.get("imageMimeType") as string) || "image/png";

    if (!userPrompt) {
      return NextResponse.json(
        { error: "Missing prompt" },
        { status: 400 }
      );
    }

    let image:
      | {
          imageBytes: string;
          mimeType: string;
        }
      | undefined;

    // ✅ Se veio arquivo via formData (File)
    if (isFileValue(imageFileValue)) {
      const buffer = Buffer.from(await imageFileValue.arrayBuffer());
      image = {
        imageBytes: buffer.toString("base64"),
        mimeType: imageFileValue.type || "image/png",
      };
    }
    // ✅ Se veio base64 direto (por exemplo, da tua UI)
    else if (imageBase64) {
      const cleaned = imageBase64.includes(",")
        ? imageBase64.split(",")[1]
        : imageBase64;

      image = {
        imageBytes: cleaned,
        mimeType: imageMimeType,
      };
    }

    // 🔥 Prompt forçando: 9:16, sem texto, alta qualidade
    const finalPrompt = `
Gere um vídeo em ALTA QUALIDADE, no formato vertical 9:16 (story).
NÃO coloque nenhum texto, palavra, legenda ou escrita na tela.
Estilo cinematográfico, movimento suave, boa iluminação e muitos detalhes.
Cena: ${userPrompt}
`.trim();

    const operation = await ai.models.generateVideos({
      model,
      prompt: finalPrompt,
      ...(image ? { image } : {}),
      config: {
        aspectRatio: "9:16",
        quality: "high",
        detail: "high",
        motion: "cinematic",
        frameRate: 30,
        ...(duration ? { duration } : {}),
      },
    });

    const name = (operation as unknown as { name?: string }).name;

    return NextResponse.json({ name });
  } catch (error) {
    console.error("Error starting Veo generation:", error);
    return NextResponse.json(
      { error: "Failed to start generation" },
      { status: 500 }
    );
  }
}
