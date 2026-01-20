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

    **CRITICAL TASK - TIKTOK/REELS PACING (FAST CUTS):**
    You must segment this script into **SHORT VISUAL BEATS**.
    
    **SEGMENTATION RULES:**
    1. **FAST PACING:** Do NOT keep long sentences as one segment. Break them down!
       - Bad: "When cats rub against your leg, they are actually marking you with their scent glands." (Too long, 1 clip)
       - Good: "When cats rub against your leg," (Clip 1)
       - Good: "they are actually marking you" (Clip 2)
       - Good: "with their scent glands." (Clip 3)
    2. **1 Clause = 1 Video Clip.**
    3. Maximum duration per segment should be roughly 2-4 seconds of spoken text.

    **SEARCH TERM RULES (CONTEXT AWARE):**
    1.  For each segment, provide 3 DISTINCT search terms for Pexels/Stock Footage.
    2.  **MATCH THE VISUAL BEAT:**
        - If text is "Cats sleep a lot", search: "Sleeping cat", "Lazy cat on sofa".
        - If text is "They are hunters", search: "Cat pouncing", "Cat eyes dilated", "Cat hunting toy".
    3.  **DEFAULT TO CATS:** Unless the script explicitly mentions a human/object alone (e.g. "Open a can"), always include "Cat" or "Kitten" in the search.
    4.  **English Only.**

    Return the result as a JSON array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a Viral Video Editor specialized in high-retention content. You chop scripts into bite-sized visual pieces to keep the audience engaged.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: "The short phrase or clause for this segment",
              },
              search_terms: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of 3 search terms: [Literal, Mood/Abstract, Broad]",
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
    Generate a **completely different** English search term that captures the essence of this sentence.
    
    **RULES:**
    1. Focus on the VISUAL ACTION.
    2. If it's abstract, think of a metaphor involving a cat.
    3. English ONLY.
    4. Max 3-5 words.
    
    Return ONLY the raw search term string.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a creative visual assistant. You output single search strings matching the script context.",
      }
    });

    return response.text?.trim() || currentTerm;
  } catch (error) {
    console.error("Gemini Regenerate Error:", error);
    throw new Error("Falha ao gerar novo termo.");
  }
};