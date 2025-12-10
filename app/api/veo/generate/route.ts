import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function isBlobLike(value: FormDataEntryValue | null): value is Blob {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    typeof (value as Blob).arrayBuffer === "function"
  );
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
    const model = (form.get("model") as string) || "veo-3.0-generate-001";

    const duration = form.get("duration")
      ? Number(form.get("duration"))
      : undefined;

    const imageFile = form.get("imageFile");
    const imageBase64 = (form.get("imageBase64") as string) || undefined;
    const imageMimeType =
      (form.get("imageMimeType") as string) || "image/png";

    if (!userPrompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    let image: { imageBytes: string; mimeType: string } | undefined;

    if (isBlobLike(imageFile)) {
      const buf = Buffer.from(await imageFile.arrayBuffer());
      image = {
        imageBytes: buf.toString("base64"),
        mimeType: imageFile.type || "image/png",
      };
    } else if (imageBase64) {
      const cleaned = imageBase64.includes(",")
        ? imageBase64.split(",")[1]
        : imageBase64;

      image = { imageBytes: cleaned, mimeType: imageMimeType };
    }

    // 🔥 Prompt otimizado: vertical + sem texto + qualidade alta
    const prompt = `
      Gere um vídeo em alta qualidade no formato 9:16 (story), estilo cinematográfico.
      Não coloque NENHUM texto ou legenda na tela.
      Imagem mais nítida possível, iluminação profissional, detalhes realistas.
      Movimento suave, estilo cinemático.
      Cena: ${userPrompt}
    `;

    const operation = await ai.models.generateVideos({
      model,
      prompt,
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
