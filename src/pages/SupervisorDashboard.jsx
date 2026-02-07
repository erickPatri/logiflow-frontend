import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import FleetMap from '../components/FleetMap';
import { io } from 'socket.io-client';

export default function SupervisorDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);

  // --- VARIABLES DE ENTORNO ---
  const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL; // Puerto 8085
  const WS_URL = import.meta.env.VITE_WS_URL;           // Puerto 3001

  useEffect(() => {
    fetchOrders();

    // 1. CONEXIÓN WEBSOCKET
    console.log("Conectando Supervisor a WebSocket:", WS_URL);
    const socket = io(WS_URL);

    socket.on('connect', () => {
      console.log("WebSocket Conectado ID:", socket.id);
    });

    socket.on('orders_update', (updatedOrder) => {
      console.log("Actualización en tiempo real recibida:", updatedOrder);
      setOrders(prevOrders => {
        const exists = prevOrders.find(o => o.id === updatedOrder.id);
        if (exists) {
          return prevOrders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
        } else {
          return [updatedOrder, ...prevOrders];
        }
      });
    });

    return () => socket.disconnect();
  }, []);

  // --- OBTENER DATOS VÍA GRAPHQL ---
  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const graphqlQuery = {
        query: `
          query {
            orders {
              id
              description
              deliveryLocation
              status
              latitude
              longitude
              vehicle {
                id
                brand
                model
                plate
                driver {
                  id
                  status
                }
              }
            }
          }
        `
      };

      // PETICIÓN POST A GRAPHQL
      const response = await axios.post(GRAPHQL_URL, graphqlQuery, {
        headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
      });

      // AJUSTE: GraphQL devuelve la data en response.data.data
      const ordersFromGraphql = response.data?.data?.orders;
      
      if (ordersFromGraphql) {
        setOrders([...ordersFromGraphql].reverse());
        console.log("Pedidos cargados vía GraphQL:", ordersFromGraphql);
      }

    } catch (error) {
      console.error("Error cargando pedidos con GraphQL:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/');
  };

  const getStatusColor = (status) => {
      switch (status) {
          case 'ENTREGADO': return 'bg-green-500/10 text-green-400 border-green-500/20';
          case 'ASIGNADO': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'; 
          case 'EN_RUTA': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
          case 'PENDIENTE': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
          case 'CANCELADO': return 'bg-red-500/10 text-red-400 border-red-500/20';
          default: return 'bg-gray-500/10 text-gray-400';
      }
  };

  const exportToCSV = () => {
    const headers = ["ID,Descripción,Destino,Estado,Vehículo,Latitud,Longitud"];
    const rows = orders.map(order => {
      const vehicleInfo = order.vehicle 
        ? `${order.vehicle.brand} ${order.vehicle.model} (${order.vehicle.plate})` 
        : "Sin Asignar";

      return [
        order.id,
        `"${order.description || ''}"`,
        `"${order.deliveryLocation || ''}"`,
        order.status,
        `"${vehicleInfo}"`,
        order.latitude || '',
        order.longitude || ''
      ].join(","); 
    });

    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const localDate = new Date().toLocaleDateString('en-CA');
    link.setAttribute("download", `reporte_pedidos_${localDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="dark bg-[#111822] text-white h-screen overflow-hidden flex font-display antialiased">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#192433] border-r border-[#233348] flex flex-col justify-between shrink-0 h-full z-20">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-blue-600/20 flex items-center justify-center rounded-lg size-10 text-blue-500 shadow-lg shadow-blue-500/10">
              <span className="material-symbols-outlined text-2xl">local_shipping</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-white text-lg font-bold leading-tight">LogiFlow</h1>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Supervisor</p>
            </div>
          </div>
           <nav className="flex flex-col gap-2">
            <button className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 transition-all">
              <span className="material-symbols-outlined text-[20px]">dashboard</span> 
              <span className="text-sm font-semibold">Tablero de Control</span>
            </button>
          </nav>
        </div>
        <div className="p-6 border-t border-[#233348]">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all group">
            <span className="material-symbols-outlined text-[20px] group-hover:rotate-12 transition-transform">logout</span> 
            <span className="text-sm font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-16 border-b border-[#233348] bg-[#192433]/50 backdrop-blur-md flex items-center justify-between px-8 shrink-0 z-10">
          <h2 className="text-white text-lg font-bold tracking-tight">Centro de Monitoreo</h2>
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-[10px] font-black text-green-400 tracking-widest uppercase">Sistema en Vivo</span>
             </div>
             <div className="h-8 w-px bg-[#233348]"></div>
             <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-white uppercase tracking-tighter">Admin</span>
                <div className="size-8 rounded-full bg-slate-700 border border-[#233348] flex items-center justify-center text-xs font-bold">AD</div>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-[1600px] mx-auto h-full flex flex-col gap-8">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
               <div className="bg-[#192433] border border-[#233348] rounded-2xl p-6 shadow-xl">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Total Pedidos</p>
                  <h3 className="text-4xl font-black text-white">{orders.length}</h3>
               </div>
               <div className="bg-[#192433] border border-[#233348] rounded-2xl p-6 shadow-xl border-l-4 border-l-green-500">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Entregados</p>
                  <h3 className="text-4xl font-black text-green-400">{orders.filter(o => o.status === 'ENTREGADO').length}</h3>
               </div>
               <div className="bg-[#192433] border border-[#233348] rounded-2xl p-6 shadow-xl border-l-4 border-l-blue-500">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">En Curso</p>
                  <h3 className="text-4xl font-black text-blue-400">{orders.filter(o => o.status === 'ASIGNADO' || o.status === 'EN_RUTA').length}</h3>
               </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 flex-1 min-h-[600px] mb-8">
              
              {/* TABLA */}
              <div className="w-full lg:w-5/12 flex flex-col bg-[#192433] border border-[#233348] rounded-2xl overflow-hidden shadow-2xl">
                <div className="px-6 py-5 border-b border-[#233348] flex justify-between items-center bg-[#1c293a]">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-400">list_alt</span>
                    Actividad Reciente
                  </h3>
                  <button 
                    onClick={exportToCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-[10px] font-black uppercase rounded-xl transition-all border border-green-400/20 shadow-lg shadow-green-900/20 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    Exportar
                  </button>
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#111822] sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">ID</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Destino</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#233348]">
                      {orders.length === 0 ? (
                        <tr><td colSpan="3" className="px-6 py-10 text-center text-slate-500 text-sm italic">Esperando datos...</td></tr>
                      ) : (
                        orders.map(order => (
                          <tr key={order.id} className="hover:bg-[#202b3a] transition-colors">
                            <td className="px-6 py-4 text-xs font-bold text-blue-400">#LOG-{order.id}</td>
                            <td className="px-6 py-4 text-xs text-slate-300 truncate max-w-[180px] font-medium">{order.deliveryLocation}</td>
                            <td className="px-6 py-4 text-right">
                              <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border tracking-tighter ${getStatusColor(order.status)}`}>
                                {order.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MAPA */}
              <div className="w-full lg:w-7/12 flex flex-col bg-[#192433] border border-[#233348] rounded-2xl overflow-hidden shadow-2xl relative">
                 <FleetMap orders={orders} />
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}