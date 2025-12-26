import * as fs from 'fs';
import path from 'path';
// @ts-ignore
import XLSX from 'xlsx';

const filePath = path.resolve('nbs.xlsx');
console.log('Reading:', filePath);

try {
    if (!fs.existsSync(filePath)) {
        console.error('File does not exist');
        process.exit(1);
    }
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    console.log('Sheet Names:', workbook.SheetNames);
    const sheetName = workbook.SheetNames[1];
    const sheet = workbook.Sheets[sheetName];
    const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];
    // Get first 10 rows
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }).slice(0, 10);
    fs.writeFileSync('nbs_rows.json', JSON.stringify(rows, null, 2));
    console.log('Written to nbs_rows.json');

    // const data = XLSX.utils.sheet_to_json(sheet)[0];
    // console.log('First row data:', JSON.stringify(data));
} catch (e) {
    console.error(e);
}
