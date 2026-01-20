import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ResultList } from './components/ResultList';
import { analyzeScript, generateAlternativeTerm } from './services/geminiService';
import { searchPexelsVideo } from './services/pexelsService';
import { ApiKeys, ScriptSegment, PexelsVideo } from './types';
import { AuthGate } from './components/AuthGate';
import JSZip from 'jszip';
import saveAs from 'file-saver';

// Helper delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const PLACEHOLDER_TEXT = `Ex: Você sabe por que seu gato te "amassa" com as patinhas? Esse comportamento, conhecido como 'fazer pãozinho', vem da infância. Quando filhotes, eles fazem isso na barriga da mãe para estimular o leite. Mas quando adultos, é um sinal supremo de afeto e segurança. Se o seu gato faz isso em você, parabéns! Ele te considera sua "mãe gigante". Mas cuidado: quanto mais amor, mais unhadas sem querer!`;

// Termos ultra-genéricos e seguros
const FALLBACK_CAT_TERMS = [
  "cat", "cute cat", "kitten", "cat face", "cat eyes", 
  "cat sleeping", "cat playing", "funny cat", "white cat", 
  "black cat", "orange cat", "tabby cat"
];

const AppContent: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKeys>(() => {
    try {
      const saved = localStorage.getItem('ai_broll_keys');
      return saved ? JSON.parse(saved) : { gemini: '', pexels: '' };
    } catch (e) {
      return { gemini: '', pexels: '' };
    }
  });

  const [script, setScript] = useState('');
  const [segments, setSegments] = useState<ScriptSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [isZipping, setIsZipping] = useState(false);

  const handleGenerate = async () => {
    setError(null);
    if (!apiKeys.gemini || !apiKeys.pexels) {
      setError("Por favor, insira ambas as chaves API na barra lateral antes de continuar.");
      return;
    }
    if (!script.trim()) {
      setError("Por favor, insira um roteiro para analisar.");
      return;
    }

    setLoading(true);
    setSegments([]);

    try {
      // Step 1: Gemini Analysis
      setLoadingStep('Analisando roteiro completo (Transcrição)...');
      const rawSegments = await analyzeScript(apiKeys.gemini, script);
      
      if (rawSegments.length === 0) {
        throw new Error("A IA não retornou nenhum segmento válido.");
      }

      // Step 2: Pexels Video Search
      setLoadingStep(`Buscando clipes para ${rawSegments.length} cenas (Modo Seguro)...`);
      
      const segmentPromises = rawSegments.map(async (seg, index) => {
        let videoData: PexelsVideo | undefined;
        let usedTerm = seg.search_terms[0];

        // --- STAGGER DELAY (Crítico para evitar "Video Not Found" em massa) ---
        // Aumentado para 800ms por item. Se tiver 50 itens, o ultimo começa 40s depois.
        // Isso garante que o Pexels não bloqueie a conexão.
        await delay(index * 800); 

        // --- TENTATIVA 1: Termos Específicos da IA ---
        for (const term of seg.search_terms) {
          try {
            const videos = await searchPexelsVideo(apiKeys.pexels, term, 1);
            if (videos && videos.length > 0) {
              const randomIndex = Math.floor(Math.random() * Math.min(videos.length, 5));
              videoData = videos[randomIndex];
              usedTerm = term;
              break; 
            }
          } catch (e) { /* ignore */ }
        }

        // --- TENTATIVA 2: FALLBACK GENÉRICO SEGURO ---
        if (!videoData) {
            try {
                const randomGenericTerm = FALLBACK_CAT_TERMS[Math.floor(Math.random() * FALLBACK_CAT_TERMS.length)];
                // Reduzi o range de páginas para 1-5 para garantir resultados (páginas muito altas as vezes falham)
                const randomPage = Math.floor(Math.random() * 5) + 1;
                
                await delay(200); // Pequeno delay extra antes do fallback
                const videos = await searchPexelsVideo(apiKeys.pexels, randomGenericTerm, randomPage);
                
                if (videos && videos.length > 0) {
                    const randomIndex = Math.floor(Math.random() * videos.length);
                    videoData = videos[randomIndex];
                    usedTerm = `${randomGenericTerm} (Backup)`;
                }
            } catch (e) { console.warn("Fallback aleatório falhou"); }
        }

        // --- TENTATIVA 3: REDE DE SEGURANÇA NUCLEAR ---
        // Se tudo falhar, busca "Cat" na página 1. Impossível falhar a menos que a API esteja fora.
        if (!videoData) {
            try {
                await delay(200);
                const videos = await searchPexelsVideo(apiKeys.pexels, "cat", 1);
                if (videos && videos.length > 0) {
                    const randomIndex = Math.floor(Math.random() * Math.min(videos.length, 5));
                    videoData = videos[randomIndex];
                    usedTerm = "Cat (Final Safe)";
                }
            } catch (e) { console.warn("Fallback final falhou"); }
        }

        // Processa URL do vídeo
        let bestVideoUrl = null;
        if (videoData && videoData.video_files) {
            const hdFile = videoData.video_files.find(f => f.quality === 'hd' && f.width >= 1280);
            const sdFile = videoData.video_files.find(f => f.quality === 'sd');
            bestVideoUrl = hdFile ? hdFile.link : (sdFile ? sdFile.link : videoData.video_files[0]?.link);
        }

        return {
          id: `seg-${index}-${Date.now()}`,
          text: seg.text,
          searchTerm: usedTerm,
          allSearchTerms: seg.search_terms,
          videoUrl: bestVideoUrl,
          videoDuration: videoData?.duration,
          videoUser: videoData?.user?.name,
          videoUserUrl: videoData?.user?.url
        };
      });

      const results = await Promise.all(segmentPromises);
      setSegments(results);

    } catch (err: any) {
      setError(err.message || "Ocorreu um erro desconhecido.");
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleUpdateSegment = async (segmentId: string, newTerm: string) => {
    const segmentIndex = segments.findIndex(s => s.id === segmentId);
    if (segmentIndex === -1) return;

    try {
      const videos = await searchPexelsVideo(apiKeys.pexels, newTerm, 1);
      
      let bestVideoUrl = null;
      let videoData: PexelsVideo | undefined;

      if (videos && videos.length > 0) {
        videoData = videos[0]; 
        const hdFile = videoData.video_files.find(f => f.quality === 'hd' && f.width >= 1280);
        const sdFile = videoData.video_files.find(f => f.quality === 'sd');
        bestVideoUrl = hdFile ? hdFile.link : (sdFile ? sdFile.link : videoData.video_files[0]?.link);
      }

      setSegments(prev => {
        const newSegments = [...prev];
        newSegments[segmentIndex] = {
          ...newSegments[segmentIndex],
          searchTerm: newTerm,
          videoUrl: bestVideoUrl,
          videoDuration: videoData?.duration,
          videoUser: videoData?.user?.name,
          videoUserUrl: videoData?.user?.url
        };
        return newSegments;
      });
    } catch (error) {
      console.error("Erro ao atualizar segmento:", error);
    }
  };

  const handleRegenerateSegment = async (segmentId: string) => {
    const segmentIndex = segments.findIndex(s => s.id === segmentId);
    if (segmentIndex === -1) return;
    const segment = segments[segmentIndex];

    try {
      const newTerm = await generateAlternativeTerm(apiKeys.gemini, segment.text, segment.searchTerm);
      const videos = await searchPexelsVideo(apiKeys.pexels, newTerm, 1);
      
      let bestVideoUrl = null;
      let videoData: PexelsVideo | undefined;

      if (videos && videos.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(videos.length, 3));
        videoData = videos[randomIndex];
        
        const hdFile = videoData.video_files.find(f => f.quality === 'hd' && f.width >= 1280);
        const sdFile = videoData.video_files.find(f => f.quality === 'sd');
        bestVideoUrl = hdFile ? hdFile.link : (sdFile ? sdFile.link : videoData.video_files[0]?.link);
      }

      setSegments(prev => {
        const newSegments = [...prev];
        newSegments[segmentIndex] = {
          ...newSegments[segmentIndex],
          searchTerm: newTerm,
          videoUrl: bestVideoUrl,
          videoDuration: videoData?.duration,
          videoUser: videoData?.user?.name,
          videoUserUrl: videoData?.user?.url
        };
        return newSegments;
      });

    } catch (error) {
       console.error("Erro ao regenerar segmento:", error);
    }
  };

  const handleDownloadAll = async () => {
    const videosToDownload = segments.filter(s => s.videoUrl);
    if (videosToDownload.length === 0) return;

    setDownloading(true);
    setIsZipping(false);
    setDownloadProgress({ current: 0, total: videosToDownload.length });
    
    const zip = new JSZip();
    const folder = zip.folder("gatos-b-roll");

    try {
      const downloadPromises = videosToDownload.map(async (segment, index) => {
        if (!segment.videoUrl) return null;
        try {
          const response = await fetch(segment.videoUrl);
          if (!response.ok) throw new Error(`Falha no download`);
          const blob = await response.blob();
          setDownloadProgress(prev => ({ ...prev, current: prev.current + 1 }));
          const fileName = `${index + 1}_1.mp4`;
          return { fileName, blob };
        } catch (e) {
          console.error(`Erro ao baixar video ${index}:`, e);
          return null;
        }
      });

      const files = await Promise.all(downloadPromises);

      files.forEach(file => {
        if (file && folder) folder.file(file.fileName, file.blob);
      });

      if (files.filter(f => f !== null).length > 0) {
        setIsZipping(true);
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, "gatos-pack.zip");
      }

    } catch (err) {
      console.error("Erro ao gerar ZIP:", err);
      setError("Falha ao criar arquivo ZIP.");
    } finally {
      setDownloading(false);
      setIsZipping(false);
      setDownloadProgress({ current: 0, total: 0 });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar apiKeys={apiKeys} setApiKeys={setApiKeys} />
      <main className="flex-1 lg:ml-80 p-6 md:p-12 w-full transition-all flex flex-col max-w-[1600px] mx-auto">
        <div className="flex-grow">
          <header className="mb-12 text-center lg:text-left">
            <div className="inline-block px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-400 text-xs font-semibold tracking-wider uppercase mb-4">
              Cat Video Maker 🐱
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
              Gatos <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500">AI Studio</span>
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl leading-relaxed">
              Transforme curiosidades felinas em vídeos virais. Cole seu roteiro e a IA encontra os vídeos de gatinhos perfeitos para cada cena.
            </p>
          </header>

          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl mb-12">
            <label htmlFor="script-input" className="block text-sm font-semibold text-slate-300 mb-3 flex justify-between">
              <span>Roteiro do Vídeo</span>
              <span className="text-slate-500 font-normal text-xs uppercase tracking-wider">Cole suas curiosidades abaixo</span>
            </label>
            <textarea
              id="script-input"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder={PLACEHOLDER_TEXT}
              className="w-full h-56 bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all resize-y text-base leading-relaxed"
            />
            
            <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                {script.length > 0 && `${script.length} caracteres`}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                {segments.length > 0 && !loading && (
                   <button
                    onClick={handleDownloadAll}
                    disabled={downloading}
                    className={`
                      px-5 py-3 rounded-xl font-bold text-white transition-all flex items-center gap-2 justify-center border border-slate-600 min-w-[160px]
                      ${downloading ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}
                    `}
                   >
                     {downloading ? (
                         <div className="flex items-center gap-2">
                            <svg className="animate-spin h-5 w-5 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>
                              {isZipping ? 'Compactando...' : `${downloadProgress.current}/${downloadProgress.total}`}
                            </span>
                         </div>
                     ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span className="flex items-center gap-1">Baixar Tudo</span>
                        </>
                     )}
                   </button>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={loading || downloading}
                  className={`
                    px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center gap-2 justify-center
                    ${loading 
                      ? 'bg-slate-700 cursor-not-allowed text-slate-400' 
                      : 'bg-orange-600 hover:bg-orange-500 hover:shadow-orange-500/20 active:transform active:scale-95'
                    }
                  `}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processando...
                    </>
                  ) : (
                    <>
                      <span>🐾</span> {segments.length > 0 ? 'Gerar Novamente' : 'Buscar Gatos'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {loading && (
            <div className="mt-8 text-center animate-pulse">
              <p className="text-orange-400 font-medium">{loadingStep}</p>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-900/20 border border-red-800 rounded-xl flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="font-bold text-red-500">Erro</h4>
                <p className="text-red-300 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          <div className="w-full">
            <ResultList 
                segments={segments} 
                onUpdateSegment={handleUpdateSegment} 
                onRegenerateSegment={handleRegenerateSegment}
            />
          </div>
        </div>

        <footer className="mt-20 pt-8 border-t border-slate-800/50 text-center pb-4">
          <p className="text-slate-500 text-sm font-medium">
            Desenvolvido por <a href="https://github.com/ricardomdn" target="_blank" rel="noreferrer" className="text-orange-500 hover:text-orange-400 transition-colors hover:underline">Ricardão</a>
          </p>
        </footer>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthGate>
      <AppContent />
    </AuthGate>
  );
};

export default App;