
import { GoogleGenAI } from "@google/genai";

export const generateCharacterSection = async (
  referenceBase64: string,
  sectionType: 'turnaround' | 'poses' | 'merch' | 'posters',
  promptDetails: string
): Promise<string> => {
  // Use a fresh instance to ensure it uses the latest selected API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const model = 'gemini-3-pro-image-preview';
  
  const prompts = {
    turnaround: "Create a professional 3D cartoon style character turnaround (front view, side view, back view) of the character in the reference image. High-quality 3D render, clean white background, professional studio lighting, consistent character details.",
    poses: "Generate a 6-grid layout showing the character from the reference image in 6 distinct dynamic action poses. Maintain strict IP consistency. 3D cartoon style, soft lighting, clean white background, playful and cute expressions.",
    merch: `Professional commercial product photography of a large merchandise collection featuring the character from the reference image. Style is cute, 3D cartoon, childish yet professional. Items arranged orderly on a white background: irregular business cards, badges, coffee carrier, paper bags, stickers, coffee cups with sleeves, scarf, socks, gloves, notebook, plush pillow, phone case, tote bag, keychain, eye mask. Expert studio lighting.`,
    posters: "Generate a 6-grid collection of cute theme posters featuring the character from the reference image. Vibrant colors, consistent IP character, diverse scenarios, high-quality 3D graphics, minimal and clean design."
  };

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [
        {
          inlineData: {
            data: referenceBase64.split(',')[1],
            mimeType: 'image/png',
          },
        },
        {
          text: `${prompts[sectionType]} ${promptDetails}. High definition, 4k, professional quality.`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: sectionType === 'turnaround' ? '16:9' : '1:1',
        imageSize: "2K" // Requested high-resolution output
      }
    }
  });

  let imageUrl = '';
  const candidate = response.candidates?.[0];
  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
  }

  if (!imageUrl) throw new Error("No image was generated. Please check your API key or try again.");
  return imageUrl;
};
