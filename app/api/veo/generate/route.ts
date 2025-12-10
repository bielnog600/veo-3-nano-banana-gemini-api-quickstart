import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type ImagePayload = {
  imageBytes: string;
  mimeType: string;
};

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
    const negativePrompt =
      (form.get("negativePrompt") as string) || undefined;
    const aspectRatio = (form.get("aspectRatio") as string) || undefined;

    const imageFile = form.get("imageFile");
    const imageBase64 = (form.get("imageBase64") as string) || undefined;
    const imageMimeType =
      (form.get("imageMimeType") as string) || undefined;

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    let image: ImagePayload | undefined;

    // ✅ Sem "File" no runtime e sem "any"
    if (
      imageFile &&
      typeof (imageFile as Blob).arrayBuffer === "function"
    ) {
      const fileBlob = imageFile as Blob;
      const buf = await fileBlob.arrayBuffer();
      const b64 = Buffer.from(buf).toString("base64");

      const withType = imageFile as { type?: string };
      const mimeType =
        typeof withType.type === "string" && withType.type
          ? withType.type
          : "image/png";

      image = { imageBytes: b64, mimeType };
    } else if (imageBase64) {
      const cleaned = imageBase64.includes(",")
        ? imageBase64.split(",")[1]
        : imageBase64;

      image = {
        imageBytes: cleaned,
        mimeType: imageMimeType || "image/png",
      };
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
    const message =
      error instanceof Error ? error.message : "Failed to start generation";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
