import { GoogleGenAI, Type } from "@google/genai";

export interface SegmentResponse {
  text: string;
  search_terms: string[];
}

export const analyzeScript = async (apiKey: string, script: string): Promise<SegmentResponse[]> => {
  if (!apiKey) throw new Error("API Key do Gemini é obrigatória");

  // Remove formatação excessiva
  const cleanScript = script.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Analyze the following video script about CATS/FELINES.
    
    SCRIPT:
    "${cleanScript}"

    **OBJECTIVE: HYBRID PACING STRATEGY (HOOK vs STORY)**

    You must segment this script applying two different editing rules based on the position in the video.

    **PHASE 1: THE VIRAL HOOK (First ~20% of the script / Intro)**
    - **GOAL:** Grab attention immediately. Hyper-fast cuts.
    - **RULE:** **SPLIT EVERYTHING.** If a sentence has a comma, "and", "but", or a natural pause, SPLIT IT into a new segment.
    - **Limit:** Apply this aggressive splitting for the first 4-5 sentences (resulting in ~15-20 fast clips).

    **PHASE 2: THE STORY BODY (The rest of the script)**
    - **GOAL:** Comfortable viewing experience.
    - **RULE:** **SENTENCE BY SENTENCE.**
    - Keep sentences whole unless they are extremely long (>25 words).
    - Do not split at every comma anymore. Let the viewer breathe.

    **GENERAL RULES:**
    1. **FULL COVERAGE:** You must cover 100% of the text. Do not skip or summarize.
    2. **SEARCH TERMS:** Provide 3 distinct English search terms per segment.
       - **ALWAYS** include "Cat" in the query (e.g., "Cat jumping" instead of "Jumping").
       - Include at least one generic backup like "Cute cat face" or "Cat movement".

    Return the result as a JSON array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a Professional Video Editor. You know that the first few seconds need fast cuts to stop the scroll, but the rest of the video needs a steady pace to tell the story.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: "The sentence or clause for this segment",
              },
              search_terms: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of 3 search terms",
              },
            },
            required: ["text", "search_terms"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];
    
    const data = JSON.parse(text) as SegmentResponse[];
    return data;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Falha ao analisar o script com Gemini. Verifique sua API Key e tente novamente.");
  }
};

export const generateAlternativeTerm = async (apiKey: string, originalText: string, currentTerm: string): Promise<string> => {
  if (!apiKey) throw new Error("API Key do Gemini é obrigatória");

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    I need a NEW stock footage search term for a video script segment.
    
    Original Sentence: "${originalText}"
    Current Search Term: "${currentTerm}"
    
    **TASK:**
    Generate a **completely different** English search term.
    
    **RULES:**
    1. Focus on the VISUAL ACTION.
    2. English ONLY.
    3. Max 3-5 words.
    
    Return ONLY the raw search term string.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a creative visual assistant.",
      }
    });

    return response.text?.trim() || currentTerm;
  } catch (error) {
    console.error("Gemini Regenerate Error:", error);
    throw new Error("Falha ao gerar novo termo.");
  }
};