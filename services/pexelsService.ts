import { PexelsResponse, PexelsVideo } from "../types";

// Agora retorna uma lista de vídeos para permitir seleção aleatória e evitar repetidos
export const searchPexelsVideo = async (apiKey: string, query: string, page: number = 1): Promise<PexelsVideo[]> => {
  if (!apiKey) throw new Error("API Key do Pexels é obrigatória");

  // Aumentei per_page para 15 para ter um pool maior de escolhas
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=15&page=${page}&orientation=landscape`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Chave API do Pexels inválida.");
      }
      // Loga o erro mas retorna array vazio para permitir que o app tente o fallback
      console.warn(`Erro na API do Pexels (${response.status}): ${response.statusText}`);
      return [];
    }

    const data: PexelsResponse = await response.json();
    
    return data.videos || [];
  } catch (error) {
    console.error("Pexels API Error:", error);
    return [];
  }
};