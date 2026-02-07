import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'; // 👈 Agregamos useMap
import L from 'leaflet';

// Iconos
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// REDIMENSIONA EL MAPA AUTOMÁTICAMENTE
function ResizeMap() {
    const map = useMap();
    useEffect(() => {
        // Se espera a que el contenedor termine de crecer
        const timer = setTimeout(() => {
            map.invalidateSize(); 
        }, 300); // 300ms de retraso s
        return () => clearTimeout(timer);
    }, [map]);
    return null;
}

export default function FleetMap({ orders = [] }) {
    const defaultPosition = [-0.1807, -78.4678]; // Quito

    return (
        <div className="w-full h-full bg-slate-900">
            <MapContainer 
                center={defaultPosition} 
                zoom={12} 
                scrollWheelZoom={true} 
                style={{ height: "100%", width: "100%" }}
                className="z-0"
            >
                <ResizeMap />

                <TileLayer
                    attribution='&copy; CARTO'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                {orders.map((order) => {
                    if (order.latitude && order.longitude) {
                        return (
                            <Marker 
                                key={order.id} 
                                position={[order.latitude, order.longitude]}
                            >
                                <Popup>
                                    <div className="text-slate-900 font-sans min-w-[150px]">
                                        <strong className="text-primary text-lg">📦 Pedido #{order.id}</strong><br />
                                        <hr className="my-1 border-gray-300"/>
                                        <b>Destino:</b> {order.deliveryLocation}<br />
                                        <b>Estado:</b> <span className="text-blue-600 font-bold">{order.status}</span>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    }
                    return null;
                })}
            </MapContainer>
        </div>
    );
}