
import { pool } from "../server/db";

async function run() {
    try {
        const [rows] = await pool.query("SELECT COUNT(*) as count FROM upload_items");
        console.log("Row count:", rows);
    } catch (e) {
        console.error("Error counting rows:", e);
    } finally {
        process.exit();
    }
}

run();
