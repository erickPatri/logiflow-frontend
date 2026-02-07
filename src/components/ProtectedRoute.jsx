import React from 'react';
import { Navigate } from 'react-router-dom';

// Función auxiliar para leer el token sin librerías externas
const getUserRole = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    try {
        // Decodificamos la parte del medio del JWT (Payload)
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(c => 
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
        
        const decoded = JSON.parse(jsonPayload);
        // Buscamos el rol. Prioridad: 'role' 
        return decoded.role || decoded.roles || decoded.authorities || 'CLIENTE';
    } catch (e) {
        return null;
    }
};

export const ProtectedRoute = ({ children, allowedRoles }) => {
    const role = getUserRole();
    const token = localStorage.getItem('token');

    // Si no hay token, te manda al Login
    if (!token) {
        return <Navigate to="/" replace />;
    }

    // Si hay token pero el rol no está en la lista de permitidos
    if (allowedRoles && !allowedRoles.includes(role)) {
        alert(`Acceso Denegado! \nTu rol (${role}) no tiene permiso para ver esta página.`);
        return <Navigate to="/" replace />;
    }

    // Si todo está bien, muestra la página protegida
    return children;
};