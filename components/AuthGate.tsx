import React, { useState, useEffect } from 'react';

interface AuthGateProps {
  children: React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // A senha correta deve ser definida nas variáveis de ambiente (VITE_ACCESS_CODE)
  // Fallback para 'gatos123' caso não esteja configurada
  const CORRECT_PASSWORD = (import.meta as any).env?.VITE_ACCESS_CODE || 'gatos123';

  useEffect(() => {
    const session = localStorage.getItem('gatos_auth_session');
    if (session === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      localStorage.setItem('gatos_auth_session', 'true');
      setIsAuthenticated(true);
    } else {
      setError('Senha incorreta. Tente novamente.');
      setPassword('');
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
        <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-500/10 text-4xl">
          🔒
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">Acesso Restrito</h1>
        <p className="text-slate-400 mb-8">Esta ferramenta é privada. Por favor, insira o código de acesso.</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Código de acesso"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-center tracking-widest"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm animate-pulse">{error}</p>
          )}

          <button
            type="submit"
            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl transition-all active:scale-95 shadow-lg shadow-orange-900/20"
          >
            Entrar
          </button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-slate-800">
           <p className="text-xs text-slate-600 font-mono">Gatos AI Studio • Private Edition</p>
        </div>
      </div>
    </div>
  );
};