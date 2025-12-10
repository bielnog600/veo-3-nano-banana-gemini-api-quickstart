import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Função auxiliar porque NEXT NÃO tem "File", só Blob
function isBlob(value: FormDataEntryValue | null): value is Blob {
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

    const prompt = (form.get("prompt") as string) || "";
    const model = (form.get("model") as string) || "veo-3.0-generate-001";

    // 🔥 Sempre remove texto / legendas:
    let negativePromptBase =
      "no subtitles, no captions, no text, no words, no writing, no on-screen text, no text overlay";

    const negativePromptUser = form.get("negativePrompt") as string | null;
    const negativePrompt = negativePromptUser
      ? `${negativePromptBase}, ${negativePromptUser}`
      : negativePromptBase;

    const aspectRatio = (form.get("aspectRatio") as string) || undefined;

    const imageFile = form.get("imageFile");
    const imageBase64 = (form.get("imageBase64") as string) || undefined;
    const imageMimeType = (form.get("imageMimeType") as string) || undefined;

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    let image: { imageBytes: string; mimeType: string } | undefined;

    // Upload de imagem vindo via File/Blob
    if (isBlob(imageFile)) {
      const buf = Buffer.from(await imageFile.arrayBuffer());
      image = { imageBytes: buf.toString("base64"), mimeType: imageFile.type || "image/png" };
    }
    // Imagem enviada via base64 string
    else if (imageBase64) {
      const cleaned = imageBase64.includes(",")
        ? imageBase64.split(",")[1]
        : imageBase64;
      image = { imageBytes: cleaned, mimeType: imageMimeType || "image/png" };
    }

    // 🔥 Chamada da API VEO
    const operation = await ai.models.generateVideos({
      model,
      prompt,
      ...(image ? { image } : {}),
      config: {
        negativePrompt,
        ...(aspectRatio ? { aspectRatio } : {})
      }
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
