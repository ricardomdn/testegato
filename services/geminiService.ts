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

    **RULE 1: VERBATIM TRANSCRIPTION (NO SUMMARIZING)**
    - You must output the script **word-for-word**. 
    - Do NOT delete a single word.
    - Do NOT rewrite.
    - If input is 1000 words, output must be 1000 words split into segments.

    **RULE 2: PACING (HOOK vs BODY)**
    
    A) **THE HOOK (First 3 sentences ONLY):**
       - Split frequently (every 3-6 words).
       - Create a fast pace.

    B) **THE BODY (The rest of the text):**
       - **SAFE MODE.**
       - Split **SENTENCE BY SENTENCE**.
       - Keep full sentences together unless they are massive (>25 words).
       - Do NOT chop sentences in the middle.

    **RULE 3: "DUMB" SEARCH TERMS (CRITICAL)**
    - For the BODY sections, use EXTREMELY SIMPLE search terms.
    - **Structure:** "Cat" + [Single Verb/Adjective].
    - **Examples:**
      - Text: "Cats have a special organ to smell..." -> Search: "Cat smelling" (NOT "Cat organ")
      - Text: "They sleep 16 hours a day..." -> Search: "Cat sleeping" (NOT "Cat sleeping 16 hours")
      - Text: "Ancient Egyptians worshipped them..." -> Search: "Cat statue" or "Cat" (NOT "Egyptian cat worship")
    - **ALWAYS start with "Cat" or "Kitten".**
    - Provide 3 options per segment.

    Return the result as a JSON array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are a mechanical transcriber. You do not think, you only cut text and provide simple keywords.",
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
                description: "3 very simple search terms (e.g., 'Cat sleeping').",
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