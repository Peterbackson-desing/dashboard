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
  const otaLogRef = useRef(null);

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
    if (otaLogRef.current) {
      otaLogRef.current.scrollTop = 0;
    }
  }, [otaLog]);

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
            const isOtaMessage = msgStr.includes('[OTA]') || 
                                 msgStr.includes('OTA') || 
                                 msgStr.includes('Reboot') ||
                                 msgStr.includes('Reiniciando') ||
                                 msgStr.includes('firmware') ||
                                 msgStr.includes('Descarga') ||
                                 msgStr.includes('Validando') ||
                                 msgStr.includes('Progreso') ||
                                 msgStr.includes('Partición') ||
                                 msgStr.includes('KB') ||
                                 msgStr.includes('bytes') ||
                                 msgStr.includes('validado') ||
                                 msgStr.includes('completado') ||
                                 msgStr.includes('exitosamente') ||
                                 msgStr.includes('ERROR:') ||
                                 msgStr.includes('Conectando') ||
                                 msgStr.includes('Configurando');
            
            if (isOtaMessage) {
              setOtaLog(prev => {
                const newLog = [...prev, {
                  time: new Date().toLocaleTimeString(),
                  message: msgStr,
                  timestamp: Date.now()
                }];
                return newLog.slice(-50);
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
            const msgStr = message.toString();
            const isOtaMessage = msgStr.includes('[OTA]') || 
                                 msgStr.includes('OTA') || 
                                 msgStr.includes('Reboot') ||
                                 msgStr.includes('Reiniciando') ||
                                 msgStr.includes('firmware') ||
                                 msgStr.includes('Descarga') ||
                                 msgStr.includes('Validando') ||
                                 msgStr.includes('Progreso') ||
                                 msgStr.includes('Partición') ||
                                 msgStr.includes('KB') ||
                                 msgStr.includes('bytes') ||
                                 msgStr.includes('validado') ||
                                 msgStr.includes('completado') ||
                                 msgStr.includes('exitosamente') ||
                                 msgStr.includes('ERROR:') ||
                                 msgStr.includes('Conectando') ||
                                 msgStr.includes('Configurando');
            
            if (isOtaMessage) {
              setOtaLog(prev => {
                const newLog = [...prev, {
                  time: new Date().toLocaleTimeString(),
                  message: msgStr,
                  timestamp: Date.now()
                }];
                return newLog.slice(-50);
              });
            }
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
    setOtaLog(prev => {
      const newLog = [...prev, {
        time: new Date().toLocaleTimeString(),
        message: '📤 Comando OTA enviado desde dashboard',
        timestamp: Date.now()
      }];
      return newLog.slice(-50);
    });
  };

  const clearOtaLog = () => {
    if (window.confirm('¿Deseas limpiar el log de OTA?')) {
      setOtaLog([]);
    }
  };

  const getStateClass = (state) => {
    switch(state) {
      case 'NORMAL': return 'state-normal';
      case 'ALERT': return 'state-alert';
      case 'CRITICAL': return 'state-critical';
      default: return 'state-default';
    }
  };

  const getLogClass = (msg) => {
    if (msg.includes('') || msg.includes('completado') || msg.includes('exitosamente') || msg.includes('validado correctamente')) {
      return 'log-success';
    } else if (msg.includes('') || msg.includes('ERROR') || msg.includes('FAILED') || msg.includes('fallida') || msg.includes('corrupta')) {
      return 'log-error';
    } else if (msg.includes('') || msg.includes('WARNING') || msg.includes('abortado')) {
      return 'log-warning';
    } else if (msg.includes('') || msg.includes('Iniciando') || msg.includes('STARTED')) {
      return 'log-info';
    } else if (msg.includes('') || msg.includes('Progreso') || msg.includes('%')) {
      return 'log-progress';
    } else if (msg.includes('') || msg.includes('Reiniciando')) {
      return 'log-reboot';
    } else if (msg.includes('') || msg.includes('Tamaño') || msg.includes('📍') || msg.includes('📥')) {
      return 'log-data';
    } else if (msg.includes('') || msg.includes('Conectando')) {
      return 'log-connection';
    } else if (msg.includes('') || msg.includes('Validando')) {
      return 'log-validation';
    } else if (msg.includes('') || msg.includes('Configurando')) {
      return 'log-config';
    }
    return '';
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
              {theme === 'dark' ? ' Claro' : ' Oscuro'}
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
                {telemetry.vibrating_now ? ' Vibrando' : ' Reposo'}
              </div>
              <div className="metric-info">Sensor: {telemetry.sensor}</div>
            </div>

            <div className={`metric-card ${getStateClass(telemetry.state)}`}>
              <div className="metric-label">Estado del Sistema</div>
              <div className="metric-value">{telemetry.state || 'DESCONOCIDO'}</div>
              <div className="metric-info">
                Modo: {telemetry.manual ? 'Manual ' : 'Automático '}
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
                    Estado: {telemetry.led ? ' Encendido' : ' Apagado'}
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
                    Estado: {telemetry.relay ? ' Activado' : ' Desactivado'}
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
               Modo Automático
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => sendCommand('test_sequence')}
              disabled={connection !== 'connected'}
            >
               Secuencia de Prueba
            </button>
            <button
              className="btn btn-warning"
              onClick={() => sendCommand('reset_counter')}
              disabled={connection !== 'connected'}
            >
               Resetear Contador
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
               Iniciar Actualización OTA
            </button>
            <div className="warning-box">
               El dispositivo se reiniciará después de la actualización
            </div>
            
            {/* OTA Log */}
            {otaLog.length > 0 && (
              <div className="ota-log">
                <div className="ota-log-header">
                  <h3 className="ota-log-title"> Log de Actualización OTA</h3>
                  <button 
                    className="btn-clear-log"
                    onClick={clearOtaLog}
                    title="Limpiar log"
                  >
                     Limpiar
                  </button>
                </div>
                <div className="ota-log-content" ref={otaLogRef}>
                  {otaLog.slice().reverse().map((entry, idx) => (
                    <div 
                      key={entry.timestamp || idx} 
                      className={`ota-log-entry ${getLogClass(entry.message)}`}
                    >
                      <span className="ota-log-time">[{entry.time}]</span>
                      <span className="ota-log-message">{entry.message}</span>
                    </div>
                  ))}
                </div>
                <div className="ota-log-footer">
                  Total de mensajes: {otaLog.length}
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
                      <td>{entry.vibrating ? ' Sí' : ' No'}</td>
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