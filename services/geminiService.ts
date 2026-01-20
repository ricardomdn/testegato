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

    **CRITICAL TASK - DYNAMIC EDITING (SENTENCE BY SENTENCE):**
    You must segment this script strictly **SENTENCE BY SENTENCE**.
    
    **SEGMENTATION RULES:**
    1. **1 SENTENCE = 1 VIDEO CLIP.** Do NOT group sentences together.
    2. If a sentence is extremely short (under 3 words), you may combine it with the next one.
    3. If a sentence is very long/complex, split it into two visual segments based on clauses.
    4. The goal is a **FAST PACED** video where the visual changes every time a new sentence starts.

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
        systemInstruction: "You are a Professional Video Editor. You choose the best B-Roll footage to illustrate the narration. You are NOT afraid to show humans, objects, or scenery if the script mentions them, to create a rich visual storytelling experience.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: "The single sentence or clause for this segment",
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