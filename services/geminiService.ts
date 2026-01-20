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

    **CRITICAL TASK - HYPER-DYNAMIC EDITING (TikTok/Reels Style):**
    You must segment this script into **SHORT, FAST-PACED VISUAL BLOCKS**.
    
    **SEGMENTATION RULES:**
    1. **SPLIT AGGRESSIVELY:** Do NOT stick to 1 sentence = 1 clip. Break sentences down into smaller clauses.
    2. **COMMAS & CONJUNCTIONS:** Anytime there is a comma, "and", "but", "because", or a natural pause, START A NEW SEGMENT.
    3. **VISUAL PACING:**
       - Example: "The cat jumps on the table, looks at the glass, and knocks it over."
       - **BAD:** 1 Clip.
       - **GOOD:** 3 Clips: ["The cat jumps on the table", "looks at the glass", "and knocks it over"].
    4. **MAX LENGTH:** Segments should generally remain under 10-12 words to keep the viewer engaged.

    **SEARCH TERM RULES (CONTEXT AWARE):**
    1.  For each segment, provide 3 DISTINCT search terms for Pexels/Stock Footage.
    2.  **MATCH THE SUBJECT:** While this is a cat channel, the visual must match the spoken words.
        - If the segment says "When you are sick", search for **"Sick person in bed"** or **"Woman sneezing"**.
        - If the segment says "He knocks over the glass", search for **"Glass of water falling"** or **"Cat knocking glass"**.
    3.  **DEFAULT TO CATS:** If the segment is about the cat's feelings, instincts, or general behavior, THEN use terms like "Cat", "Kitten", "Cat eyes", etc.
    4.  **English Only:** Search terms must be in English.

    Return the result as a JSON array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a Professional Video Editor for TikTok/Reels. You specialize in high-retention editing. You chop scripts into bite-sized visual pieces to keep the audience hooked. You utilize stock footage creatively.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: "The partial sentence or clause for this segment",
              },
              search_terms: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of 3 search terms: [Literal Representation, Contextual/Mood, Broad]",
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
    1. If the sentence mentions a specific object or human action (e.g., "Sick person", "Opening door"), search for THAT object/human.
    2. If the sentence is about the cat, search for the cat.
    3. English ONLY.
    4. Max 4-5 words.
    
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