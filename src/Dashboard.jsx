import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts';
import { 
  Thermometer, Package, Bell, RefreshCw, ChefHat, LogOut, TrendingUp, AlertTriangle, CheckCircle, Activity, LayoutDashboard, Utensils, History, Shield, Menu
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8000/ws';

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState(user.role === 'chef' ? 'overview' : 'kitchen');
  const [temperature, setTemperature] = useState(4.2);
  const [inventory, setInventory] = useState([]);
  const [tempHistory, setTempHistory] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [activeRecipe, setActiveRecipe] = useState(null);
  const [recipeStatus, setRecipeStatus] = useState('idle');
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [production, setProduction] = useState([]);
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'Core System Online', type: 'info', time: new Date().toLocaleTimeString() }
  ]);

  useEffect(() => {
    fetchInventory();
    fetchAnalytics();
    fetchProduction();

    const ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'iot_update') {
        const { temperatura, peso_kg, device_id } = msg.data;
        if (temperatura !== undefined) {
          setTemperature(temperatura);
          setTempHistory(prev => {
            const newHistory = [...prev, { time: new Date().toLocaleTimeString().slice(0,5), temp: temperatura }];
            return newHistory.slice(-12);
          });
          if (temperatura > 8.0) addNotification('Critical Temp Alert: Cold Chain compromised', 'error');
        }
        if (peso_kg !== undefined) {
          updateLocalInventory(device_id, peso_kg);
        }
      }
    };
    return () => ws.close();
  }, []);

  const updateLocalInventory = (device_id, peso_kg) => {
    const insumoMap = {
      "b_carne": "carne", "b_pan": "pan", "b_queso": "queso",
      "b_lechuga": "lechuga", "b_pollo": "pollo", "b_aderezo": "aderezo",
      "b_cerdo": "cerdo", "b_tortilla": "tortilla", "b_pina": "pina"
    };
    const insumoName = insumoMap[device_id] || device_id;
    setInventory(prev => prev.map(item => {
      if (item.insumo === insumoName) {
        if (peso_kg < item.umbral_minimo && item.cantidad_kg >= item.umbral_minimo) {
          addNotification(`Low Stock: ${insumoName} requiring restock`, 'warning');
        }
        return { ...item, cantidad_kg: peso_kg, status: peso_kg < item.umbral_minimo ? 'low' : 'ok' };
      }
      return item;
    }));
  };

  const fetchInventory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/dashboard/inventory`);
      const data = await res.json();
      setInventory(data.inventory.map(item => ({
        ...item,
        status: item.cantidad_kg < item.umbral_minimo ? 'low' : 'ok'
      })));
    } catch (err) { console.error(err); }
  };

  const fetchProduction = async () => {
    try {
      const res = await fetch(`${API_URL}/api/dashboard/production`);
      const data = await res.json();
      setProduction(data.production);
    } catch (err) {
      console.error("Error fetching production", err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${API_URL}/api/dashboard/analytics`);
      const data = await res.json();
      setAnalytics(data);
      setTempHistory([
        { time: '08:00', temp: 4.1 }, { time: '09:00', temp: 4.3 }, { time: '10:00', temp: 4.2 }, 
        { time: '11:00', temp: 4.5 }, { time: '12:00', temp: 4.4 }, { time: '13:00', temp: 4.2 }
      ]);
    } catch (err) { console.error(err); }
  };

  const addNotification = (text, type) => {
    setNotifications(prev => [{ id: Date.now(), text, type, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 20));
  };

  const handleRequestRecipe = async () => {
    setRecipeLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/cook/request_recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cocinero_id: user.username })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setActiveRecipe(data.recipe);
        setRecipeStatus('assigned');
        addNotification(`New Assignment: ${data.recipe.nombre}`, 'info');
      } else {
        addNotification(`Request Failed: ${data.message}`, 'error');
      }
    } catch (err) { addNotification('Core AI Engine Unreachable', 'error'); }
    finally { setRecipeLoading(false); }
  };

  const handleFinishRecipe = async () => {
    if (!activeRecipe) return;
    try {
      const res = await fetch(`${API_URL}/api/cook/finish_recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cocinero_id: user.username, receta_id: activeRecipe.id_receta })
      });
      const data = await res.json();
      if (data.status === 'success') {
        addNotification(`Order Finalized: ${activeRecipe.nombre}`, 'success');
        setActiveRecipe(null);
        setRecipeStatus('idle');
        fetchInventory();
        fetchProduction();
      }
    } catch (err) { addNotification('Failed to commit production', 'error'); }
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans">
      {/* Sidebar Premium */}
      <aside className="w-64 sidebar-gradient text-white flex flex-col shadow-2xl z-20">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10 group">
            <div className="p-2.5 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/20 group-hover:rotate-12 transition-transform">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-black tracking-tighter">IOT <span className="text-emerald-400">SYSTEM</span></h1>
          </div>

          <nav className="space-y-1">
            {user.role === 'chef' ? (
              <>
                <SidebarLink active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<LayoutDashboard />} label="Dashboard" />
                <SidebarLink active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package />} label="Inventario" />
                <SidebarLink active={activeTab === 'production'} onClick={() => setActiveTab('production')} icon={<History />} label="Producción" />
              </>
            ) : (
              <SidebarLink active={activeTab === 'kitchen'} onClick={() => setActiveTab('kitchen')} icon={<Utensils />} label="Centro de Cocina" />
            )}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center font-bold shadow-lg shadow-emerald-500/20">
              {user.username[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{user.username}</p>
              <p className="text-xs text-emerald-400 capitalize opacity-80">{user.role}</p>
            </div>
          </div>
          <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all text-sm font-bold border border-red-500/20">
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header Superior */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <Menu className="w-6 h-6 text-slate-400 lg:hidden" />
            <h2 className="text-xl font-extrabold text-slate-800 capitalize tracking-tight">
              {activeTab === 'overview' ? 'Sistema Central de Gestión' : activeTab === 'kitchen' ? 'Estación de Producción' : activeTab}
            </h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Live System</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
          <div className="max-w-7xl mx-auto space-y-8 animate-slide-in">
            
            {/* VISTA: OVERVIEW (CHEF) */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Top Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <MetricCard 
                    label="Temperatura Cámara" 
                    value={`${temperature.toFixed(1)}°C`} 
                    icon={<Thermometer />} 
                    color={temperature > 8 ? 'red' : 'emerald'}
                    trend="Estable"
                  />
                  <MetricCard 
                    label="Eficiencia de Stock" 
                    value="94%" 
                    icon={<TrendingUp />} 
                    color="blue"
                    trend="+2.4%"
                  />
                  <MetricCard 
                    label="Producción Hoy" 
                    value="128" 
                    icon={<Utensils />} 
                    color="purple"
                    trend="En progreso"
                  />
                  <MetricCard 
                    label="Alertas Activas" 
                    value={inventory.filter(i => i.status === 'low').length} 
                    icon={<AlertTriangle />} 
                    color="amber"
                    trend="Requiere Acción"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Gráfica de Temperatura Principal */}
                  <div className="lg:col-span-2 bg-white rounded-3xl p-8 premium-shadow border border-slate-100">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight">Análisis de Frío</h3>
                        <p className="text-sm text-slate-400">Historial de las últimas 12 horas</p>
                      </div>
                      <div className="flex gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                        <span className="w-3 h-3 rounded-full bg-slate-200"></span>
                      </div>
                    </div>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={tempHistory}>
                          <defs>
                            <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#94a3b8'}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#94a3b8'}} domain={[0, 10]} />
                          <RechartsTooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="temp" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTemp)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Registro de Eventos Lateral */}
                  <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-2xl flex flex-col border border-slate-800">
                    <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                      <h3 className="font-bold flex items-center gap-2"><Bell className="w-4 h-4 text-emerald-400" /> Registro Live</h3>
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                      {notifications.map(n => (
                        <div key={n.id} className="p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                          <div className="flex justify-between items-start mb-1">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${n.type === 'error' ? 'text-red-400' : n.type === 'warning' ? 'text-amber-400' : 'text-emerald-400'}`}>
                              {n.type}
                            </span>
                            <span className="text-[10px] text-slate-500">{n.time}</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed group-hover:text-white transition-colors">{n.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Consumo por Producto */}
                <div className="bg-white rounded-3xl p-8 premium-shadow border border-slate-100">
                  <h3 className="text-lg font-black text-slate-800 mb-6 tracking-tight">Proyección de Consumo Semanal</h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics?.consumo_diario || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="dia" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#94a3b8'}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#94a3b8'}} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Bar dataKey="carne" fill="#6366f1" radius={[10, 10, 10, 10]} barSize={12} />
                        <Bar dataKey="pollo" fill="#10b981" radius={[10, 10, 10, 10]} barSize={12} />
                        <Bar dataKey="cerdo" fill="#f59e0b" radius={[10, 10, 10, 10]} barSize={12} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* VISTA: INVENTARIO (CHEF) */}
            {activeTab === 'inventory' && (
              <div className="bg-white rounded-3xl p-8 premium-shadow border border-slate-100">
                <div className="flex justify-between items-center mb-10">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">Control de Insumos</h3>
                    <p className="text-slate-400">Estado en tiempo real de básculas HX711</p>
                  </div>
                  <button onClick={fetchInventory} className="p-3 bg-slate-100 rounded-2xl text-slate-600 hover:bg-slate-200 transition-colors shadow-sm">
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {inventory.map((item, i) => (
                    <InventoryItem key={i} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* VISTA: PRODUCCIÓN (CHEF) */}
            {activeTab === 'production' && (
              <div className="bg-white rounded-3xl p-8 premium-shadow border border-slate-100 animate-slide-in">
                <div className="flex justify-between items-center mb-10">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight italic">Historial de Producción</h3>
                    <p className="text-slate-400">Registro detallado de tareas completadas</p>
                  </div>
                  <button onClick={fetchProduction} className="p-3 bg-slate-100 rounded-2xl text-slate-600 hover:bg-slate-200 transition-colors">
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Receta</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cocinero</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha / Hora</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {production.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="py-20 text-center text-slate-400 italic font-medium">No se han registrado producciones el día de hoy.</td>
                        </tr>
                      ) : (
                        production.map((p, i) => (
                          <tr key={i} className="group hover:bg-slate-50/50 transition-colors">
                            <td className="py-5 font-bold text-slate-800 italic text-lg">{p.nombre_receta}</td>
                            <td className="py-5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-black shadow-lg shadow-emerald-500/20">
                                  {p.cocinero_id[0].toUpperCase()}
                                </div>
                                <span className="text-slate-600 font-bold tracking-tight">{p.cocinero_id}</span>
                              </div>
                            </td>
                            <td className="py-5 text-slate-400 text-xs font-bold font-mono">
                              {new Date(p.timestamp).toLocaleString()}
                            </td>
                            <td className="py-5 text-right">
                              <span className="bg-emerald-500 text-white text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20">
                                Finalizado
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VISTA: KITCHEN (COCINERO) */}
            {activeTab === 'kitchen' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <div className="bg-slate-900 rounded-[40px] p-12 text-white shadow-2xl relative overflow-hidden border border-slate-800">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full"></div>
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full"></div>

                  <div className="relative z-10">
                    {!activeRecipe ? (
                      <div className="text-center py-12">
                        <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/10 shadow-inner">
                          <ChefHat className="w-12 h-12 text-emerald-400" />
                        </div>
                        <h3 className="text-4xl font-black mb-4 tracking-tighter italic">¿Listo para comenzar?</h3>
                        <p className="text-slate-400 text-lg mb-12 max-w-md mx-auto leading-relaxed">El motor de inteligencia artificial (Prolog) seleccionará la mejor receta basada en caducidad y disponibilidad.</p>
                        <button 
                          onClick={handleRequestRecipe}
                          disabled={recipeLoading}
                          className="px-12 py-5 bg-emerald-500 hover:bg-emerald-400 text-slate-900 rounded-3xl font-black text-xl transition-all shadow-xl shadow-emerald-500/40 hover:scale-105 active:scale-95 disabled:opacity-50"
                        >
                          {recipeLoading ? 'Analizando Inventario...' : 'SOLICITAR TAREA'}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-10 animate-fade-in-down">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/10 pb-10">
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Orden Activa</span>
                            </div>
                            <h3 className="text-6xl font-black tracking-tighter leading-tight italic">{activeRecipe.nombre}</h3>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-500 font-bold mb-1">CÓDIGO DE RECETA</p>
                            <p className="text-3xl font-black tracking-tight text-white/40">#{activeRecipe.id_receta.toUpperCase()}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                          <div className="space-y-6">
                            <h4 className="text-lg font-black text-white italic border-l-4 border-emerald-500 pl-4 uppercase tracking-widest">Ingredientes</h4>
                            <div className="space-y-3">
                              {Object.entries(activeRecipe.ingredientes).map(([ing, qty]) => (
                                <div key={ing} className="flex justify-between items-center p-5 rounded-3xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-colors">
                                  <span className="capitalize font-bold text-slate-300 group-hover:text-white">{ing}</span>
                                  <span className="text-emerald-400 font-black text-lg">{(qty * 1000).toFixed(0)}g</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-col justify-end space-y-6">
                            <div className="p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/20 mb-4">
                              <p className="text-sm text-emerald-400/80 leading-relaxed font-medium italic">
                                "La IA ha priorizado esta receta para optimizar el inventario cercano a caducar."
                              </p>
                            </div>
                            
                            {recipeStatus === 'assigned' ? (
                              <button 
                                onClick={() => setRecipeStatus('ready')}
                                className="w-full py-6 bg-white text-slate-900 rounded-[30px] font-black text-2xl transition-all hover:bg-emerald-50 shadow-xl"
                              >
                                COMENZAR PREPARACIÓN
                              </button>
                            ) : (
                              <button 
                                onClick={handleFinishRecipe}
                                className="w-full py-6 bg-emerald-500 text-slate-900 rounded-[30px] font-black text-2xl transition-all hover:bg-emerald-400 shadow-xl shadow-emerald-500/30"
                              >
                                MARCAR COMO FINALIZADO
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Status de Sensores Inferior */}
                <div className="grid grid-cols-3 gap-6">
                  <SensorMiniCard label="Sensor Temperatura" value={`${temperature.toFixed(1)}°C`} active />
                  <SensorMiniCard label="Básculas Digitales" value="Conectado" active />
                  <SensorMiniCard label="Estado IA" value="Latencia 12ms" active />
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}

// COMPONENTES AUXILIARES PARA EL DISEÑO PROFESIONAL

function SidebarLink({ icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 font-bold text-sm group ${active ? 'bg-white/10 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
    >
      <div className={`transition-transform group-hover:scale-110 ${active ? 'text-emerald-400' : 'text-slate-500'}`}>
        {React.cloneElement(icon, { size: 20, strokeWidth: 2.5 })}
      </div>
      <span className="tracking-tight">{label}</span>
      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981]"></div>}
    </button>
  );
}

function MetricCard({ label, value, icon, color, trend }) {
  const colors = {
    red: 'bg-red-500',
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500'
  };
  const bgColors = {
    red: 'bg-red-50',
    emerald: 'bg-emerald-50',
    blue: 'bg-blue-50',
    purple: 'bg-purple-50',
    amber: 'bg-amber-50'
  };
  const textColors = {
    red: 'text-red-600',
    emerald: 'text-emerald-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    amber: 'text-amber-600'
  };

  return (
    <div className="bg-white p-6 rounded-3xl premium-shadow border border-slate-100 group hover:-translate-y-1 transition-all duration-300">
      <div className="flex justify-between items-start mb-6">
        <div className={`p-3.5 rounded-2xl ${bgColors[color]} ${textColors[color]} transition-colors`}>
          {React.cloneElement(icon, { size: 24, strokeWidth: 2.5 })}
        </div>
        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${bgColors[color]} ${textColors[color]}`}>
          {trend}
        </span>
      </div>
      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-black text-slate-800 tracking-tighter italic">{value}</p>
    </div>
  );
}

function InventoryItem({ item }) {
  const isLow = item.status === 'low';
  return (
    <div className={`p-6 rounded-3xl border transition-all duration-300 group ${isLow ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5'}`}>
      <div className="flex justify-between items-center mb-6">
        <h4 className="font-black text-slate-800 capitalize tracking-tight italic text-lg">{item.insumo}</h4>
        {isLow && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20">
            <AlertTriangle size={10} /> Reordenar
          </div>
        )}
      </div>
      
      <div className="flex items-baseline gap-2 mb-6">
        <span className="text-4xl font-black text-slate-800 tracking-tighter italic">{Number(item.cantidad_kg).toFixed(2)}</span>
        <span className="text-slate-400 font-bold text-sm uppercase">kg</span>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <span>Capacidad</span>
          <span className={isLow ? 'text-amber-600' : 'text-slate-600'}>{Math.round((item.cantidad_kg / 10) * 100)}%</span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-700 ease-out rounded-full ${isLow ? 'bg-amber-500' : 'bg-emerald-500 shadow-[0_0_10px_#10b981]'}`}
            style={{ width: `${Math.min(100, (item.cantidad_kg / 10) * 100)}%` }}
          />
        </div>
        <div className="flex justify-between items-center pt-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
            Caducidad: <span className="text-slate-800 font-black tracking-normal ml-1">{item.dias_caducidad} días</span>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]"></div>
        </div>
      </div>
    </div>
  );
}

function SensorMiniCard({ label, value, active }) {
  return (
    <div className="bg-slate-900/50 backdrop-blur-md border border-white/5 p-6 rounded-3xl flex items-center justify-between">
      <div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-xl font-black text-white italic">{value}</p>
      </div>
      {active && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_15px_#10b981] animate-pulse"></div>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 outline-none">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-lg font-black italic text-emerald-400">{payload[0].value.toFixed(2)}</p>
      </div>
    );
  }
  return null;
}
