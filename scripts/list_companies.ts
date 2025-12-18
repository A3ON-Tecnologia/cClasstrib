
import { pool } from "../server/db";

async function run() {
    try {
        const [rows] = await pool.query("SELECT * FROM companies");
        console.log("Companies:", rows);
    } catch (e) {
        if ((e as any).code === 'ER_NO_SUCH_TABLE') {
            console.log("Table companies does not exist or empty");
        } else {
            console.error("Error listing companies:", e);
        }
    } finally {
        process.exit();
    }
}

run();
