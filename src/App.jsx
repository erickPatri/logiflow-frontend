import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import LoginPage from './pages/LoginPage';
import ClientDashboard from './pages/ClientDashboard';
import DriverDashboard from './pages/DriverDashboard';
import SupervisorDashboard from './pages/SupervisorDashboard';

// Importamos la seguridad
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        
        {/* RUTA PÚBLICA: Login */}
        <Route path="/" element={<LoginPage />} />

        {/* RUTAS PROTEGIDAS */}
        
        {/* para CLIENTES */}
        <Route path="/client" element={
          <ProtectedRoute allowedRoles={['CLIENTE']}>
             <ClientDashboard />
          </ProtectedRoute>
        }/>

        {/* para REPARTIDORES */}
        <Route path="/driver" element={
          <ProtectedRoute allowedRoles={['REPARTIDOR']}>
             <DriverDashboard />
          </ProtectedRoute>
        }/>

        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR', 'GERENTE']}>
             <SupervisorDashboard />
          </ProtectedRoute>
        }/>

        {/* Si alguien pone una ruta loca, lo mandamos al login */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;