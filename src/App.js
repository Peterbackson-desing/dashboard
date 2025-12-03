import React, { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import { 
  Thermometer, 
  Droplets, 
  Activity, 
  Wifi, 
  Zap, 
  Moon, 
  Sun, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Power, 
  Lightbulb, 
  Signal 
} from 'lucide-react';
import './App.css';

function App() {
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

  useEffect(() => {
    const connectMQTT = () => {
      try {
        const url = `${MQTT_CONFIG.protocol}://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}/mqtt`;
        
        console.log('Conectando a:', url);
        
        const client = mqtt.connect(url, {
          clientId: MQTT_CONFIG.clientId,
          username: MQTT_CONFIG.username,
          password: MQTT_CONFIG.password,
          clean: true,
          reconnectPeriod: 5000,
          connectTimeout: 30000
        });

        client.on('connect', () => {
          console.log('Conectado a MQTT broker');
          setConnection('connected');
          
          client.subscribe(MQTT_CONFIG.topicSub, { qos: 1 }, (err) => {
            if (err) {
              console.error('Error suscripción:', err);
            } else {
              console.log('Suscrito a:', MQTT_CONFIG.topicSub);
            }
          });
        });

        client.on('message', (topic, message) => {
          try {
            const data = JSON.parse(message.toString());
            console.log('Datos recibidos:', data);
            
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
            console.error('Error parseando mensaje:', e);
          }
        });

        client.on('error', (err) => {
          console.error('Error MQTT:', err);
          setConnection('error');
        });

        client.on('offline', () => {
          console.warn('MQTT offline');
          setConnection('disconnected');
        });

        client.on('reconnect', () => {
          console.log('Reconectando...');
          setConnection('connecting');
        });

        clientRef.current = client;

      } catch (err) {
        console.error('Error conectando MQTT:', err);
        setConnection('error');
      }
    };

    connectMQTT();

    return () => {
      if (clientRef.current) {
        clientRef.current.end();
      }
    };
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const sendCommand = (action, value = null) => {
    if (!clientRef.current || connection !== 'connected') {
      alert('No conectado al broker MQTT');
      return;
    }

    const cmd = value !== null 
      ? { action, value }
      : { action };

    clientRef.current.publish(MQTT_CONFIG.topicPub, JSON.stringify(cmd), { qos: 1 });
    console.log('📤 Comando enviado:', cmd);
  };

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

  const getConnectionBadge = () => {
    const badges = {
      connected: { color: 'connected', text: 'Conectado', icon: <Wifi className="w-4 h-4" /> },
      connecting: { color: 'connecting', text: 'Conectando...', icon: <Signal className="w-4 h-4 animate-pulse" /> },
      disconnected: { color: 'disconnected', text: 'Desconectado', icon: <XCircle className="w-4 h-4" /> },
      error: { color: 'error', text: 'Error', icon: <AlertTriangle className="w-4 h-4" /> }
    };
    
    const badge = badges[connection] || badges.disconnected;
    
    return (
      <div className={`connection-badge ${badge.color}`}>
        {badge.icon}
        <span>{badge.text}</span>
      </div>
    );
  };

  return (
    <div className={`theme-${theme} transition-colors`} style={{ minHeight: '100vh' }}>
      <header className="header">
        <div className="container">
          <div className="header-content">
            <div className="header-title">
              <Activity className="w-8 h-8 text-blue-500" style={{ color: '#3b82f6' }} />
              <div>
                <h1>Evaluación 3</h1>
                <p className="header-subtitle">Dashboard</p>
              </div>
            </div>
            
            <div className="header-controls">
              {getConnectionBadge()}    
              <button
                onClick={toggleTheme}
                className="btn"
                aria-label={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="container" style={{ paddingTop: '1.5rem' }}>
        <div className="grid grid-4">
          <div className="card">
            <div className="card-header">
              <Thermometer className="w-8 h-8" style={{ color: '#ef4444' }} aria-hidden="true" />
              <span className="card-label">Temperatura</span>
            </div>
            <div className="card-value">{telemetry.temperature?.toFixed(1) || '--'}°C</div>
            <p className="card-label">Sensor: {telemetry.sensor}</p>
          </div>
          <div className="card">
            <div className="card-header">
              <Droplets className="w-8 h-8" style={{ color: '#3b82f6' }} aria-hidden="true" />
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
              <Activity className="w-8 h-8" style={{ color: '#a855f7' }} aria-hidden="true" />
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
                    <p className="font-medium">LED</p>
                    <p className="card-label">
                      Estado: {telemetry.led ? 'Encendido' : 'Apagado'}
                    </p>
                  </div>
                </div>
                <div className="control-buttons">
                  <button
                    onClick={() => sendCommand('led', 1)}
                    className="btn-success"
                    disabled={connection !== 'connected'}
                  >
                    ON
                  </button>
                  <button
                    onClick={() => sendCommand('led', 0)}
                    className="btn-danger"
                    disabled={connection !== 'connected'}
                  >
                    OFF
                  </button>
                </div>
              </div>
              <div className="control-item">
                <div className="control-info">
                  <Power className="w-6 h-6" style={{ color: telemetry.relay ? '#ef4444' : '#9ca3af' }} />
                  <div>
                    <p className="font-medium">Relay (Ventilador)</p>
                    <p className="card-label">
                      Estado: {telemetry.relay ? 'Activado' : 'Desactivado'}
                    </p>
                  </div>
                </div>
                <div className="control-buttons">
                  <button
                    onClick={() => sendCommand('relay', 1)}
                    className="btn-success"
                    disabled={connection !== 'connected'}
                  >
                    ON
                  </button>
                  <button
                    onClick={() => sendCommand('relay', 0)}
                    className="btn-danger"
                    disabled={connection !== 'connected'}
                  >
                    OFF
                  </button>
                </div>
              </div>
              <button
                onClick={() => sendCommand('auto')}
                className="btn-primary w-full"
                disabled={connection !== 'connected'}
              >
                Automático
              </button>
              <button
                onClick={() => sendCommand('test_sequence')}
                className="btn-purple w-full"
                disabled={connection !== 'connected'}
              >
                Ejecutar Prueba
              </button>
            </div>
          </div>

          {/* Historial */}
          <div className="card">
            <h2 className="card-title">Historial Reciente</h2>
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
                    <tr>
                      <td colSpan="4" className="text-center">
                        Esperando datos...
                      </td>
                    </tr>
                  ) : (
                    history.slice().reverse().map((entry, idx) => (
                      <tr key={idx}>
                        <td>{entry.time}</td>
                        <td>{entry.temp?.toFixed(1)}°C</td>
                        <td>{entry.hum?.toFixed(1)}%</td>
                        <td className={`font-medium ${getStateColor(entry.state)}`}>
                          {entry.state}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">Pedro Javier Ramirez Ramire</h2>
          <div className="info-grid">
            <div>
              <p className="info-label">Matricula</p>
              <p className="info-value">2023171040</p>
            </div>
            <div>
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