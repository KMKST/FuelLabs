const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// MySQL connection configuration
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '', // Domyślne w XAMPP to puste pole
    database: 'fuel_labs',
    port: 3306
};

// Initialize Database connection pool
let pool;

async function initDB() {
    try {
        // First connect without database to create it if it doesn't exist
        const connection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password,
            port: dbConfig.port
        });

        await connection.query('CREATE DATABASE IF NOT EXISTS fuel_labs');
        await connection.query('USE fuel_labs');

        // Create Users table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create Cart Items table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS cart_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                product_id INT NOT NULL,
                quantity INT DEFAULT 1,
                FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
            )
        `);

        console.log('Database and tables initialized successfully!');

        // Create connection pool
        pool = mysql.createPool(dbConfig);
    } catch (error) {
        console.error('Error initializing database! Please check XAMPP and your credentials.', error);
        process.exit(1);
    }
}

// Routes

// Register new user
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

        const [existingUser] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (existingUser.length > 0) return res.status(400).json({ error: 'Username already exists' });

        await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, password]);
        res.json({ message: 'User registered successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const [users] = await pool.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);

        if (users.length === 0) return res.status(400).json({ error: 'Invalid username or password' });

        res.json({ message: 'Login successful', username });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user cart
app.get('/api/cart/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const [items] = await pool.query('SELECT product_id FROM cart_items WHERE username = ?', [username]);

        // We just return array of product IDs that are in the cart
        const productIds = items.map(item => item.product_id);
        res.json(productIds);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Save user cart (Replace entirely)
app.post('/api/cart/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const { productIds } = req.body; // Array of product IDs

        // Clear existing cart
        await pool.query('DELETE FROM cart_items WHERE username = ?', [username]);

        // Insert new items
        if (productIds && productIds.length > 0) {
            const values = productIds.map(id => [username, id]);
            await pool.query('INSERT INTO cart_items (username, product_id) VALUES ?', [values]);
        }

        res.json({ message: 'Cart saved successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = 3000;
app.listen(PORT, async () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    await initDB();
});
