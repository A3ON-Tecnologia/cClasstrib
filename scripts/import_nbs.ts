
import { pool } from '../server/db';
// @ts-ignore
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Handling __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const excelPath = path.resolve(__dirname, '../nbs.xlsx');

async function importNBS() {
    console.log('Starting NBS import...');
    if (!fs.existsSync(excelPath)) {
        console.error('nbs.xlsx not found at', excelPath);
        process.exit(1);
    }

    try {
        // 1. Create Table (and Truncate)
        console.log('Ensuring table exists...');
        const createTableQuery = `
      CREATE TABLE IF NOT EXISTS nbs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nbs_code VARCHAR(50) NOT NULL,
        descricao_nbs TEXT,
        item_lc_116 VARCHAR(50),
        descricao_item TEXT,
        ps_onerosa VARCHAR(10),
        adq_exterior VARCHAR(10),
        indop VARCHAR(50),
        local_incidencia VARCHAR(255),
        c_class_trib VARCHAR(50),
        nome_c_class_trib TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

        await pool.query(createTableQuery);
        console.log('Truncating table...');
        await pool.query('TRUNCATE TABLE nbs');

        // 2. Read Excel
        console.log('Reading Excel file...');
        const fileBuffer = fs.readFileSync(excelPath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        // Use the second sheet based on inspection
        const sheetName = workbook.SheetNames[1];
        const sheet = workbook.Sheets[sheetName];

        // Get all rows including header
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        console.log(`Found ${rows.length} rows.`);

        let lastItemLC116: any = null;
        let lastDescItem: any = null;
        let lastNbsCode: any = null;
        let lastDescNbs: any = null;

        let lastPsOnerosa: any = null;
        let lastAdqExterior: any = null;
        let lastIndop: any = null;
        let lastLocalIncidencia: any = null;
        let lastCClassTrib: any = null;
        let lastNomeCClassTrib: any = null;

        let count = 0;

        // Start from row 1 (skipping header at row 0)
        for (let i = 1; i < rows.length; i++) {
            const row: any = rows[i];
            if (!row || row.length === 0) continue;

            let item_lc_116 = row[0];
            let descricao_item = row[1];
            let nbs_code = row[2];
            let descricao_nbs = row[3];
            let ps_onerosa = row[4];
            let adq_exterior = row[5];
            let indop = row[6] ? String(row[6]) : null;
            let local_incidencia = row[7];
            let c_class_trib = row[8] ? String(row[8]) : null;
            let nome_c_class_trib = row[9];

            // Fill down logic for LC 116
            if (item_lc_116) lastItemLC116 = item_lc_116;
            else item_lc_116 = lastItemLC116;

            if (descricao_item) lastDescItem = descricao_item;
            else descricao_item = lastDescItem;

            // Fill down logic for NBS
            if (nbs_code) {
                lastNbsCode = nbs_code;
                lastDescNbs = descricao_nbs;

                // Reset sub-level grouping variables when NBS changes? 
                // The user request says "insira sempre igual ao anterior preenchido e só altere quando chegar em outro codigo ddiferente"    
                // This implies distinct sub-blocks. 
                // We should probably NOT reset them automatically if the visual block spans multiple valid NBS rows?
                // But usually, one property applies to the whole visual block.
                // If visual block spans across multiple rows, empty cells mean "same as above".
                // I will keep the "last known value" logic for everything.
            } else {
                nbs_code = lastNbsCode;
                descricao_nbs = lastDescNbs;
            }

            // Fill down other columns
            if (ps_onerosa) lastPsOnerosa = ps_onerosa; else ps_onerosa = lastPsOnerosa;
            if (adq_exterior) lastAdqExterior = adq_exterior; else adq_exterior = lastAdqExterior;
            if (indop) lastIndop = indop; else indop = lastIndop;
            if (local_incidencia) lastLocalIncidencia = local_incidencia; else local_incidencia = lastLocalIncidencia;
            if (c_class_trib) { lastCClassTrib = c_class_trib; lastNomeCClassTrib = nome_c_class_trib; }
            else { c_class_trib = lastCClassTrib; nome_c_class_trib = lastNomeCClassTrib; }

            // Skip if we STILL don't have an NBS code (e.g. initial empty rows)
            if (!nbs_code) {
                continue;
            }

            // Also ensure we have a cClassTrib to treat this as a valid row worth importing
            // Wait, user says 1.1502.90.00 can be 200043 and 200044. 
            // If a row has NBS code (filled down) and cClassTrib, we insert.
            // If it has NO cClassTrib, we might skip or insert depending on if it's a header row.
            // But typically every valid row in this specific sheet layout seems to eventually map to a cClassTrib or be one of the options.
            // Let's insert everything that has an NBS code.

            // Insert
            const insertQuery = `
        INSERT INTO nbs 
        (nbs_code, descricao_nbs, item_lc_116, descricao_item, ps_onerosa, adq_exterior, indop, local_incidencia, c_class_trib, nome_c_class_trib)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

            await pool.query(insertQuery, [
                nbs_code,
                descricao_nbs,
                item_lc_116,
                descricao_item,
                ps_onerosa,
                adq_exterior,
                indop,
                local_incidencia,
                c_class_trib,
                nome_c_class_trib
            ]);

            count++;
            if (count % 100 === 0) console.log(`Inserted ${count} rows...`);
        }

        console.log(`Successfully inserted ${count} rows.`);
        process.exit(0);

    } catch (error: any) {
        console.error('Error importing NBS:', error);
        if (error.code) console.error('Error code:', error.code);
        if (error.sqlMessage) console.error('SQL Message:', error.sqlMessage);
        if (error.sql) console.error('SQL:', error.sql);
        process.exit(1);
    }
}

importNBS();
