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

    **OBJECTIVE: HYPER-DYNAMIC SOCIAL MEDIA VIDEO (TIKTOK/REELS)**
    
    **CRITICAL SEGMENTATION RULES:**
    1. **SPLIT EVERYTHING:** Do NOT allow long sentences. If a sentence has a comma, "and", "but", or natural pauses, **SPLIT IT** into separate segments.
       - Bad: "Cats love milk, but it is bad for them." (1 segment - TOO LONG)
       - Good: "Cats love milk," (Segment 1)
       - Good: "but it is bad for them." (Segment 2)
    2. **FULL COVERAGE:** You must cover 100% of the text. Do not summarize.
    3. **PACE:** Aim for segments that take 2-3 seconds to read.
    
    **SEARCH TERM RULES:**
    1. Provide 3 English search terms per segment.
    2. **ALWAYS ADD "CAT"**: Even if the text is "It falls down", search for "Cat knocking something over".
    3. **GENERIC BACKUP**: Always include one broader term like "Cute cat face", "Cat movement", or "Cat eyes" in the list to ensure results.

    Return the result as a JSON array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a Viral Video Editor. Your editing style is fast, punchy, and dynamic. You never leave a clip on screen for too long.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: "The short sentence or clause for this segment",
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