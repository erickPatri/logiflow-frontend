import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { io } from 'socket.io-client';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// --- CONFIGURACIÓN DE LEAFLET ---
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function ResizeMap() {
    const map = useMap();
    useEffect(() => { setTimeout(() => { map.invalidateSize(); }, 200); }, [map]);
    return null;
}

// --- COMPONENTE DEL MAPA ---
function DriverRouteMap({ orders, activeOrder, myLocation }) {
    const center = myLocation || [-0.1807, -78.4678];
    return (
        <div className="w-full h-full bg-slate-900">
            <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
                <ResizeMap />
                <TileLayer attribution='© OSM' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                {myLocation && <Marker position={myLocation}><Popup>📍 Tú</Popup></Marker>}
                {activeOrder && <Marker position={[activeOrder.latitude, activeOrder.longitude]}><Popup>🚚 DESTINO: {activeOrder.deliveryLocation}</Popup></Marker>}
            </MapContainer>
        </div>
    );
}

// --- DASHBOARD PRINCIPAL ---
export default function DriverDashboard() {
  const navigate = useNavigate();
  
  // ESTADOS
  const [orders, setOrders] = useState([]);
  const [userInfo, setUserInfo] = useState({ name: 'Conductor', role: 'Driver' });
  const [stats, setStats] = useState({ delivered: 0, km: 120 });
  const [activeOrder, setActiveOrder] = useState(null);
  
  // LÓGICA DE DRIVER 
  const [driverId, setDriverId] = useState(null);
  const [vehicleId, setVehicleId] = useState(null); 
  const [isOnline, setIsOnline] = useState(false); 
  
  const [currentTab, setCurrentTab] = useState('route'); 
  const [myLocation, setMyLocation] = useState(null); 

  // --- VARIABLES DE ENTORNO ---
  const ORDER_URL = import.meta.env.VITE_ORDER_URL; // 8083
  const FLEET_URL = import.meta.env.VITE_FLEET_URL; // 8082
  const WS_URL = import.meta.env.VITE_WS_URL;       // 3001

  useEffect(() => {
    loadUserData();
    fetchMyDriverProfile(); 
    fetchOrders();
    getCurrentLocation(); 

    // Conexión WebSocket
    console.log("Conectando Driver Socket a:", WS_URL);
    const socket = io(WS_URL);
    
    socket.on('orders_update', () => {
        console.log("Nueva actualización de pedido recibida");
        fetchOrders();
    });
    
    return () => socket.disconnect();
  }, []);

const fetchMyDriverProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const payload = JSON.parse(atob(token.split('.')[1]));
        const myUserIdFromToken = payload.userId || payload.id; 

        // LLAMADA AL MICROSERVICIO DE FLEET
        const response = await axios.get(`${FLEET_URL}/fleet/drivers`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log("Datos recibidos de Fleet:", response.data);
        console.log("Buscando conductor con User ID:", myUserIdFromToken);

        // Buscamos comparando ambos posibles nombres de campo (userId o user_id)
        const myProfile = response.data.find(d => 
            d.userId == myUserIdFromToken || d.user_id == myUserIdFromToken
        );

        if (myProfile) {
            setDriverId(myProfile.id); 
            setIsOnline(myProfile.status === 'DISPONIBLE');
            console.log("¡Perfil encontrado! Driver ID:", myProfile.id);
            
            // Obtener el vehículo asignado a este conductor
            try {
              const vehicleResponse = await axios.get(
                `${FLEET_URL}/fleet/drivers/${myProfile.id}/vehicle`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              if (vehicleResponse.data && vehicleResponse.data.id) {
                setVehicleId(vehicleResponse.data.id);
                console.log("Vehículo encontrado:", vehicleResponse.data);
              }
            } catch (vehicleError) {
              console.warn("No se encontró vehículo asignado al conductor");
            }
        } else {
            console.warn("No se encontró coincidencia en la lista de conductores.");
        }

      } catch (error) {
        console.error("Error buscando perfil de conductor:", error);
      }
  };

  // --- CAMBIAR ESTADO (Fleet Service) ---
  const toggleStatus = async () => {
    if (!driverId) return;
    try {
        const token = localStorage.getItem('token');
        const newStatus = isOnline ? 'NO_DISPONIBLE' : 'DISPONIBLE';
        
        // CORREGIDO: Sin /api
        await axios.patch(`${FLEET_URL}/fleet/drivers/${driverId}/status?status=${newStatus}`, {}, {
             headers: { Authorization: `Bearer ${token}` }
        });
        setIsOnline(!isOnline);
    } catch (e) { alert("Error al cambiar estado"); }
  };

  const getCurrentLocation = () => { navigator.geolocation?.getCurrentPosition(p => setMyLocation([p.coords.latitude, p.coords.longitude])); };
  
  const loadUserData = () => {
    try { 
        const t = localStorage.getItem('token'); 
        const p = JSON.parse(atob(t.split('.')[1]));
        setUserInfo({ name: p.sub, role: 'Transportista' });
    } catch (e) {}
  };

  // --- OBTENER PEDIDOS (Order Service) ---
  const fetchOrders = async () => {
    try {
        const t = localStorage.getItem('token');
        // CORREGIDO: Usamos ORDER_URL (8083) y /orders (según tu Java)
        const res = await axios.get(`${ORDER_URL}/orders`, { headers: { Authorization: `Bearer ${t}` }});
        const all = res.data;
        
        // Solo pedidos que pueden ser del conductor actual
        // Si el conductor tiene un vehículo, muestra los asignados a ese vehículo
        let myOrders = all;
        if (vehicleId) {
          myOrders = all.filter(o => o.assignedVehicleId === vehicleId);
        }
        
        // Mostrar el pedido activo (ASIGNADO o EN_RUTA)
        setActiveOrder(myOrders.find(o => (o.status === 'ASIGNADO' || o.status === 'EN_RUTA'))); 
        
        // Mostrar pedidos pendientes disponibles
        setOrders(all.filter(o => o.status === 'PENDIENTE'));
        
        // Contar solo entregas de ESTE vehículo
        const myDeliveries = myOrders.filter(o => o.status === 'ENTREGADO').length;
        setStats(p => ({...p, delivered: myDeliveries}));
    } catch(e) {
        console.error("Error cargando pedidos:", e);
    }
  };

  // --- ACTUALIZAR PEDIDO (Order Service) ---
  const updateOrderStatus = async (id, status) => {
      const t = localStorage.getItem('token');
      
      // Si el estado es ASIGNADO y tenemos vehicleId, primero asignamos el vehículo
      if (status === 'ASIGNADO' && vehicleId) {
        try {
          await axios.put(
            `${ORDER_URL}/orders/${id}/assign/${vehicleId}`,
            {},
            { headers: { Authorization: `Bearer ${t}` } }
          );
          console.log("Pedido asignado al vehículo ID:", vehicleId);
        } catch (assignError) {
          console.error("Error asignando vehículo:", assignError);
          alert("Error al asignar el vehículo al pedido");
          return;
        }
      }
      
      // LUEGO cambiamos el estado
      try {
        await axios.patch(`${ORDER_URL}/orders/${id}/status?status=${status}`, {}, { headers: { Authorization: `Bearer ${t}` }});
        setTimeout(fetchOrders, 500);
      } catch (statusError) {
        console.error("Error actualizando estado:", statusError);
      }
  };
  
  const handleLogout = () => { localStorage.clear(); navigate('/'); };

  const openGoogleMaps = (lat, lon) => {
    if (lat && lon) {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`, '_blank');
    } else {
        alert("Coordenadas no disponibles.");
    }
  };

  return (
    <div className="bg-[#111822] text-white font-display min-h-screen flex flex-col">
      {currentTab === 'route' && (
        <header className="px-6 pt-6 pb-4 flex items-center justify-between bg-[#111822] sticky top-0 z-20 shadow-md">
            <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-blue-600 flex items-center justify-center font-bold">
                    {userInfo.name.substring(0, 2).toUpperCase()}
                </div>
                <div><h1 className="text-sm font-bold">{userInfo.name}</h1><p className="text-[10px] text-gray-400">Transportista</p></div>
            </div>

            <button onClick={toggleStatus} disabled={!driverId}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${isOnline ? 'text-green-400 border-green-500/50' : 'text-red-400 border-red-500/50'}`}>
                <span className={`size-2.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                <span className="text-[10px] font-bold uppercase">{driverId ? (isOnline ? 'En Servicio' : 'Fuera de Servicio') : 'Cargando...'}</span>
            </button>
        </header>
      )}

      <div className="flex-1 overflow-y-auto pb-24 relative">
        {currentTab === 'route' && (
            <div className="px-5 space-y-6 pt-2">
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-[#192433] p-4 rounded-xl border border-[#233348]"><span className="text-gray-400 text-xs">Entregas</span><div className="text-2xl font-bold">{stats.delivered}</div></div>
                   <div className="bg-[#192433] p-4 rounded-xl border border-[#233348]"><span className="text-gray-400 text-xs">Km</span><div className="text-2xl font-bold">{stats.km}</div></div>
                </div>

                {activeOrder ? (
                    <div className="bg-[#192433] p-5 rounded-2xl border border-[#233348] shadow-lg">
                        <div className="flex justify-between items-start mb-1">
                            <h2 className="text-3xl font-bold">#{activeOrder.id}</h2>
                            <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded-lg font-bold border border-blue-500/30">EN CURSO</span>
                        </div>
                        
                        <p className="text-sm text-gray-400 mb-4">{activeOrder.description}</p>
                        
                        <div className="bg-[#111822] p-3 rounded-xl mb-4 border border-[#233348] flex items-start gap-3">
                            <span className="material-symbols-outlined text-blue-500 mt-1">location_on</span>
                            <div>
                                <p className="font-semibold text-sm text-gray-200">Destino:</p>
                                <p className="text-sm text-white leading-tight">{activeOrder.deliveryLocation}</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => updateOrderStatus(activeOrder.id, 'ENTREGADO')} 
                                className="w-full h-12 bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20">
                                <span className="material-symbols-outlined">check_circle</span>
                                Marcar Entregado
                            </button>

                            <button 
                                onClick={() => openGoogleMaps(activeOrder.latitude, activeOrder.longitude)} 
                                className="w-full h-12 bg-[#233348] hover:bg-[#2c4059] border border-gray-600/50 text-gray-300 hover:text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors">
                                <span className="material-symbols-outlined">map</span> 
                                Ver Ruta en Maps
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-[#192433] p-8 rounded-2xl border border-[#233348] text-center text-gray-400">
                        <span className="material-symbols-outlined text-4xl mb-2 text-gray-600">local_shipping</span>
                        <h3 className="font-medium text-lg">{isOnline ? 'Esperando nuevos pedidos...' : 'Estás Fuera de Servicio'}</h3>
                        <p className="text-xs text-gray-500 mt-1">Actívate para recibir rutas.</p>
                    </div>
                )}

                <div>
                    <h3 className="font-bold mb-3">Pendientes ({orders.length})</h3>
                    {orders.map((o, i) => (
                        <div key={o.id} className="flex items-center gap-4 p-4 rounded-xl bg-[#192433] border border-[#233348]">
                            <div className="size-8 rounded-full bg-[#233348] flex items-center justify-center font-bold border border-gray-700">{i+1}</div>
                            <div className="flex-1"><p className="font-bold text-sm">#{o.id} - {o.description}</p></div>
                            {!activeOrder && isOnline && (
                                <button onClick={() => updateOrderStatus(o.id, 'ASIGNADO')} className="size-10 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center"><span className="material-symbols-outlined">play_arrow</span></button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )}
        {currentTab === 'map' && <div className="absolute inset-0 pb-20"><DriverRouteMap orders={orders} activeOrder={activeOrder} myLocation={myLocation} /></div>}
      </div>

      <nav className="fixed bottom-0 w-full bg-[#192433] border-t border-[#233348] px-6 py-4 z-30 flex justify-between">
         <button onClick={() => setCurrentTab('route')} className={currentTab === 'route' ? 'text-blue-500' : 'text-gray-500'}>Ruta</button>
         <button onClick={() => setCurrentTab('map')} className={currentTab === 'map' ? 'text-blue-500' : 'text-gray-500'}>Mapa</button>
         <button onClick={handleLogout} className="text-gray-500">Salir</button>
      </nav>
    </div>
  );
}