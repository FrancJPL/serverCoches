const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Servir archivos estáticos (para la página web)
app.use(express.static('public'));

// Conectar a base de datos SQLite
const db = new sqlite3.Database('./carreras.db');

// Crear tablas si no existen
db.serialize(() => {
    // Tabla de tiempos
    db.run(`
        CREATE TABLE IF NOT EXISTS tiempos (
            nombre TEXT PRIMARY KEY,
            mejor_vuelta TEXT,
            tiempo_total TEXT,
            coche TEXT,
            mapa TEXT,
            fecha_guardado DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabla de usuarios
    db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT UNIQUE,
            password TEXT,
            status INTEGER DEFAULT 0
        )
    `);
});

// Helper para convertir tiempo MM:SS.sss a segundos
function timeToSeconds(timeStr) {
    if (!timeStr) return 999999;
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 999999;
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
}

// --- ENDPOINTS DE USUARIOS ---

// Registro de usuario
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const stmt = db.prepare(`INSERT INTO usuarios (nombre, password) VALUES (?, ?)`);
        
        stmt.run([username, hashedPassword], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'El nombre de usuario ya existe' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.json({ success: true, message: 'Usuario registrado correctamente' });
        });
        stmt.finalize();
    } catch (error) {
        res.status(500).json({ error: 'Error al procesar el registro' });
    }
});

// Login de usuario
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get(`SELECT * FROM usuarios WHERE nombre = ?`, [username], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Contraseña incorrecta' });

        // Cambiar status a 1
        db.run(`UPDATE usuarios SET status = 1 WHERE id = ?`, [user.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'Sesión iniciada', username: user.nombre });
        });
    });
});

// Logout de usuario
app.post('/logout', (req, res) => {
    const { username } = req.body;
    db.run(`UPDATE usuarios SET status = 0 WHERE nombre = ?`, [username], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Sesión cerrada' });
    });
});

// --- ENDPOINTS DE TIEMPOS ---

// Guardar tiempo (Solo si mejoró su marca y está logueado)
app.post('/save_time', (req, res) => {
    const { name, best_lap, total_time, car, map } = req.body;

    // 1. Verificar si el usuario está logueado (status = 1)
    db.get(`SELECT status FROM usuarios WHERE nombre = ?`, [name], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!user || user.status !== 1) {
            return res.status(403).json({ error: 'Debes iniciar sesión para guardar tiempos' });
        }

        // 2. Obtener el tiempo actual (si existe)
        db.get(`SELECT mejor_vuelta FROM tiempos WHERE nombre = ?`, [name], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });

            const newTimeSec = timeToSeconds(best_lap);
            const oldTimeSec = row ? timeToSeconds(row.mejor_vuelta) : 999999;

            // 3. Solo guardar si el nuevo tiempo es MEJOR (menor)
            if (newTimeSec < oldTimeSec) {
                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO tiempos (nombre, mejor_vuelta, tiempo_total, coche, mapa, fecha_guardado)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `);

                stmt.run([name, best_lap, total_time, car, map], function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                    } else {
                        res.json({
                            success: true,
                            message: `¡Nuevo récord para ${name}!`,
                            isNewRecord: true
                        });
                    }
                });
                stmt.finalize();
            } else {
                res.json({
                    success: false,
                    message: 'No has superado tu récord personal',
                    isNewRecord: false
                });
            }
        });
    });
});

// Obtener todos los tiempos (ordenados por mejor vuelta)
app.get('/times', (req, res) => {
    db.all(`
        SELECT * FROM tiempos 
        ORDER BY 
            CAST(substr(mejor_vuelta, 1, 2) AS INTEGER) * 60 + 
            CAST(substr(mejor_vuelta, 4, 6) AS REAL) ASC
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📊 Ver ranking: http://localhost:${PORT}/ranking.html`);
});