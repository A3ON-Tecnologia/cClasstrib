
import { pool } from '../server/db';

async function test() {
    try {
        const [rows] = await pool.query('SELECT 1 as val');
        console.log('Connection successful:', rows);
        process.exit(0);
    } catch (err) {
        console.error('Connection failed:', err);
        process.exit(1);
    }
}

test();
