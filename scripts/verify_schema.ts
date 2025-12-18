
import { pool } from "../server/db";
import fs from 'fs';
import path from 'path';

async function run() {
    try {
        const [rows] = await pool.query("DESCRIBE upload_items");
        console.log("Columns:", JSON.stringify(rows, null, 2));
        fs.writeFileSync(path.resolve(process.cwd(), 'schema_info.txt'), JSON.stringify(rows, null, 2));
    } catch (e) {
        console.error("Error describing table:", e);
        fs.writeFileSync(path.resolve(process.cwd(), 'schema_info.txt'), "Error: " + e);
    } finally {
        process.exit();
    }
}

run();
