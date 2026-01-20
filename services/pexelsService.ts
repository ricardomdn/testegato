import { PexelsResponse, PexelsVideo } from "../types";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Agora retorna uma lista de vídeos para permitir seleção aleatória e evitar repetidos
// Adicionado suporte a retries para erro 429 (Rate Limit)
export const searchPexelsVideo = async (apiKey: string, query: string, page: number = 1, retryCount: number = 0): Promise<PexelsVideo[]> => {
  if (!apiKey) throw new Error("API Key do Pexels é obrigatória");

  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=15&page=${page}&orientation=landscape`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!response.ok) {
      // Se for erro 429 (Too Many Requests), espera e tenta de novo
      if (response.status === 429 && retryCount < 3) {
        console.warn(`Rate limit atingido para "${query}". Tentando novamente em 2s... (Tentativa ${retryCount + 1}/3)`);
        await wait(2000 + (retryCount * 1000)); // Backoff exponencial simples: 2s, 3s, 4s
        return searchPexelsVideo(apiKey, query, page, retryCount + 1);
      }

      if (response.status === 401) {
        throw new Error("Chave API do Pexels inválida.");
      }
      
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