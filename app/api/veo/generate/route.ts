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

function isFileLike(value: FormDataEntryValue | null): value is Blob {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value
  );
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data" },
        { status: 400 }
      );
    }

    const form = await req.formData();

    const promptValue = form.get("prompt");
    const modelValue = form.get("model");
    const negativePromptValue = form.get("negativePrompt");
    const aspectRatioValue = form.get("aspectRatio");
    const imageFileValue = form.get("imageFile");
    const imageBase64Value = form.get("imageBase64");
    const imageMimeTypeValue = form.get("imageMimeType");

    const prompt = typeof promptValue === "string" ? promptValue : "";

    const model =
      typeof modelValue === "string" && modelValue.length > 0
        ? modelValue
        : "veo-3.0-generate-001";

    const negativePrompt =
      typeof negativePromptValue === "string" &&
      negativePromptValue.length > 0
        ? negativePromptValue
        : undefined;

    const aspectRatio =
      typeof aspectRatioValue === "string" && aspectRatioValue.length > 0
        ? aspectRatioValue
        : undefined;

    const imageBase64 =
      typeof imageBase64Value === "string" &&
      imageBase64Value.length > 0
        ? imageBase64Value
        : undefined;

    const imageMimeType =
      typeof imageMimeTypeValue === "string" &&
      imageMimeTypeValue.length > 0
        ? imageMimeTypeValue
        : undefined;

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    let image: ImagePayload | undefined;

    // Tratamento do upload de imagem (sem usar `File` nem `any`)
    if (isFileLike(imageFileValue)) {
      const buf = await imageFileValue.arrayBuffer();
      const b64 = Buffer.from(buf).toString("base64");

      image = {
        imageBytes: b64,
        mimeType: imageFileValue.type || "image/png",
      };
    } else if (imageBase64) {
      const cleaned = imageBase64.includes(",")
        ? imageBase64.split(",")[1]!
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

    const opNameField = (operation as { name?: unknown }).name;
    const name = typeof opNameField === "string" ? opNameField : undefined;

    return NextResponse.json({ name });
  } catch (error) {
    console.error("Error starting Veo generation:", error);
    return NextResponse.json(
      { error: "Failed to start generation" },
      { status: 500 }
    );
  }
}
