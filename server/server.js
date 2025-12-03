const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mqtt = require('mqtt');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuración
const JWT_SECRET = process.env.JWT_SECRET || 'tu_secreto_super_seguro_cambialo';
const MQTT_CONFIG = {
  host: 'befdaf08.ala.us-east-1.emqxsl.com',
  port: 8883,
  protocol: 'mqtts',
  username: 'pepito',
  password: 'Fiyupanzona20'
};

// Middleware
app.use(cors());
app.use(express.json());

// Base de datos simulada
const users = [
  {
    id: 1,
    username: 'admin',
    // Password: "admin123" hasheado
    password: '$2a$10$8ZYW5N7qN0xZ8z9gJ3.xqOJ0v7V6q2ZwQ8ZWZ5N7qN0xZ8z9gJ3.x',
    role: 'admin'
  },
  {
    id: 2,
    username: 'operador',
    // Password: "oper123" hasheado
    password: '$2a$10$8ZYW5N7qN0xZ8z9gJ3.xqOJ0v7V6q2ZwQ8ZWZ5N7qN0xZ8z9gJ3.y',
    role: 'operator'
  }
];

// Almacenamiento de firmware
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './firmware';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `firmware_${timestamp}.bin`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.bin')) {
      cb(null, true);
    } else {
      cb(new Error('Solo archivos .bin permitidos'));
    }
  }
});

// autenticación de token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
    req.user = user;
    next();
  });
};

// Middleware de rol admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol admin' });
  }
  next();
};

// ==================== RUTAS ====================

// 1. LOGIN - Autenticación
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    const user = users.find(u => u.username === username);
    
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Verificar password
    const validPassword = password === 'admin123' && username === 'admin' ||
                          password === 'oper123' && username === 'operador';

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// 2. VERIFICAR TOKEN
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// 3. SUBIR FIRMWARE (Solo Admin)
app.post('/api/ota/upload', authenticateToken, requireAdmin, upload.single('firmware'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió archivo' });
    }

    const firmwareInfo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.user.username,
      path: `/api/ota/firmware/${req.file.filename}`
    };

    // Guardar metadata
    const metadataPath = path.join('./firmware', 'metadata.json');
    let metadata = [];
    
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }
    
    metadata.push(firmwareInfo);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    res.json({
      message: 'Firmware subido exitosamente',
      firmware: firmwareInfo
    });

  } catch (error) {
    console.error('Error subiendo firmware:', error);
    res.status(500).json({ error: 'Error subiendo firmware' });
  }
});

// 4. LISTAR FIRMWARES DISPONIBLES
app.get('/api/ota/list', authenticateToken, (req, res) => {
  try {
    const metadataPath = path.join('./firmware', 'metadata.json');
    
    if (!fs.existsSync(metadataPath)) {
      return res.json({ firmwares: [] });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    res.json({ firmwares: metadata });

  } catch (error) {
    console.error('Error listando firmwares:', error);
    res.status(500).json({ error: 'Error listando firmwares' });
  }
});

// 5. DESCARGAR FIRMWARE (Para ESP32)
app.get('/api/ota/firmware/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join('./firmware', filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Firmware no encontrado' });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error descargando firmware:', error);
    res.status(500).json({ error: 'Error descargando firmware' });
  }
});

// 6. TRIGGER OTA via MQTT (Solo Admin)
app.post('/api/ota/trigger', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { deviceId, firmwareFilename } = req.body;

    if (!deviceId || !firmwareFilename) {
      return res.status(400).json({ error: 'deviceId y firmwareFilename requeridos' });
    }

    // Construir URL del firmware
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${PORT}`;
    const firmwareUrl = `${baseUrl}/api/ota/firmware/${firmwareFilename}`;

    // Conectar a MQTT y enviar comando OTA
    const client = mqtt.connect(`${MQTT_CONFIG.protocol}://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}`, {
      username: MQTT_CONFIG.username,
      password: MQTT_CONFIG.password,
      clean: true
    });

    client.on('connect', () => {
      const topic = `${deviceId}/cmd`;
      const payload = JSON.stringify({
        action: 'ota',
        url: firmwareUrl
      });

      client.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) {
          console.error('Error publicando OTA:', err);
          client.end();
          return res.status(500).json({ error: 'Error enviando comando OTA' });
        }

        console.log(`✅ OTA enviado a ${deviceId}`);
        client.end();
        
        res.json({
          message: 'Comando OTA enviado exitosamente',
          device: deviceId,
          firmwareUrl
        });
      });
    });

    client.on('error', (err) => {
      console.error('Error MQTT:', err);
      res.status(500).json({ error: 'Error conectando a MQTT' });
    });

    // Timeout de 10 segundos
    setTimeout(() => {
      if (client.connected) {
        client.end();
      }
    }, 10000);

  } catch (error) {
    console.error('Error en trigger OTA:', error);
    res.status(500).json({ error: 'Error ejecutando OTA' });
  }
});

// 7. LOGS DE OTA (Simple)
app.get('/api/ota/logs', authenticateToken, (req, res) => {
  try {
    const logsPath = path.join('./firmware', 'ota_logs.json');
    
    if (!fs.existsSync(logsPath)) {
      return res.json({ logs: [] });
    }

    const logs = JSON.parse(fs.readFileSync(logsPath, 'utf8'));
    res.json({ logs });

  } catch (error) {
    console.error('Error obteniendo logs:', error);
    res.status(500).json({ error: 'Error obteniendo logs' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 API Server corriendo en http://localhost:${PORT}`);
  console.log(`📁 Firmwares en: ./firmware`);
  console.log(`🔐 JWT Secret: ${JWT_SECRET.substring(0, 10)}...`);
  console.log('\n📝 Usuarios de prueba:');
  console.log('   Admin: admin / admin123');
  console.log('   Operador: operador / oper123');
});

module.exports = app;