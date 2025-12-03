import React, { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';
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

  const sendCommand = (action, value = null) => {
    if (!clientRef.current || connection !== 'connected') {
      alert('No conectado al broker MQTT');
      return;
    }
    const cmd = value !== null ? { action, value } : { action };
    clientRef.current.publish(MQTT_CONFIG.topicPub, JSON.stringify(cmd), { qos: 1 });
  };

  const getStateColor = (state) => {
    switch(state) {
      case 'NORMAL': return 'state-normal';
      case 'ALERT': return 'state-alert';
      case 'CRITICAL': return 'state-critical';
      default: return 'state-default';
    }
  };

  const connectionText = {
    connected: 'Conectado',
    connecting: 'Conectando',
    disconnected: 'Desconectado',
    error: 'Error'
  }[connection];

  return (
    <div className={`app-container theme-${theme}`}>
      <header className="app-header" role="banner">
        <div className="header-content">
          <h1 className="header-title">Sistema de Monitoreo IoT</h1>
          <div className="header-right">
            <div 
              className={`connection-badge connection-${connection}`}
              role="status"
              aria-live="polite"
              aria-label={`Estado de conexión: ${connectionText}`}
            >
              {connectionText}
            </div>
            <button
              onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
              className="theme-button"
              aria-label={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`}
            >
              Tema {theme === 'dark' ? 'Claro' : 'Oscuro'}
            </button>
          </div>
        </div>
      </header>

      <main className="app-main" role="main">
        <section className="section" aria-label="Métricas del sistema">
          <h2 className="section-title">Métricas en Tiempo Real</h2>
          <div className="metrics-grid">
            <article className="metric-card" aria-labelledby="temp-label">
              <div className="metric-label" id="temp-label">Temperatura</div>
              <div className="metric-value" aria-label={`Temperatura actual: ${telemetry.temperature?.toFixed(1) || 0} grados Celsius`}>
                {telemetry.temperature?.toFixed(1) || '--'}°C
              </div>
              <div className="metric-info">Sensor: {telemetry.sensor}</div>
            </article>

            <article className="metric-card" aria-labelledby="hum-label">
              <div className="metric-label" id="hum-label">Humedad</div>
              <div className="metric-value" aria-label={`Humedad actual: ${telemetry.humidity?.toFixed(1) || 0} por ciento`}>
                {telemetry.humidity?.toFixed(1) || '--'}%
              </div>
              <div className="metric-info">Humedad Relativa</div>
            </article>

            <article className="metric-card" aria-labelledby="state-label">
              <div className="metric-label" id="state-label">Estado Sistema</div>
              <div 
                className={`metric-value ${getStateColor(telemetry.state)}`}
                aria-label={`Estado del sistema: ${telemetry.state || 'DESCONOCIDO'}`}
              >
                {telemetry.state || 'DESCONOCIDO'}
              </div>
              <div className="metric-info">Modo: {telemetry.manual ? 'Manual' : 'Automático'}</div>
            </article>

            <article className="metric-card" aria-labelledby="update-label">
              <div className="metric-label" id="update-label">Última Actualización</div>
              <div 
                className="metric-value metric-value-small" 
                aria-label={`Última actualización: ${new Date(telemetry.timestamp * 1000).toLocaleTimeString()}`}
              >
                {new Date(telemetry.timestamp * 1000).toLocaleTimeString()}
              </div>
              <div className="metric-info">
                Hace {Math.floor((Date.now() / 1000 - telemetry.timestamp) / 60)} minutos
              </div>
            </article>
          </div>
        </section>

        <section className="section" aria-labelledby="control-title">
          <h2 className="section-title" id="control-title">Panel de Control</h2>
          <div className="control-group">
            <div className="control-item">
              <div className="control-header">
                <div>
                  <div className="control-title">LED Indicador</div>
                  <div className="control-status">
                    Estado: {telemetry.led ? 'Encendido' : 'Apagado'}
                  </div>
                </div>
              </div>
              <div className="button-group">
                <button
                  onClick={() => sendCommand('led', 1)}
                  disabled={connection !== 'connected'}
                  className="btn btn-success"
                  aria-label="Encender LED"
                >
                  Encender
                </button>
                <button
                  onClick={() => sendCommand('led', 0)}
                  disabled={connection !== 'connected'}
                  className="btn btn-danger"
                  aria-label="Apagar LED"
                >
                  Apagar
                </button>
              </div>
            </div>

            <div className="control-item">
              <div className="control-header">
                <div>
                  <div className="control-title">Relay Ventilador</div>
                  <div className="control-status">
                    Estado: {telemetry.relay ? 'Activado' : 'Desactivado'}
                  </div>
                </div>
              </div>
              <div className="button-group">
                <button
                  onClick={() => sendCommand('relay', 1)}
                  disabled={connection !== 'connected'}
                  className="btn btn-success"
                  aria-label="Activar ventilador"
                >
                  Activar
                </button>
                <button
                  onClick={() => sendCommand('relay', 0)}
                  disabled={connection !== 'connected'}
                  className="btn btn-danger"
                  aria-label="Desactivar ventilador"
                >
                  Desactivar
                </button>
              </div>
            </div>

            <button
              onClick={() => sendCommand('auto')}
              disabled={connection !== 'connected'}
              className="btn btn-primary btn-full"
              aria-label="Activar modo automático"
            >
              Modo Automático
            </button>

            <button
              onClick={() => sendCommand('test_sequence')}
              disabled={connection !== 'connected'}
              className="btn btn-outline btn-full"
              aria-label="Ejecutar secuencia de prueba"
            >
              Ejecutar Secuencia de Prueba
            </button>
          </div>
        </section>

        <section className="section" aria-labelledby="history-title">
          <h2 className="section-title" id="history-title">Historial de Lecturas</h2>
          <div className="table-container" role="region" aria-label="Tabla de historial de lecturas" tabIndex="0">
            <table className="history-table">
              <thead>
                <tr>
                  <th scope="col">Hora</th>
                  <th scope="col">Temperatura</th>
                  <th scope="col">Humedad</th>
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
                      <td>{entry.temp?.toFixed(1)}°C</td>
                      <td>{entry.hum?.toFixed(1)}%</td>
                      <td className={getStateColor(entry.state)}>
                        {entry.state}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section" aria-labelledby="student-info-title">
          <div className="student-info">
            <h2 className="student-name" id="student-info-title">
              Pedro Javier Ramirez Ramirez
            </h2>
            <div className="metric-label">Matrícula</div>
            <div className="student-id">2023171040</div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;