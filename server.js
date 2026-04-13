const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Servir archivos estáticos (para la página web)
app.use(express.static('public'));

// Conectar a base de datos SQLite
const db = new sqlite3.Database('./carreras.db');

// Crear tabla si no existe
db.run(`
    CREATE TABLE IF NOT EXISTS tiempos (
        nombre TEXT PRIMARY KEY,
        mejor_vuelta TEXT,
        tiempo_total TEXT,
        coche TEXT,
        mapa TEXT,
        fecha_guardado DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`, (err) => {
    if (err) {
        console.error('Error creando tabla:', err);
    } else {
        console.log('✅ Base de datos lista');
    }
});

// ENDPOINT 1: Guardar tiempo (REPLACE si ya existe el nombre)
app.post('/save_time', (req, res) => {
    const { name, best_lap, total_time, car, map } = req.body;

    console.log(`📝 Guardando tiempo para: ${name}`);

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO tiempos (nombre, mejor_vuelta, tiempo_total, coche, mapa, fecha_guardado)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run([name, best_lap, total_time, car, map], function (err) {
        if (err) {
            console.error('Error guardando:', err);
            res.status(500).json({ error: err.message });
        } else {
            console.log(`✅ Tiempo de ${name} guardado correctamente`);
            res.json({
                success: true,
                message: `Tiempo guardado para ${name}`,
                changes: this.changes
            });
        }
    });

    stmt.finalize();
});

// ENDPOINT 2: Obtener todos los tiempos (ordenados por mejor vuelta)
app.get('/times', (req, res) => {
    // Convertir mejor_vuelta a segundos para ordenar correctamente
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

// ENDPOINT 3: Buscar por nombre
app.get('/search/:name', (req, res) => {
    const nombre = req.params.name;

    db.all(`
        SELECT * FROM tiempos 
        WHERE nombre LIKE ? 
        ORDER BY 
            CAST(substr(mejor_vuelta, 1, 2) AS INTEGER) * 60 + 
            CAST(substr(mejor_vuelta, 4, 6) AS REAL) ASC
    `, [`%${nombre}%`], (err, rows) => {
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
    console.log(`💾 Endpoint para guardar: http://localhost:${PORT}/save_time`);
});