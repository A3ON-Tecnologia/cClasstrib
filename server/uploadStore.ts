import { pool } from "./db.js";
import type { TabelaItem } from "./types.js";

export async function ensureUploadItemsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS upload_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      ncm VARCHAR(20) NOT NULL,
      cfop VARCHAR(20) NOT NULL,
      cclasstrib_sugerido VARCHAR(20) NULL,
      qtd_registros INT NOT NULL,
      status VARCHAR(20) NOT NULL,
      descricao TEXT,
      nome_produto VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_upload_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  await pool.query(sql);
}

export async function saveUploadItems(
  items: TabelaItem[],
  companyId: number,
) {
  if (!items.length) return;

  const values = items.map((item) => [
    companyId,
    item.ncm,
    item.cfop,
    item.cClasstrib_sugerido,
    item.qtd_registros,
    item.status,
    item.descricao,
    item.nome_produto,
  ]);

  await pool.query(
    `
    INSERT INTO upload_items (
      company_id,
      ncm,
      cfop,
      cclasstrib_sugerido,
      qtd_registros,
      status,
      descricao,
      nome_produto
    ) VALUES ?
  `,
    [values],
  );
}

export async function getLastUploadItemsForCompany(
  companyId: number,
): Promise<TabelaItem[]> {
  const [rows] = await pool.query<
    {
      ncm: string;
      cfop: string;
      cclasstrib_sugerido: string | null;
      qtd_registros: number;
      status: string;
      descricao: string;
      nome_produto: string;
      created_at: Date;
    }[]
  >(
    `
    SELECT ui.ncm,
           ui.cfop,
           ui.cclasstrib_sugerido,
           ui.qtd_registros,
           ui.status,
           ui.descricao,
           ui.nome_produto
    FROM upload_items ui
    WHERE ui.company_id = ?
      AND ui.created_at = (
        SELECT MAX(created_at) FROM upload_items WHERE company_id = ?
      )
  `,
    [companyId, companyId],
  );

  return rows.map((r) => ({
    ncm: r.ncm,
    cfop: r.cfop,
    cClasstrib_sugerido: r.cclasstrib_sugerido,
    qtd_registros: r.qtd_registros,
    status: r.status,
    descricao: r.descricao,
    nome_produto: r.nome_produto,
  }));
}
