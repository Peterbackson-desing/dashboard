import React, { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import { 
  Thermometer, Droplets, Activity, Wifi, Zap, Moon, Sun, 
  AlertTriangle, CheckCircle, XCircle, Power, Lightbulb, 
  Signal, Upload, Download, Lock, LogOut, User, Shield
} from 'lucide-react';
import './App.css';

// Configuración API
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function App() {
  // Estados de autenticación
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // Estados del dashboard
  const [theme, setTheme] = useState('dark');
  const [telemetry, setTelemetry] = useState({
    temperature: 0,
    humidity: 0,
    state: 'NORMAL',
    manual: false,
    led: 0,
    relay: 0,
    timestamp: Date.now() / 1000,
    sensor: 'DHT11'
  });
  const [connection, setConnection] = useState('disconnected');
  const [history, setHistory] = useState([]);

  // Estados de OTA
  const [firmwares, setFirmwares] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [otaLogs, setOtaLogs] = useState([]);
  const [showOtaPanel, setShowOtaPanel] = useState(false);

  const clientRef = useRef(null);

  const MQTT_CONFIG = {
    host: 'befdaf08.ala.us-east-1.emqxsl.com',
    port: 8084,
    protocol: 'wss',
    username: 'pepito',
    password: 'Fiyupanzona20',
    clientId: `dashboard_${Math.random().toString(16).substr(2, 8)}`,
    topicSub: '2023171040/telemetry',
    topicPub: '2023171040/cmd'
  };

  // ==================== AUTENTICACIÓN ====================

  useEffect(() => {
    // Verificar token al cargar
    const token = localStorage.getItem('token');
    if (token) {
      verifyToken(token);
    }
  }, []);

  const verifyToken = async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Error verificando token:', error);
      localStorage.removeItem('token');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        setCurrentUser(data.user);
        setIsAuthenticated(true);
        setLoginForm({ username: '', password: '' });
      } else {
        setLoginError(data.error || 'Error de autenticación');
      }
    } catch (error) {
      console.error('Error en login:', error);
      setLoginError('Error de conexión con el servidor');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setCurrentUser(null);
    if (clientRef.current) {
      clientRef.current.end();
    }
  };

  // ==================== MQTT ====================

  useEffect(() => {
    if (!isAuthenticated) return;

    const connectMQTT = () => {
      try {
        const url = `${MQTT_CONFIG.protocol}://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}/mqtt`;
        
        const client = mqtt.connect(url, {
          clientId: MQTT_CONFIG.clientId,
          username: MQTT_CONFIG.username,
          password: MQTT_CONFIG.password,
          clean: true,
          reconnectPeriod: 5000,
          connectTimeout: 30000
        });

        client.on('connect', () => {
          console.log('Conectado a MQTT');
          setConnection('connected');
          client.subscribe(MQTT_CONFIG.topicSub, { qos: 1 });
        });

        client.on('message', (topic, message) => {
          try {
            const data = JSON.parse(message.toString());
            
            setTelemetry(prev => ({
              ...prev,
              ...data,
              timestamp: data.timestamp || Date.now() / 1000
            }));

            setHistory(prev => {
              const newHistory = [...prev, {
                time: new Date().toLocaleTimeString(),
                temp: data.temperature,
                hum: data.humidity,
                state: data.state
              }];
              return newHistory.slice(-20);
            });
          } catch (e) {
            console.error('Error parseando:', e);
          }
        });

        client.on('error', (err) => {
          console.error('Error MQTT:', err);
          setConnection('error');
        });

        client.on('offline', () => setConnection('disconnected'));
        client.on('reconnect', () => setConnection('connecting'));

        clientRef.current = client;

      } catch (err) {
        console.error('Error conectando:', err);
        setConnection('error');
      }
    };

    connectMQTT();

    return () => {
      if (clientRef.current) {
        clientRef.current.end();
      }
    };
  }, [isAuthenticated]);

  // ==================== OTA ====================

  const fetchFirmwares = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/ota/list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setFirmwares(data.firmwares || []);
      }
    } catch (error) {
      console.error('Error obteniendo firmwares:', error);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.name.endsWith('.bin')) {
      setSelectedFile(file);
    } else {
      alert('Solo archivos .bin permitidos');
    }
  };

  const handleUploadFirmware = async () => {
    if (!selectedFile) {
      alert('Selecciona un archivo primero');
      return;
    }

    const formData = new FormData();
    formData.append('firmware', selectedFile);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/ota/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        alert('Firmware subido exitosamente');
        setSelectedFile(null);
        fetchFirmwares();
      } else {
        const data = await response.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error subiendo firmware:', error);
      alert('Error de conexión');
    }
  };

  const handleTriggerOTA = async (firmwareFilename) => {
    if (!window.confirm('¿Iniciar actualización OTA en el dispositivo?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/ota/trigger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deviceId: '2023171040',
          firmwareFilename
        })
      });

      if (response.ok) {
        alert('Comando OTA enviado al dispositivo');
      } else {
        const data = await response.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error trigger OTA:', error);
      alert('Error de conexión');
    }
  };

  useEffect(() => {
    if (isAuthenticated && showOtaPanel) {
      fetchFirmwares();
    }
  }, [isAuthenticated, showOtaPanel]);

  // ==================== MQTT ====================

  const sendCommand = (action, value = null) => {
    if (!clientRef.current || connection !== 'connected') {
      alert('No conectado a MQTT');
      return;
    }

    const cmd = value !== null ? { action, value } : { action };
    clientRef.current.publish(MQTT_CONFIG.topicPub, JSON.stringify(cmd), { qos: 1 });
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Pantalla de Login
  if (!isAuthenticated) {
    return (
      <div className={`theme-${theme}`} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%', margin: '1rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <Shield className="w-16 h-16" style={{ color: '#3b82f6', margin: '0 auto 1rem' }} />
            <h1 className="card-title">IoT Dashboard</h1>
            <p className="card-label">Acceso Seguro</p>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '1rem' }}>
              <label className="card-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Usuario
              </label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="btn w-full"
                style={{ padding: '0.75rem', textAlign: 'left' }}
                placeholder="admin / operador"
                required
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="card-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
                Contraseña
              </label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="btn w-full"
                style={{ padding: '0.75rem', textAlign: 'left' }}
                placeholder="••••••••"
                required
              />
            </div>

            {loginError && (
              <div style={{ padding: '0.75rem', backgroundColor: '#ef4444', color: 'white', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                {loginError}
              </div>
            )}

            <button type="submit" className="btn-primary w-full">
              <Lock className="w-4 h-4" style={{ display: 'inline', marginRight: '0.5rem' }} />
              Iniciar Sesión
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: theme === 'dark' ? '#1f2937' : '#f3f4f6', borderRadius: '0.5rem', fontSize: '0.75rem' }}>
            <p className="card-label" style={{ marginBottom: '0.5rem' }}>Credenciales de prueba:</p>
            <p>👤 Admin: <code>admin</code> / <code>admin123</code></p>
            <p>👤 Operador: <code>operador</code> / <code>oper123</code></p>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard Principal
  const getStateColor = (state) => {
    switch(state) {
      case 'NORMAL': return 'text-green';
      case 'ALERT': return 'text-yellow';
      case 'CRITICAL': return 'text-red';
      default: return 'text-gray';
    }
  };

  const getStateIcon = (state) => {
    switch(state) {
      case 'NORMAL': return <CheckCircle className="w-6 h-6" />;
      case 'ALERT': return <AlertTriangle className="w-6 h-6" />;
      case 'CRITICAL': return <XCircle className="w-6 h-6" />;
      default: return <Activity className="w-6 h-6" />;
    }
  };

  const badges = {
    connected: { color: 'connected', text: 'Conectado', icon: <Wifi className="w-4 h-4" /> },
    connecting: { color: 'connecting', text: 'Conectando...', icon: <Signal className="w-4 h-4 animate-pulse" /> },
    disconnected: { color: 'disconnected', text: 'Desconectado', icon: <XCircle className="w-4 h-4" /> },
    error: { color: 'error', text: 'Error', icon: <AlertTriangle className="w-4 h-4" /> }
  };

  const badge = badges[connection] || badges.disconnected;

  return (
    <div className={`theme-${theme} transition-colors`} style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="header-title">
              <Activity className="w-8 h-8" style={{ color: '#3b82f6' }} />
              <div>
                <h1>IoT Dashboard</h1>
                <p className="header-subtitle">ESP32 - Monitoreo Seguro</p>
              </div>
            </div>
            
            <div className="header-controls">
              <div className={`connection-badge ${badge.color}`}>
                {badge.icon}
                <span>{badge.text}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', backgroundColor: theme === 'dark' ? '#1f2937' : '#f3f4f6', borderRadius: '0.5rem' }}>
                <User className="w-4 h-4" />
                <span style={{ fontSize: '0.875rem' }}>
                  {currentUser?.username}
                  {currentUser?.role === 'admin' && <Shield className="w-3 h-3" style={{ display: 'inline', marginLeft: '0.25rem', color: '#f59e0b' }} />}
                </span>
              </div>
              
              <button onClick={toggleTheme} className="btn" aria-label="Cambiar tema">
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <button onClick={handleLogout} className="btn-danger" style={{ padding: '0.5rem' }}>
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingTop: '1.5rem' }}>
        {currentUser?.role === 'admin' && (
          <div style={{ marginBottom: '1rem' }}>
            <button
              onClick={() => setShowOtaPanel(!showOtaPanel)}
              className="btn-purple w-full"
            >
              <Upload className="w-5 h-5" style={{ display: 'inline', marginRight: '0.5rem' }} />
              {showOtaPanel ? 'Ocultar' : 'Mostrar'} Panel OTA
            </button>
          </div>
        )}
        {showOtaPanel && currentUser?.role === 'admin' && (
          <div className="card mb-6">
            <h2 className="card-title">
              <Upload className="w-6 h-6" style={{ color: '#f59e0b' }} />
              Gestión de Firmware (OTA)
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
              <div>
                <h3 className="font-medium mb-4" style={{ fontSize: '1.125rem' }}>Subir Nuevo Firmware</h3>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    accept=".bin"
                    onChange={handleFileSelect}
                    style={{ flex: '1', minWidth: '200px' }}
                  />
                  <button
                    onClick={handleUploadFirmware}
                    className="btn-success"
                    disabled={!selectedFile}
                  >
                    Subir
                  </button>
                </div>
                {selectedFile && (
                  <p className="card-label mt-2">
                    Seleccionado: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>
              <div>
                <h3 className="font-medium mb-4" style={{ fontSize: '1.125rem' }}>Firmwares Disponibles</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Archivo</th>
                        <th>Tamaño</th>
                        <th>Subido</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {firmwares.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="text-center">
                            No hay firmwares disponibles
                          </td>
                        </tr>
                      ) : (
                        firmwares.map((fw, idx) => (
                          <tr key={idx}>
                            <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{fw.filename}</td>
                            <td>{(fw.size / 1024).toFixed(2)} KB</td>
                            <td>{new Date(fw.uploadedAt).toLocaleString()}</td>
                            <td>
                              <button
                                onClick={() => handleTriggerOTA(fw.filename)}
                                className="btn-primary"
                                style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                              >
                                <Download className="w-4 h-4" style={{ display: 'inline', marginRight: '0.25rem' }} />
                                Enviar OTA
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-4">
          <div className="card">
            <div className="card-header">
              <Thermometer className="w-8 h-8" style={{ color: '#ef4444' }} />
              <span className="card-label">Temperatura</span>
            </div>
            <div className="card-value">{telemetry.temperature?.toFixed(1) || '--'}°C</div>
            <p className="card-label">Sensor: {telemetry.sensor}</p>
          </div>

          <div className="card">
            <div className="card-header">
              <Droplets className="w-8 h-8" style={{ color: '#3b82f6' }} />
              <span className="card-label">Humedad</span>
            </div>
            <div className="card-value">{telemetry.humidity?.toFixed(1) || '--'}%</div>
            <p className="card-label">Relativa</p>
          </div>

          <div className="card">
            <div className="card-header">
              <div className={getStateColor(telemetry.state)}>
                {getStateIcon(telemetry.state)}
              </div>
              <span className="card-label">Estado</span>
            </div>
            <div className={`card-value ${getStateColor(telemetry.state)}`}>
              {telemetry.state || 'DESCONOCIDO'}
            </div>
            <p className="card-label">
              {telemetry.manual ? 'Manual' : 'Automático'}
            </p>
          </div>

          <div className="card">
            <div className="card-header">
              <Activity className="w-8 h-8" style={{ color: '#a855f7' }} />
              <span className="card-label">Actualización</span>
            </div>
            <div className="card-value" style={{ fontSize: '1.25rem' }}>
              {new Date(telemetry.timestamp * 1000).toLocaleTimeString()}
            </div>
            <p className="card-label">
              {Math.floor((Date.now() / 1000 - telemetry.timestamp) / 60)} min atrás
            </p>
          </div>
        </div>
        <div className="grid grid-2 gap-6 mb-6">
          <div className="card">
            <h2 className="card-title">
              <Zap className="w-6 h-6" style={{ color: '#eab308' }} />
              Panel de Control
            </h2>
            
            <div className="space-y-4">
              <div className="control-item">
                <div className="control-info">
                  <Lightbulb className="w-6 h-6" style={{ color: telemetry.led ? '#facc15' : '#9ca3af' }} />
                  <div>
                    <p className="font-medium">LED Indicador</p>
                    <p className="card-label">Estado: {telemetry.led ? 'Encendido' : 'Apagado'}</p>
                  </div>
                </div>
                <div className="control-buttons">
                  <button onClick={() => sendCommand('led', 1)} className="btn-success" disabled={connection !== 'connected'}>ON</button>
                  <button onClick={() => sendCommand('led', 0)} className="btn-danger" disabled={connection !== 'connected'}>OFF</button>
                </div>
              </div>

              <div className="control-item">
                <div className="control-info">
                  <Power className="w-6 h-6" style={{ color: telemetry.relay ? '#ef4444' : '#9ca3af' }} />
                  <div>
                    <p className="font-medium">Relay</p>
                    <p className="card-label">Estado: {telemetry.relay ? 'Activado' : 'Desactivado'}</p>
                  </div>
                </div>
                <div className="control-buttons">
                  <button onClick={() => sendCommand('relay', 1)} className="btn-success" disabled={connection !== 'connected'}>ON</button>
                  <button onClick={() => sendCommand('relay', 0)} className="btn-danger" disabled={connection !== 'connected'}>OFF</button>
                </div>
              </div>

              <button onClick={() => sendCommand('auto')} className="btn-primary w-full" disabled={connection !== 'connected'}>
                Modo Automático
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">Historial</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Temp</th>
                    <th>Hum</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr><td colSpan="4" className="text-center">Esperando datos...</td></tr>
                  ) : (
                    history.slice().reverse().map((entry, idx) => (
                      <tr key={idx}>
                        <td>{entry.time}</td>
                        <td>{entry.temp?.toFixed(1)}°C</td>
                        <td>{entry.hum?.toFixed(1)}%</td>
                        <td className={`font-medium ${getStateColor(entry.state)}`}>{entry.state}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Evaluacion 3</h2>
          <div className="info-grid">
            <div>
              <p className="info-label">Matricula</p>
              <p className="info-value">2023171040</p>
            </div>
            <div>
              <p className="info-label">Usuario</p>
              <p className="info-value">{currentUser?.username} ({currentUser?.role})</p>
            </div>
            <div>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="container">
        </div>
      </footer>
    </div>
  );
}

export default App;