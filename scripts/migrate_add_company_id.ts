
import { pool } from "../server/db";

async function run() {
    try {
        console.log("Adding company_id column to upload_items...");
        // Add column with default value 1 for existing rows
        await pool.query("ALTER TABLE upload_items ADD COLUMN company_id INT NOT NULL DEFAULT 1 AFTER id");
        console.log("Column added. Adding foreign key constraint...");
        // Add foreign key
        await pool.query("ALTER TABLE upload_items ADD CONSTRAINT fk_upload_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE");

        // Optional: Remove default value if strictness is desired, but keeping it is also fine if we want a fallback. 
        // Usually better to remove default to force explicit insert, matching the CREATE definition.
        // await pool.query("ALTER TABLE upload_items ALTER COLUMN company_id DROP DEFAULT");

        console.log("Migration successful.");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        process.exit();
    }
}

run();
