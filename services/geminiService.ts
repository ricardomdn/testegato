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

    **CRITICAL TASK - FULL SCRIPT COVERAGE (SENTENCE BY SENTENCE):**
    You must segment this script strictly **SENTENCE BY SENTENCE**.
    It is crucial that you cover the **ENTIRE SCRIPT** from start to finish. Do not skip any parts.
    
    **SEGMENTATION RULES:**
    1. **1 SENTENCE = 1 VIDEO CLIP.**
    2. **DO NOT SUMMARIZE.** Every sentence in the script must be a separate segment.
    3. If a sentence is Long or Complex (has commas or multiple clauses), SPLIT it into 2 or more segments to keep the visual pace dynamic.
    4. If a sentence is extremely short (under 3 words), you may combine it with the next one.

    **SEARCH TERM RULES (CONTEXT AWARE):**
    1.  For each segment, provide 3 DISTINCT search terms for Pexels/Stock Footage.
    2.  **MATCH THE VISUALS:**
        - If the segment describes a specific action (e.g., "The cat knocks over a vase"), search for "Cat knocking vase" or "Broken vase".
        - If the segment is abstract or emotional, search for the corresponding cat behavior (e.g., "Happy cat", "Angry cat").
    3.  **English Only.**

    Return the result as a JSON array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a Video Editor Assistant. Your job is to break down a script into video segments ensuring 100% of the text is covered.",
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