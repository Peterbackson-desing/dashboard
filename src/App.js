import React, { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import { 
  Thermometer, 
  Droplets, 
  Activity, 
  Zap, 
  Moon, 
  Sun, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Power, 
  Lightbulb,
  Clock,
  TrendingUp,
  Wifi,
  WifiOff
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
        
        const client = mqtt.connect(url, {
          clientId: MQTT_CONFIG.clientId,
          username: MQTT_CONFIG.username,
          password: MQTT_CONFIG.password,
          clean: true,
          reconnectPeriod: 5000,
          connectTimeout: 30000
        });

        client.on('connect', () => {
          setConnection('connected');
          
          client.subscribe(MQTT_CONFIG.topicSub, { qos: 1 }, (err) => {
            if (!err) {
              console.log('Suscrito a:', MQTT_CONFIG.topicSub);
            }
          });
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
            console.error('Error parseando mensaje:', e);
          }
        });

        client.on('error', () => setConnection('error'));
        client.on('offline', () => setConnection('disconnected'));
        client.on('reconnect', () => setConnection('connecting'));

        clientRef.current = client;

      } catch (err) {
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
  };

  const getStateColor = (state) => {
    switch(state) {
      case 'NORMAL': return '#10b981';
      case 'ALERT': return '#f59e0b';
      case 'CRITICAL': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStateIcon = (state) => {
    switch(state) {
      case 'NORMAL': return <CheckCircle className="w-8 h-8" aria-hidden="true" />;
      case 'ALERT': return <AlertTriangle className="w-8 h-8" aria-hidden="true" />;
      case 'CRITICAL': return <XCircle className="w-8 h-8" aria-hidden="true" />;
      default: return <Activity className="w-8 h-8" aria-hidden="true" />;
    }
  };

  const getConnectionStatus = () => {
    const statuses = {
      connected: { text: 'Conectado', color: '#10b981', icon: Wifi },
      connecting: { text: 'Conectando', color: '#f59e0b', icon: Wifi },
      disconnected: { text: 'Desconectado', color: '#ef4444', icon: WifiOff },
      error: { text: 'Error de conexión', color: '#ef4444', icon: WifiOff }
    };
    return statuses[connection] || statuses.disconnected;
  };

  const connectionStatus = getConnectionStatus();
  const ConnectionIcon = connectionStatus.icon;

  return (
    <div className={`app theme-${theme}`}>
      {/* Header */}
      <header className="header" role="banner">
        <div className="header-content">
          <div className="header-top">
            <div className="header-title">
              <div className="logo" aria-hidden="true">
                <Activity className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h1 className="title-text">
                  Sistema de Monitoreo IoT
                </h1>
                <p className="subtitle">
                  Dashboard MQTT en Tiempo Real
                </p>
              </div>
            </div>
            
            <div className="header-controls">
              <div 
                className={`connection-badge connection-${connection}`}
                role="status"
                aria-live="polite"
                aria-label={`Estado de conexión: ${connectionStatus.text}`}
              >
                <ConnectionIcon className="w-4 h-4" aria-hidden="true" />
                <span>{connectionStatus.text}</span>
              </div>
              
              <button
                onClick={toggleTheme}
                className="theme-button"
                aria-label={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`}
              >
                {theme === 'dark' ? 
                  <Sun className="w-5 h-5" aria-hidden="true" /> : 
                  <Moon className="w-5 h-5" aria-hidden="true" />
                }
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="main" role="main">
        {/* Métricas principales */}
        <section aria-label="Métricas del sistema">
          <div className="metrics-grid">
            {/* Temperatura */}
            <article className="metric-card" aria-labelledby="temp-label">
              <div className="metric-bg-icon">
                <Thermometer aria-hidden="true" />
              </div>
              <div className="metric-content">
                <div className="metric-header">
                  <div className="metric-icon metric-icon-temp">
                    <Thermometer className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
                  </div>
                  <span id="temp-label" className="metric-label">
                    TEMPERATURA
                  </span>
                </div>
                <div className="metric-value" aria-label={`Temperatura actual: ${telemetry.temperature?.toFixed(1) || 0} grados Celsius`}>
                  {telemetry.temperature?.toFixed(1) || '--'}°C
                </div>
                <div className="metric-info">
                  Sensor: {telemetry.sensor}
                </div>
              </div>
            </article>

            {/* Humedad */}
            <article className="metric-card" aria-labelledby="hum-label">
              <div className="metric-bg-icon">
                <Droplets aria-hidden="true" />
              </div>
              <div className="metric-content">
                <div className="metric-header">
                  <div className="metric-icon metric-icon-hum">
                    <Droplets className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
                  </div>
                  <span id="hum-label" className="metric-label">
                    HUMEDAD
                  </span>
                </div>
                <div className="metric-value" aria-label={`Humedad actual: ${telemetry.humidity?.toFixed(1) || 0} por ciento`}>
                  {telemetry.humidity?.toFixed(1) || '--'}%
                </div>
                <div className="metric-info">
                  Humedad Relativa
                </div>
              </div>
            </article>

            {/* Estado */}
            <article className="metric-card" aria-labelledby="state-label">
              <div className="metric-bg-icon" style={{ color: getStateColor(telemetry.state) }}>
                <Activity aria-hidden="true" />
              </div>
              <div className="metric-content">
                <div className="metric-header">
                  <div className="metric-icon" style={{ backgroundColor: `${getStateColor(telemetry.state)}20` }}>
                    {getStateIcon(telemetry.state)}
                  </div>
                  <span id="state-label" className="metric-label">
                    ESTADO SISTEMA
                  </span>
                </div>
                <div className="metric-value" style={{ color: getStateColor(telemetry.state) }} aria-label={`Estado del sistema: ${telemetry.state || 'DESCONOCIDO'}`}>
                  {telemetry.state || 'DESCONOCIDO'}
                </div>
                <div className="metric-info">
                  Modo: {telemetry.manual ? 'Manual' : 'Automático'}
                </div>
              </div>
            </article>

            {/* Última actualización */}
            <article className="metric-card" aria-labelledby="update-label">
              <div className="metric-bg-icon">
                <Clock aria-hidden="true" />
              </div>
              <div className="metric-content">
                <div className="metric-header">
                  <div className="metric-icon metric-icon-update">
                    <Clock className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
                  </div>
                  <span id="update-label" className="metric-label">
                    ACTUALIZACIÓN
                  </span>
                </div>
                <div className="metric-value metric-value-time" aria-label={`Última actualización: ${new Date(telemetry.timestamp * 1000).toLocaleTimeString()}`}>
                  {new Date(telemetry.timestamp * 1000).toLocaleTimeString()}
                </div>
                <div className="metric-info">
                  Hace {Math.floor((Date.now() / 1000 - telemetry.timestamp) / 60)} minutos
                </div>
              </div>
            </article>
          </div>
        </section>

        <div className="controls-grid">
          {/* Panel de Control */}
          <section className="card" aria-labelledby="control-panel-title">
            <h2 id="control-panel-title" className="card-title">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-warning" aria-hidden="true" />
              Panel de Control
            </h2>

            <div className="controls-container">
              {/* LED Control */}
              <div className="control-item">
                <div className="control-info-wrapper">
                  <div className="control-info">
                    <Lightbulb className="w-7 h-7 sm:w-8 sm:h-8" style={{ color: telemetry.led ? '#facc15' : 'currentColor' }} aria-hidden="true" />
                    <div>
                      <div className="control-title">LED Indicador</div>
                      <div className="control-status">
                        {telemetry.led ? 'Encendido' : 'Apagado'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="control-buttons">
                  <button
                    onClick={() => sendCommand('led', 1)}
                    disabled={connection !== 'connected'}
                    className="btn btn-success"
                    aria-label="Encender LED"
                  >
                    ENCENDER
                  </button>
                  <button
                    onClick={() => sendCommand('led', 0)}
                    disabled={connection !== 'connected'}
                    className="btn btn-danger"
                    aria-label="Apagar LED"
                  >
                    APAGAR
                  </button>
                </div>
              </div>

              {/* Relay Control */}
              <div className="control-item">
                <div className="control-info-wrapper">
                  <div className="control-info">
                    <Power className="w-7 h-7 sm:w-8 sm:h-8" style={{ color: telemetry.relay ? '#ef4444' : 'currentColor' }} aria-hidden="true" />
                    <div>
                      <div className="control-title">Relay Ventilador</div>
                      <div className="control-status">
                        {telemetry.relay ? 'Activado' : 'Desactivado'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="control-buttons">
                  <button
                    onClick={() => sendCommand('relay', 1)}
                    disabled={connection !== 'connected'}
                    className="btn btn-success"
                    aria-label="Activar ventilador"
                  >
                    ACTIVAR
                  </button>
                  <button
                    onClick={() => sendCommand('relay', 0)}
                    disabled={connection !== 'connected'}
                    className="btn btn-danger"
                    aria-label="Desactivar ventilador"
                  >
                    DESACTIVAR
                  </button>
                </div>
              </div>

              {/* Botones de acción */}
              <button
                onClick={() => sendCommand('auto')}
                disabled={connection !== 'connected'}
                className="btn btn-auto"
                aria-label="Activar modo automático"
              >
                Modo Automático
              </button>

              <button
                onClick={() => sendCommand('test_sequence')}
                disabled={connection !== 'connected'}
                className="btn btn-outline"
                aria-label="Ejecutar secuencia de prueba"
              >
                Ejecutar Secuencia de Prueba
              </button>
            </div>
          </section>

          {/* Historial */}
          <section className="card" aria-labelledby="history-title">
            <h2 id="history-title" className="card-title">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-info" aria-hidden="true" />
              Historial de Lecturas
            </h2>

            <div className="table-container" role="region" aria-label="Tabla de historial de lecturas" tabIndex="0">
              <table className="history-table">
                <thead>
                  <tr>
                    <th scope="col">Hora</th>
                    <th scope="col">Temp</th>
                    <th scope="col">Hum</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="table-empty">
                        Esperando datos del sistema...
                      </td>
                    </tr>
                  ) : (
                    history.slice().reverse().map((entry, idx) => (
                      <tr key={idx}>
                        <td>{entry.time}</td>
                        <td className="table-value">{entry.temp?.toFixed(1)}°C</td>
                        <td className="table-value">{entry.hum?.toFixed(1)}%</td>
                        <td className="table-state" style={{ color: getStateColor(entry.state) }}>
                          {entry.state}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Información del estudiante */}
        <section className="card student-card" aria-labelledby="student-info-title">
          <h2 id="student-info-title" className="student-name">
            Pedro Javier Ramirez Ramire
          </h2>
          <div className="student-badge">
            <div className="student-label">Matrícula</div>
            <div className="student-id">2023171040</div>
          </div>
        </section>

        {/* Footer */}
        <footer className="footer" role="contentinfo">
          <p className="footer-text">
            Dashboard IoT con soporte WCAG 2.1 - Totalmente Responsivo
          </p>
          <p className="footer-text">
            Protocolo: MQTT sobre WebSockets Seguro (WSS)
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;