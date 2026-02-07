import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { io } from 'socket.io-client';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// COMPONENTES DEL MAPA 
function ResizeMap() {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => { map.invalidateSize(); }, 100); 
        return () => clearTimeout(timer);
    }, [map]);
    return null;
}

function LocationMarker({ onLocationSelect, initialPos }) {
    const [position, setPosition] = useState(initialPos || [-0.1807, -78.4678]);
    useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
            onLocationSelect(e.latlng.lat, e.latlng.lng);
        },
    });
    return <Marker position={position} />;
}

function MapPicker({ onLocationSelect }) {
    const centerPos = [-0.1807, -78.4678]; 
    return (
        <div className="w-full h-full bg-slate-900">
            <MapContainer center={centerPos} zoom={13} style={{ height: '100%', width: '100%' }}>
                <ResizeMap />
                <TileLayer attribution='© OSM' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <LocationMarker onLocationSelect={onLocationSelect} initialPos={centerPos} />
            </MapContainer>
        </div>
    );
}

export default function ClientDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [clientId, setClientId] = useState(null); // ✨ NUEVO: guardar clientId
  const [showMapModal, setShowMapModal] = useState(false);
  const [activeField, setActiveField] = useState(null); 
  const [userInfo, setUserInfo] = useState({ name: 'Cargando...', role: '...' });

  const [coords, setCoords] = useState({
    pickup: { lat: null, lon: null },
    delivery: { lat: null, lon: null }
  });

  const [formData, setFormData] = useState({
    description: '',
    pickupLocation: '',
    deliveryLocation: ''
  });

  // --- VARIABLES DE ENTORNO ---
  const API_URL = import.meta.env.VITE_API_URL; // http://127.0.0.1:8083
  const WS_URL = import.meta.env.VITE_WS_URL;   // http://127.0.0.1:3001

  useEffect(() => {
    loadUserData();

    // CONEXIÓN WEBSOCKET
    const socket = io(WS_URL);
    socket.on('orders_update', (updatedOrder) => {
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

  // ✨ NUEVO: Cuando clientId esté disponible, cargar los pedidos
  useEffect(() => {
    if (clientId) {
      fetchMyOrders();
    }
  }, [clientId]);

  const loadUserData = () => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const realName = payload.sub || 'Usuario';
            const cleanRole = role ? role.replace('ROLE_', '') : 'CLIENTE';
            setUserInfo({ name: realName, role: cleanRole });
            
            // ✨ NUEVO: Extraer clientId del token (podría ser userId, id o sub)
            const cId = payload.userId || payload.id || payload.sub;
            if (cId) {
              setClientId(cId);
              console.log("✨ Client ID extraído del token:", cId);
            }
        } catch (error) {
            console.error("Error leyendo usuario del token", error);
        }
    }
  };

  const fetchMyOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // ✨ Si tenemos clientId, usa el endpoint de cliente específico
      if (clientId) {
        const response = await axios.get(`${API_URL}/orders/client/${clientId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log("✨ Pedidos del cliente obtenidos:", response.data);
        setOrders(response.data.reverse());
      } else {
        // Fallback: obtener todos y esperar a que clientId se establezca
        console.warn("ClientId no disponible, esperando...");
      }
    } catch (error) {
      console.error("Error cargando mis pedidos:", error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const openMapFor = (field) => {
    setActiveField(field);
    setShowMapModal(true);
  };

  const handleMapSelection = async (lat, lon) => {
    setCoords(prev => ({ ...prev, [activeField]: { lat, lon } }));
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
        const response = await axios.get(url);
        if (response.data && response.data.display_name) {
             const shortAddress = response.data.display_name.split(',').slice(0, 3).join(',');
             setFormData(prev => ({
                 ...prev, [activeField === 'pickup' ? 'pickupLocation' : 'deliveryLocation']: shortAddress
             }));
        }
    } catch (error) {
        setFormData(prev => ({
            ...prev, [activeField === 'pickup' ? 'pickupLocation' : 'deliveryLocation']: `${lat.toFixed(4)}, ${lon.toFixed(4)}`
        }));
    }
  };

  const confirmSelection = () => setShowMapModal(false); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      let finalLat = coords.delivery.lat || -0.1807; 
      let finalLon = coords.delivery.lon || -78.4678;

      const newOrder = {
        clientId: 1, 
        description: formData.description,
        pickupLocation: formData.pickupLocation,
        deliveryLocation: formData.deliveryLocation,
        latitude: finalLat,   
        longitude: finalLon   
      };

      // CAMBIO: Se eliminó /api/ para que coincida con el POST de tu Java
      await axios.post(`${API_URL}/orders`, newOrder, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert('¡Solicitud enviada con éxito! 📦');
      setFormData({ description: '', pickupLocation: '', deliveryLocation: '' });
      setCoords({ pickup: { lat: null, lon: null }, delivery: { lat: null, lon: null } });
      fetchMyOrders();
    } catch (error) {
      alert('Error al crear el pedido.');
      console.error(error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ENTREGADO': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'PENDIENTE': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'CANCELADO': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  return (
    <div className="bg-[#111822] text-white font-display overflow-hidden h-screen flex antialiased relative">
      {/* --- MODAL DEL MAPA --- */}
      {showMapModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#192433] border border-[#233348] w-full max-w-2xl h-[500px] rounded-xl flex flex-col overflow-hidden shadow-2xl">
                <div className="p-4 bg-[#192433] border-b border-[#233348] flex justify-between items-center">
                    <h3 className="font-bold text-white">Selecciona ubicación</h3>
                    <button onClick={() => setShowMapModal(false)} className="text-gray-400 hover:text-white"><span className="material-symbols-outlined">close</span></button>
                </div>
                <div className="flex-1 relative bg-slate-800">
                    <MapPicker onLocationSelect={handleMapSelection} />
                </div>
                <div className="p-4 bg-[#192433] border-t border-[#233348] flex justify-end">
                    <button onClick={confirmSelection} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium transition-colors">Confirmar Ubicación</button>
                </div>
            </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 h-full flex flex-col border-r border-[#233348] bg-[#111822] shrink-0 z-20">
         <div className="p-6 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <span className="material-symbols-outlined text-2xl">local_shipping</span>
            </div>
            <div>
                <h1 className="text-xl font-bold tracking-tight text-white leading-none">LogiFlow</h1>
                <p className="text-xs text-slate-400 mt-1">Platform v2.0</p>
            </div>
        </div>
        <nav className="flex-1 px-4 py-4 flex flex-col gap-2">
            <button className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-600 text-white w-full text-left">
                <span className="material-symbols-outlined">add_circle</span> <span className="text-sm font-medium">Nuevo Envío</span>
            </button>
        </nav>
        <div className="p-4 border-t border-[#233348]">
            <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-slate-400 hover:text-red-400 hover:bg-[#192433] transition-colors">
                <span className="material-symbols-outlined">logout</span> <span className="text-sm font-medium">Cerrar Sesión</span>
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-16 border-b border-[#233348] bg-[#111822] flex items-center justify-between px-6 shrink-0">
          <h2 className="text-lg font-bold text-white tracking-tight">Portal de Cliente</h2>
          <div className="flex items-center gap-3 pl-6 border-l border-[#233348]">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white">{userInfo.name}</p>
                <p className="text-xs text-slate-400 uppercase">{userInfo.role}</p>
              </div>
              <div className="size-9 rounded-full bg-gray-700 border border-[#233348] flex items-center justify-center text-xs font-bold uppercase">
                  {userInfo.name.substring(0, 2)}
              </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-10 bg-[#111822]">
          <div className="max-w-7xl mx-auto space-y-8">
            <div>
              <h3 className="text-2xl font-bold text-white mb-1">Hola, {userInfo.name} 👋</h3>
              <p className="text-slate-400">Gestiona tus envíos y realiza nuevas solicitudes.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-[#192433] rounded-xl shadow-xl border border-[#233348] overflow-hidden flex flex-col h-fit">
                <div className="p-6 border-b border-[#233348] bg-[#192433]">
                   <h4 className="text-xl font-bold text-white">Solicitar Transporte</h4>
                </div>
                <div className="p-6 lg:p-8 space-y-6 flex-1">
                  <form onSubmit={handleSubmit}>
                      <div className="space-y-2 mb-6">
                        <label className="text-sm font-medium text-slate-300">Descripción de la carga</label>
                        <textarea name="description" value={formData.description} onChange={handleInputChange} required className="w-full bg-[#202B3A] border border-[#374151] rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-24" placeholder="Ej. 2 Palets de componentes electrónicos..."></textarea>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-300">Punto de recogida</label>
                          <div className="flex gap-2">
                              <input type="text" name="pickupLocation" value={formData.pickupLocation} onChange={handleInputChange} className="w-full bg-[#202B3A] border border-[#374151] rounded-lg px-3 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Selecciona en el mapa ->" />
                              <button type="button" onClick={() => openMapFor('pickup')} className="bg-[#233348] hover:bg-[#334b6b] text-white p-3 rounded-lg transition-colors"><span className="material-symbols-outlined">map</span></button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-300">Punto de destino</label>
                          <div className="flex gap-2">
                              <input type="text" name="deliveryLocation" value={formData.deliveryLocation} onChange={handleInputChange} className="w-full bg-[#202B3A] border border-[#374151] rounded-lg px-3 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Selecciona en el mapa ->" />
                              <button type="button" onClick={() => openMapFor('delivery')} className="bg-[#233348] hover:bg-[#334b6b] text-white p-3 rounded-lg transition-colors"><span className="material-symbols-outlined">map</span></button>
                          </div>
                        </div>
                      </div>
                      <div className="p-6 -mx-6 -mb-8 border-t border-[#233348] bg-[#192433]">
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-lg shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"><span>Confirmar Solicitud</span><span className="material-symbols-outlined">arrow_forward</span></button>
                      </div>
                  </form>
                </div>
              </div>

              <div className="lg:col-span-1 flex flex-col gap-6">
                <div className="bg-[#192433] rounded-xl shadow-xl border border-[#233348] p-6 flex flex-col h-full">
                  <h4 className="text-lg font-bold text-white mb-6">Envíos Recientes</h4>
                  <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                    {orders.length === 0 ? <p className="text-slate-500 text-center">Sin envíos</p> : orders.map((order) => (
                        <div key={order.id} className="p-4 rounded-lg bg-[#202B3A] border border-[#233348] flex flex-col gap-2">
                            <div className="flex justify-between">
                                <span className="text-sm font-mono text-white">#LOG-{order.id}</span>
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${getStatusColor(order.status)}`}>{order.status}</span>
                            </div>
                            <p className="text-xs text-slate-400 truncate">{order.deliveryLocation}</p>
                        </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}