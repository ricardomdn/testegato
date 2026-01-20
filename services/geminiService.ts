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
    You are a Video Script Segmenter & Visual Director.
    
    **INPUT SCRIPT:**
    "${cleanScript}"

    **RULE 1: VERBATIM TRANSCRIPTION**
    - Output the script **word-for-word**. Do NOT summarize.

    **RULE 2: PACING**
    - **Hook (First 3 sentences):** Split fast (every 3-6 words).
    - **Body:** Split **Sentence by Sentence**.

    **RULE 3: CONTEXTUAL VISUAL TRANSLATION (CRITICAL)**
    - Do NOT just use "Cat happy" or "Cat sad". That is too generic.
    - You must **translate the MEANING of the text into a CONCRETE VISUAL ACTION** that exists on stock footage sites.
    - Keep terms simple (2-4 words), but make them **relevant**.

    **Examples of Visual Translation:**
    - Text: "Cats have excellent night vision." 
      -> BAD: "Cat vision" (Abstract)
      -> GOOD: **"Cat eyes macro"** or **"Cat pupil close up"**
    
    - Text: "They are agile hunters in the wild."
      -> BAD: "Cat nature"
      -> GOOD: **"Cat jumping grass"** or **"Cat stalking prey"**

    - Text: "Your cat loves you very much."
      -> BAD: "Cat love"
      -> GOOD: **"Cat licking hand"** or **"Cat rubbing leg"**

    - Text: "Ancient Egyptians worshipped them."
      -> BAD: "History cat"
      -> GOOD: **"Sphynx cat"** or **"Cat statue"**

    **SEARCH TERM FORMAT:**
    - Always include "Cat" or "Kitten".
    - Format: [Subject] + [Action/Context].
    - Provide 3 distinct visual options per segment.

    Return the result as a JSON array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert video editor. Match the script text to specific, existing stock footage concepts.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: "The EXACT text from the script.",
              },
              search_terms: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3 relevant, visual search terms (e.g., 'Cat eyes macro', 'Cat stalking').",
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
    The previous search term "${currentTerm}" failed or was not good enough for this text:
    "${originalText}"
    
    Give me a BETTER, CONCRETE stock footage search term.
    Focus on visual action.
    Example: Instead of "Cat agility", use "Cat jumping slow motion".
    
    Return ONLY the string.
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