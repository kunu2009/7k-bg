import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please ensure process.env.API_KEY is available.");
  }
  return new GoogleGenAI({ apiKey });
};

interface EditConfig {
  model?: string;
  imageSize?: '1K' | '2K' | '4K';
}

export const editImageWithGemini = async (
  base64Image: string,
  mimeType: string,
  prompt: string,
  config: EditConfig = {}
): Promise<{ imageUrl?: string; text?: string }> => {
  const ai = getClient();
  const model = config.model || 'gemini-2.5-flash-image';
  
  // Clean base64 string if it contains the data URL prefix
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

  const generateConfig: any = {};
  // Only add imageConfig if using the pro model, as Flash/Nano models don't support it
  if (config.imageSize && model === 'gemini-3-pro-image-preview') {
    generateConfig.imageConfig = { imageSize: config.imageSize };
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: generateConfig,
    });

    let resultImageUrl: string | undefined;
    let resultText: string | undefined;

    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          resultImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        } else if (part.text) {
          resultText = part.text;
        }
      }
    }

    return { imageUrl: resultImageUrl, text: resultText };

  } catch (error) {
    console.error("Error generating content:", error);
    throw error;
  }
};