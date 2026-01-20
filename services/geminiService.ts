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

    **OBJECTIVE: DYNAMIC VIDEO EDITING (HOOK vs STORY)**

    **PHASE 1: THE HOOK (First 20% of script)**
    - **Pace:** Fast and energetic, BUT meaningful.
    - **Rule:** Keep segments between **3 to 8 words**.
    - **Do NOT** split mid-clause awkwardly.
    - **Bad:** "Cats are," (Too short) | "awesome creatures." (Disconnected)
    - **Good:** "Cats are awesome creatures," (Perfect)

    **PHASE 2: THE NARRATIVE (Remaining 80%)**
    - **Pace:** Natural storytelling flow.
    - **Rule:** **SENTENCE BY SENTENCE**.
    - Only split if the sentence is very long (>20 words).
    - Focus on completing the thought before cutting.

    **CRITICAL: SEARCH TERMS FOR STOCK FOOTAGE**
    - Stock sites (Pexels) fail with complex sentences.
    - **RULE:** Generate **SIMPLE, 2-4 WORD** search terms.
    - **Bad:** "Cat looking deeply into the camera with love" (Too complex -> No results)
    - **Good:** "Cat macro eyes" or "Cat looking up"
    - **ALWAYS** include "Cat" or "Kitten" in the query.
    - Provide 3 distinct terms per segment.

    Return the result as a JSON array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a Video Editor Assistant. You prioritize finding good footage matches. You keep search terms simple and broad to ensure results.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: "The script segment text",
              },
              search_terms: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of 3 simple search terms (2-4 words max)",
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
    I need a NEW, SIMPLE stock footage search term.
    
    Context: "${originalText}"
    Old Term: "${currentTerm}"
    
    **TASK:**
    Give me a **BROAD, SIMPLE** search term (1-3 words) that guarantees results on Pexels.
    Example: Instead of "Cat running fast in garden", use "Cat running".
    
    Return ONLY the search term string.
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