import React, { useState } from 'react';
import { Lock, User, ShieldAlert, Shield, ArrowRight } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error('Credenciales inválidas');
      }

      const data = await response.json();
      localStorage.setItem('sgac_token', data.access_token);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full -mr-64 -mt-64"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full -ml-64 -mb-64"></div>

      <div className="w-full max-w-lg relative z-10 animate-slide-in">
        <div className="bg-slate-900/50 backdrop-blur-2xl rounded-[40px] shadow-2xl border border-white/5 overflow-hidden">
          <div className="p-12 text-center border-b border-white/5">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-emerald-500 shadow-2xl shadow-emerald-500/20 mb-8 rotate-12 hover:rotate-0 transition-transform duration-500">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter italic mb-2">IOT <span className="text-emerald-400">SYSTEM</span></h1>
            <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px]">Secure Intelligent Management</p>
          </div>
          
          <div className="p-12 space-y-8">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-bold tracking-tight">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Identificación</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    required
                    className="w-full bg-white/5 border border-white/5 text-white pl-14 pr-6 py-5 rounded-3xl outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all font-bold placeholder:text-slate-600"
                    placeholder="Usuario ID"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Clave de Acceso</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                  </div>
                  <input
                    type="password"
                    required
                    className="w-full bg-white/5 border border-white/5 text-white pl-14 pr-6 py-5 rounded-3xl outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all font-bold placeholder:text-slate-600"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 py-5 rounded-3xl font-black text-lg transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 disabled:opacity-50 mt-10"
              >
                {loading ? 'AUTENTICANDO...' : (
                  <>
                    ENTRAR AL SISTEMA <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
            
            <div className="text-center pt-4">
              <div className="inline-block p-4 rounded-3xl bg-white/5 border border-white/5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Acceso Demo</p>
                <div className="flex gap-4 text-xs font-bold text-slate-400">
                  <span>CHEF: admin/admin</span>
                  <div className="w-1 h-1 rounded-full bg-slate-700 self-center"></div>
                  <span>COOK: cook/cook</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <p className="text-center mt-10 text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">
          &copy; 2026 SGAC Intelligent Systems Engineering
        </p>
      </div>
    </div>
  );
}
