const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

const db = new sqlite3.Database('./fallout4.db', (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to SQLite database.');
    }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


function runQuery(sql, params = []) {
    console.log("RUNNING SQL:\n", sql);
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
        });
    });
}

function allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

async function initializeDatabase() {
    await runQuery(`PRAGMA foreign_keys = ON`);

    await runQuery(`
        CREATE TABLE IF NOT EXISTS settlements (
            settlement_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            region TEXT
        )
    `);

    await runQuery(`
        CREATE TABLE IF NOT EXISTS factions (
            faction_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    `);

    await runQuery(`
        CREATE TABLE IF NOT EXISTS item_types (
            item_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    `);

    await runQuery(`
        CREATE TABLE IF NOT EXISTS supply_runs (
            run_id INTEGER PRIMARY KEY AUTOINCREMENT,
            settlement_id INTEGER NOT NULL,
            faction_id INTEGER NOT NULL,
            item_type_id INTEGER NOT NULL,
            run_date TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            cap_cost REAL NOT NULL,
            notes TEXT,
            FOREIGN KEY (settlement_id) REFERENCES settlements(settlement_id),
            FOREIGN KEY (faction_id) REFERENCES factions(faction_id),
            FOREIGN KEY (item_type_id) REFERENCES item_types(item_type_id)
        )
    `);

    const settlementCount = await getQuery(`SELECT COUNT(*) AS count FROM settlements`);
    const factionCount = await getQuery(`SELECT COUNT(*) AS count FROM factions`);
    const itemTypeCount = await getQuery(`SELECT COUNT(*) AS count FROM item_types`);
    const runCount = await getQuery(`SELECT COUNT(*) AS count FROM supply_runs`);

    if (settlementCount.count === 0) {
        const settlements = [
        ['Sanctuary Hills', 'Commonwealth Northwest'],
        ['The Castle', 'Boston Coast'],
        ['Red Rocket Truck Stop', 'Northern Commonwealth'],
        ['Abernathy Farm', 'Western Commonwealth'],
        ['Starlight Drive-In', 'Central Commonwealth']
        ];

        for (const [name, region] of settlements) {
        await runQuery(`INSERT INTO settlements (name, region) VALUES (?, ?)`, [name, region]);
        }
    }

    if (factionCount.count === 0) {
        const factions = ['Minutemen', 'Brotherhood of Steel', 'Railroad', 'Institute'];
        for (const name of factions) {
        await runQuery(`INSERT INTO factions (name) VALUES (?)`, [name]);
        }
    }

    if (itemTypeCount.count === 0) {
        const itemTypes = ['Food', 'Water', 'Ammo', 'Medicine', 'Junk'];
        for (const name of itemTypes) {
        await runQuery(`INSERT INTO item_types (name) VALUES (?)`, [name]);
        }
    }

    if (runCount.count === 0) {
        await runQuery(`
            INSERT INTO supply_runs (settlement_id, faction_id, item_type_id, run_date, quantity, cap_cost, notes)
            VALUES
            (1, 1, 1, '2026-03-01', 40, 120, 'Corn and mutfruit delivery'),
            (2, 2, 3, '2026-03-05', 75, 300, 'Ammo shipment for Sanctuary defense'),
            (3, 1, 2, '2026-03-07', 60, 150, 'Purified water run'),
            (4, 3, 4, '2026-03-10', 20, 220, 'Stimpak resupply'),
            (5, 4, 5, '2026-03-14', 90, 180, 'Building materials and scrap')
        `);
    }

}

app.get('/api/lookups', async (req, res) => {
    try {
        const settlements = await allQuery(`SELECT * FROM settlements ORDER BY name`);
        const factions = await allQuery(`SELECT * FROM factions ORDER BY name`);
        const itemTypes = await allQuery(`SELECT * FROM item_types ORDER BY name`);
        res.json({ settlements, factions, itemTypes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/supply-runs', async (req, res) => {
    try {
        const rows = await allQuery(`
        SELECT
            sr.run_id,
            sr.run_date,
            sr.quantity,
            sr.cap_cost,
            sr.notes,
            s.settlement_id,
            s.name AS settlement_name,
            f.faction_id,
            f.name AS faction_name,
            i.item_type_id,
            i.name AS item_type_name
        FROM supply_runs sr
        JOIN settlements s ON sr.settlement_id = s.settlement_id
        JOIN factions f ON sr.faction_id = f.faction_id
        JOIN item_types i ON sr.item_type_id = i.item_type_id
        ORDER BY sr.run_date DESC, sr.run_id DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/supply-runs', async (req, res) => {
    try {
        const { settlement_id, faction_id, item_type_id, run_date, quantity, cap_cost, notes } = req.body;

        await runQuery(
        `INSERT INTO supply_runs (settlement_id, faction_id, item_type_id, run_date, quantity, cap_cost, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [settlement_id, faction_id, item_type_id, run_date, quantity, cap_cost, notes || '']
        );

        res.json({ message: 'Supply run added successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/supply-runs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { settlement_id, faction_id, item_type_id, run_date, quantity, cap_cost, notes } = req.body;

        await runQuery(
        `UPDATE supply_runs
        SET settlement_id = ?, faction_id = ?, item_type_id = ?, run_date = ?, quantity = ?, cap_cost = ?, notes = ?
        WHERE run_id = ?`,
        [settlement_id, faction_id, item_type_id, run_date, quantity, cap_cost, notes || '', id]
        );

        res.json({ message: 'Supply run updated successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/supply-runs/:id', async (req, res) => {
    try {
        await runQuery(`DELETE FROM supply_runs WHERE run_id = ?`, [req.params.id]);
        res.json({ message: 'Supply run deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settlements', async (req, res) => {
    try {
        const { name, region } = req.body;
        await runQuery(`INSERT INTO settlements (name, region) VALUES (?, ?)`, [name, region || '']);
        res.json({ message: 'Settlement added successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/factions', async (req, res) => {
    try {
        const { name } = req.body;
        await runQuery(`INSERT INTO factions (name) VALUES (?)`, [name]);
        res.json({ message: 'Faction added successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/item-types', async (req, res) => {
    try {
        const { name } = req.body;
        await runQuery(`INSERT INTO item_types (name) VALUES (?)`, [name]);
        res.json({ message: 'Item type added successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/report', async (req, res) => {
    try {
        const { settlement_id, faction_id, start_date, end_date } = req.query;

        let sql = `
        SELECT
            sr.run_id,
            sr.run_date,
            s.name AS settlement_name,
            f.name AS faction_name,
            i.name AS item_type_name,
            sr.quantity,
            sr.cap_cost,
            sr.notes
        FROM supply_runs sr
        JOIN settlements s ON sr.settlement_id = s.settlement_id
        JOIN factions f ON sr.faction_id = f.faction_id
        JOIN item_types i ON sr.item_type_id = i.item_type_id
        WHERE 1 = 1
        `;

        const params = [];
    
        if (settlement_id) {
            sql += ` AND sr.settlement_id = ?`;
            params.push(settlement_id);
        }

        if (faction_id) {
            sql += ` AND sr.faction_id = ?`;
            params.push(faction_id);
        }

        if (start_date) {
            sql += ` AND sr.run_date >= ?`;
            params.push(start_date);
        }

        if (end_date) {
            sql += ` AND sr.run_date <= ?`;
            params.push(end_date);
        }

        sql += ` ORDER BY sr.run_date ASC`;

        const rows = await allQuery(sql, params);

        const stats = {
            total_runs: rows.length,
            avg_quantity: rows.length ? (rows.reduce((sum, row) => sum + row.quantity, 0) / rows.length).toFixed(2) : '0.00',
            avg_cap_cost: rows.length ? (rows.reduce((sum, row) => sum + row.cap_cost, 0) / rows.length).toFixed(2) : '0.00',
            total_quantity: rows.reduce((sum, row) => sum + row.quantity, 0),
            total_cap_cost: rows.reduce((sum, row) => sum + row.cap_cost, 0).toFixed(2)
        };

        res.json({ rows, stats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server running at http.//localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Database initialization failed:', err.message);
    });