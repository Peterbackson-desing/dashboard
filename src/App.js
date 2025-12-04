import React, { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import './App.css';

function App() {
  const [theme, setTheme] = useState('dark');
  const [telemetry, setTelemetry] = useState({
    vibration_count: 0,
    vibrating_now: false,
    state: 'NORMAL',
    manual: false,
    led: 0,
    relay: 0,
    timestamp: Date.now() / 1000,
    sensor: 'SW-420'
  });
  const [connection, setConnection] = useState('disconnected');
  const [history, setHistory] = useState([]);
  const [otaUrl, setOtaUrl] = useState('https://ota-server-320033886492.us-central1.run.app/firmware');
  const [otaLog, setOtaLog] = useState([]);
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
            const msgStr = message.toString();
            
            // Detectar mensajes de OTA
            if (msgStr.includes('OTA') || msgStr.includes('Reboot')) {
              setOtaLog(prev => {
                const newLog = [...prev, {
                  time: new Date().toLocaleTimeString(),
                  message: msgStr
                }];
                return newLog.slice(-10); // Mantener últimos 10 mensajes
              });
            }
            
            const data = JSON.parse(msgStr);
            setTelemetry(prev => ({
              ...prev,
              ...data,
              timestamp: data.timestamp || Date.now() / 1000
            }));
            setHistory(prev => {
              const newHistory = [...prev, {
                time: new Date().toLocaleTimeString(),
                vibCount: data.vibration_count || 0,
                vibrating: data.vibrating_now || false,
                state: data.state
              }];
              return newHistory.slice(-20);
            });
          } catch (e) {
            // Si no es JSON, podría ser un mensaje de texto (como los de OTA)
            const msgStr = message.toString();
            if (msgStr.includes('OTA') || msgStr.includes('Reboot')) {
              setOtaLog(prev => {
                const newLog = [...prev, {
                  time: new Date().toLocaleTimeString(),
                  message: msgStr
                }];
                return newLog.slice(-10);
              });
            }
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

  const triggerOTA = () => {
    if (!clientRef.current || connection !== 'connected') {
      alert('No conectado al broker MQTT');
      return;
    }
    if (!window.confirm('¿Confirmar actualización OTA? El ESP32 se reiniciará.')) return;
    
    const cmd = { action: 'ota', url: otaUrl };
    clientRef.current.publish(MQTT_CONFIG.topicPub, JSON.stringify(cmd), { qos: 1 });
    alert('Comando OTA enviado. Monitorea los logs del ESP32.');
    
    // Agregar mensaje local al log
    setOtaLog(prev => {
      const newLog = [...prev, {
        time: new Date().toLocaleTimeString(),
        message: '📤 Comando OTA enviado desde dashboard'
      }];
      return newLog.slice(-10);
    });
  };

  const clearOtaLog = () => {
    setOtaLog([]);
  };

  const getStateClass = (state) => {
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
    <div className={`app theme-${theme}`}>
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1 className="header-title">Monitor de Vibración IoT</h1>
          <div className="header-actions">
            <span className={`connection-badge connection-${connection}`}>
              {connectionText}
            </span>
            <button 
              className="btn-theme"
              onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
              aria-label="Cambiar tema"
            >
              {theme === 'dark' ? '☀️ Claro' : '🌙 Oscuro'}
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        {/* Métricas */}
        <section className="section">
          <h2 className="section-title">Métricas del Sistema</h2>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Vibraciones Detectadas</div>
              <div className="metric-value">{telemetry.vibration_count || 0}</div>
              <div className="metric-info">Últimos 10 segundos</div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Estado Actual</div>
              <div className="metric-value">
                {telemetry.vibrating_now ? '🔴 Vibrando' : '🟢 Reposo'}
              </div>
              <div className="metric-info">Sensor: {telemetry.sensor}</div>
            </div>

            <div className={`metric-card ${getStateClass(telemetry.state)}`}>
              <div className="metric-label">Estado del Sistema</div>
              <div className="metric-value">{telemetry.state || 'DESCONOCIDO'}</div>
              <div className="metric-info">
                Modo: {telemetry.manual ? 'Manual 🔧' : 'Automático ⚙️'}
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Última Actualización</div>
              <div className="metric-value metric-value-small">
                {new Date(telemetry.timestamp * 1000).toLocaleTimeString()}
              </div>
              <div className="metric-info">
                Hace {Math.floor((Date.now() / 1000 - telemetry.timestamp) / 60)} min
              </div>
            </div>
          </div>
        </section>

        {/* Control Panel */}
        <section className="section">
          <h2 className="section-title">Panel de Control</h2>
          <div className="control-grid">
            <div className="control-card">
              <div className="control-header">
                <div>
                  <div className="control-title">LED Indicador</div>
                  <div className="control-status">
                    Estado: {telemetry.led ? '🟢 Encendido' : '⚫ Apagado'}
                  </div>
                </div>
              </div>
              <div className="button-group">
                <button
                  className="btn btn-success"
                  onClick={() => sendCommand('led', 1)}
                  disabled={connection !== 'connected'}
                >
                  Encender
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => sendCommand('led', 0)}
                  disabled={connection !== 'connected'}
                >
                  Apagar
                </button>
              </div>
            </div>

            <div className="control-card">
              <div className="control-header">
                <div>
                  <div className="control-title">Relay (Actuador)</div>
                  <div className="control-status">
                    Estado: {telemetry.relay ? '⚡ Activado' : '⭕ Desactivado'}
                  </div>
                </div>
              </div>
              <div className="button-group">
                <button
                  className="btn btn-success"
                  onClick={() => sendCommand('relay', 1)}
                  disabled={connection !== 'connected'}
                >
                  Activar
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => sendCommand('relay', 0)}
                  disabled={connection !== 'connected'}
                >
                  Desactivar
                </button>
              </div>
            </div>
          </div>

          <div className="action-buttons">
            <button
              className="btn btn-primary"
              onClick={() => sendCommand('auto')}
              disabled={connection !== 'connected'}
            >
              ⚙️ Modo Automático
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => sendCommand('test_sequence')}
              disabled={connection !== 'connected'}
            >
              🧪 Secuencia de Prueba
            </button>
            <button
              className="btn btn-warning"
              onClick={() => sendCommand('reset_counter')}
              disabled={connection !== 'connected'}
            >
              🔄 Resetear Contador
            </button>
          </div>
        </section>

        {/* OTA Update */}
        <section className="section">
          <h2 className="section-title">Actualización OTA</h2>
          <div className="ota-card">
            <div className="form-group">
              <label className="form-label">URL del Firmware</label>
              <input
                type="text"
                className="form-input"
                value={otaUrl}
                onChange={(e) => setOtaUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <button
              className="btn btn-ota"
              onClick={triggerOTA}
              disabled={connection !== 'connected'}
            >
              📡 Iniciar Actualización OTA
            </button>
            <div className="warning-box">
              ⚠️ El dispositivo se reiniciará después de la actualización
            </div>
            
            {/* OTA Log */}
            {otaLog.length > 0 && (
              <div className="ota-log">
                <div className="ota-log-header">
                  <h3 className="ota-log-title">📋 Log de OTA</h3>
                  <button 
                    className="btn-clear-log"
                    onClick={clearOtaLog}
                    title="Limpiar log"
                  >
                    🗑️ Limpiar
                  </button>
                </div>
                <div className="ota-log-content">
                  {otaLog.slice().reverse().map((entry, idx) => (
                    <div 
                      key={idx} 
                      className={`ota-log-entry ${
                        entry.message.includes('SUCCESS') ? 'log-success' :
                        entry.message.includes('FAILED') ? 'log-error' :
                        entry.message.includes('STARTED') ? 'log-info' : ''
                      }`}
                    >
                      <span className="ota-log-time">[{entry.time}]</span>
                      <span className="ota-log-message">{entry.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* History */}
        <section className="section">
          <h2 className="section-title">Historial de Lecturas</h2>
          <div className="table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Vibraciones</th>
                  <th>Vibrando</th>
                  <th>Estado</th>
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
                      <td>{entry.vibCount}</td>
                      <td>{entry.vibrating ? '🔴 Sí' : '🟢 No'}</td>
                      <td className={getStateClass(entry.state)}>
                        {entry.state}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Student Info */}
        <section className="section">
          <div className="student-card">
            <h2 className="student-name">Pedro Javier Ramirez Ramirez</h2>
            <div className="metric-label">Matrícula</div>
            <div className="student-id">2023171040</div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;