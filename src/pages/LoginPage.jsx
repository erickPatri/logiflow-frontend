import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

//const API_URL = 'http://localhost:8000/api/auth';
const API_URL = import.meta.env.VITE_AUTH_URL;

export default function LoginPage() {
    const navigate = useNavigate();
    const [isLoginMode, setIsLoginMode] = useState(true);
    
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        email: '',
        role: 'CLIENTE'
    });

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async () => {
        setError('');
        setLoading(true);

        try {
            if (isLoginMode) {
                // --- LOGIN ---
                const response = await axios.post(`${API_URL}/login`, {
                    username: formData.username,
                    password: formData.password
                });
                
                // 1. Obtenemos el token
                const token = response.data.token;
                
                // 2. Extraemos el ROL real desde dentro del token
                const decodedToken = parseJwt(token);
                // NOTA: Verifica si en tu Java el claim se llama "role", "roles" o "authorities"
                const userRole = decodedToken?.role || decodedToken?.roles || 'USUARIO'; 

                alert(`¡Login Exitoso! \nBienvenido ${formData.username} \nRol detectado: ${userRole}`);

                if (userRole === 'CLIENTE') {
                    navigate('/client');
                } else if (userRole === 'REPARTIDOR') {
                    navigate('/driver');
                } else {
                    navigate('/admin');
                }
                
                localStorage.setItem('token', token);
                localStorage.setItem('role', userRole);

            } else {
                // --- REGISTRO ---
                await axios.post(`${API_URL}/register`, {
                    username: formData.username,
                    email: formData.email,
                    password: formData.password,
                    role: formData.role
                });
                
                alert('¡Cuenta creada! Ahora inicia sesión.');
                setIsLoginMode(true);
            }
        } catch (err) {
            console.error("Error capturado:", err);

            // --- MEJORA DEL MENSAJE DE ERROR ---
            if (err.response) {
                // Si el servidor respondió con un código de error (ej: 403, 401, 500)
                if (err.response.status === 403 || err.response.status === 401) {
                    setError('Credenciales incorrectas. Verifica tu usuario y contraseña.');
                } else {
                    // Otro error (ej: usuario ya existe)
                    setError(err.response.data?.message || 'Error en el servidor. Intenta más tarde.');
                }
            } else if (err.request) {
                // El servidor no respondió (quizás está apagado o problema de CORS)
                setError('No se pudo conectar con el servidor. Verifica tu conexión.');
            } else {
                setError('Ocurrió un error inesperado.');
            }
        } finally {
            setLoading(false);
        }
    };

    // --- FUNCIÓN AUXILIAR PARA LEER EL TOKEN (SIN LIBRERÍAS EXTRA) ---
    const parseJwt = (token) => {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            return {};
        }
    };

    return (
        <div className="min-h-screen flex w-full font-display bg-background-light text-slate-900">
            {/* ... (EL RESTO DEL HTML VISUAL SIGUE IGUAL QUE ANTES) ... */}
            {/* Solo asegúrate de copiar la parte visual que ya tenías aquí abajo */}
            
            {/* --- IZQUIERDA: IMAGEN DECORATIVA --- */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-slate-900/60 mix-blend-multiply z-10"></div>
                <img 
                    src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80" 
                    className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay"
                    alt="Fondo Logística"
                />
                
                <div className="relative z-20 flex flex-col justify-between w-full h-full p-12 text-white">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-4xl">local_shipping</span>
                        <span className="text-2xl font-bold tracking-tight">LogiFlow</span>
                    </div>
                    <div className="max-w-lg mb-12">
                        <h1 className="text-5xl font-black mb-6 leading-tight">Mueve el mundo <br/>sin fronteras.</h1>
                        <p className="text-xl text-slate-200 font-light leading-relaxed">
                            Plataforma de gestión logística inteligente.
                        </p>
                    </div>
                    <div className="text-sm text-slate-400">© 2026 LogiFlow Inc.</div>
                </div>
            </div>

            {/* --- DERECHA: FORMULARIO --- */}
            <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-12 bg-surface-light w-full">
                <div className="w-full max-w-[480px] flex flex-col gap-6">
                    
                    <div className="flex flex-col gap-2 mb-2">
                        <h2 className="text-3xl font-bold text-slate-900">
                            {isLoginMode ? 'Iniciar Sesión' : 'Crear Cuenta'}
                        </h2>
                        <p className="text-slate-500">
                            {isLoginMode ? 'Ingresa tus credenciales para continuar.' : 'Completa tus datos para registrarte.'}
                        </p>
                    </div>

                    <div className="bg-slate-100 p-1 rounded-xl flex items-center mb-4">
                        <button 
                            onClick={() => { setIsLoginMode(true); setError(''); }}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${isLoginMode ? 'bg-white text-primary shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Iniciar Sesión
                        </button>
                        <button 
                            onClick={() => { setIsLoginMode(false); setError(''); }}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${!isLoginMode ? 'bg-white text-primary shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Registrarse
                        </button>
                    </div>

                    {/* MENSAJE DE ERROR MEJORADO */}
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200 flex items-center gap-2 animate-pulse">
                            <span className="material-symbols-outlined text-sm">error</span>
                            {error}
                        </div>
                    )}

                    <form className="flex flex-col gap-5">
                        
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Usuario</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-3 text-slate-400">person</span>
                                <input 
                                    name="username"
                                    type="text" 
                                    value={formData.username}
                                    onChange={handleChange}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" 
                                    placeholder="Ej. pedro" 
                                />
                            </div>
                        </div>

                        {!isLoginMode && (
                            <div className="flex flex-col gap-1.5 animate-fade-in">
                                <label className="text-sm font-semibold text-slate-700 ml-1">Correo electrónico</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-3 text-slate-400">mail</span>
                                    <input 
                                        name="email"
                                        type="email" 
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" 
                                        placeholder="pedro@hotmail.com" 
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Contraseña</label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-3 text-slate-400">lock</span>
                                <input 
                                    name="password"
                                    type="password" 
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm" 
                                    placeholder="••••••••" 
                                />
                            </div>
                        </div>

                        {!isLoginMode && (
                            <div className="flex flex-col gap-2 pt-2 animate-fade-in">
                                <span className="text-sm font-semibold text-slate-700 ml-1">Bienvenido</span>
                                <div className="grid grid-cols-1 gap-3">
                                    <label className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${formData.role === 'CLIENTE' ? 'border-primary bg-primary/5' : 'border-slate-200 hover:bg-slate-50'}`}>
                                        <input type="radio" name="role" value="CLIENTE" checked={formData.role === 'CLIENTE'} onChange={handleChange} className="sr-only"/>
                                        <span className="material-symbols-outlined text-3xl text-slate-400">storefront</span>
                                        <span className="text-sm font-semibold text-slate-600">Cliente</span>
                                        {formData.role === 'CLIENTE' && <span className="material-symbols-outlined absolute top-2 right-2 text-primary text-sm">check_circle</span>}
                                    </label>

                                    {/* <label className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${formData.role === 'REPARTIDOR' ? 'border-primary bg-primary/5' : 'border-slate-200 hover:bg-slate-50'}`}>
                                        <input type="radio" name="role" value="REPARTIDOR" checked={formData.role === 'REPARTIDOR'} onChange={handleChange} className="sr-only"/>
                                        <span className="material-symbols-outlined text-3xl text-slate-400">local_shipping</span>
                                        <span className="text-sm font-semibold text-slate-600">Repartidor</span>
                                        {formData.role === 'REPARTIDOR' && <span className="material-symbols-outlined absolute top-2 right-2 text-primary text-sm">check_circle</span>}
                                    </label> */}
                                </div>
                            </div>
                        )}

                        <button 
                            type="button" 
                            onClick={handleSubmit}
                            disabled={loading}
                            className="mt-4 w-full bg-primary hover:bg-primary-hover text-white py-3.5 rounded-lg font-bold text-sm shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
                        >
                            {loading ? 'Procesando...' : (isLoginMode ? 'Ingresar' : 'Crear Cuenta')}
                            {!loading && <span className="material-symbols-outlined text-sm">arrow_forward</span>}
                        </button>

                    </form>
                </div>
            </div>
        </div>
    );
}