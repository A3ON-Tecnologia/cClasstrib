
import { pool } from '../server/db';

async function verify() {
    try {
        const [rows]: any = await pool.query('SELECT COUNT(*) as count FROM nbs');
        console.log('NBS Table Count:', rows[0].count);
        const [sample] = await pool.query('SELECT * FROM nbs LIMIT 1');
        console.log('Sample:', JSON.stringify(sample, null, 2));
        process.exit(0);
    } catch (err) {
        console.error('Verify failed:', err);
        process.exit(1);
    }
}

verify();
