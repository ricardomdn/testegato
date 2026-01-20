import { GoogleGenAI, Type } from "@google/genai";

export interface SegmentResponse {
  text: string;
  search_terms: string[];
}

export const analyzeScript = async (apiKey: string, script: string): Promise<SegmentResponse[]> => {
  if (!apiKey) throw new Error("API Key do Gemini é obrigatória");

  // Remove formatação excessiva mas mantém pontuação vital
  const cleanScript = script.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    You are a Video Script Segmenter.
    
    **INPUT SCRIPT:**
    "${cleanScript}"

    **CRITICAL RULE: DO NOT SUMMARIZE. DO NOT SKIP WORDS.**
    You must output the script EXACTLY as written, broken into segments. If the script has 500 words, your segments must contain all 500 words.

    **PACING STRATEGY (The "10 Clip Hook"):**
    
    1. **THE HOOK (First 3 sentences ONLY):**
       - Split these sentences at every comma, pause, or conjunction.
       - Aim for very short segments (3-6 words).
       - This creates a fast-paced intro (approx. 10 clips).

    2. **THE BODY (Everything else):**
       - **SAFE MODE.**
       - Segment **SENTENCE BY SENTENCE**.
       - Do NOT split inside a sentence unless it is extremely long (>25 words).
       - Keep the flow slow and steady.

    **SEARCH TERM RULES (Prevent "No Video Found"):**
    - Pexels search is stupid. Do not use complex concepts.
    - **FORMAT:** [Adjective] [Noun] OR [Noun] [Verb]
    - **ALWAYS** include "Cat" or "Kitten".
    - **Examples:**
      - BAD: "Cat wondering about the universe" (Too complex)
      - GOOD: "Cat looking up"
      - BAD: "Feline agility demonstration"
      - GOOD: "Cat jumping"
    - Provide 3 variations per segment.

    Return the result as a JSON array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a mechanical transcriber. Your job is to cut the text, not rewrite it. You never exclude information.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: "The EXACT text from the script for this segment.",
              },
              search_terms: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3 simple, 2-word search terms (e.g., 'Cat sleeping').",
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
    Generate a foolproof stock footage search term.
    
    Context: "${originalText}"
    Previous Failed Term: "${currentTerm}"
    
    **RULE:**
    Return a generic, broad term that 100% exists on Pexels.
    Use ONLY: "Cat" + [Action/Part].
    Max 2-3 words.
    
    Example: "Cat eyes", "Cat sleeping", "Orange cat".
    
    Return ONLY the string.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a helpful assistant.",
      }
    });

    return response.text?.trim() || currentTerm;
  } catch (error) {
    console.error("Gemini Regenerate Error:", error);
    throw new Error("Falha ao gerar novo termo.");
  }
};