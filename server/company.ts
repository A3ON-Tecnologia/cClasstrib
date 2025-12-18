import type { Request, Response } from "express";
import { pool } from "./db.js";
import type { AuthRequest } from "./auth.js";

interface Company {
  id: number;
  name: string;
  address: string | null;
  cnpj: string;
}

export async function ensureCompanyTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS companies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      address VARCHAR(500) NULL,
      cnpj VARCHAR(32) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  await pool.query(sql);
}

export async function createCompanyHandler(req: AuthRequest, res: Response) {
  try {
    const { name, address, cnpj } = req.body as {
      name?: string;
      address?: string;
      cnpj?: string;
    };

    if (!name || !cnpj) {
      return res
        .status(400)
        .json({ error: "Nome e CNPJ são obrigatórios." });
    }

    const trimmedName = name.trim();
    const trimmedCnpj = cnpj.trim();

    if (!trimmedName || !trimmedCnpj) {
      return res
        .status(400)
        .json({ error: "Nome e CNPJ são obrigatórios." });
    }

    const [result] = await pool.query(
      "INSERT INTO companies (name, address, cnpj) VALUES (?, ?, ?)",
      [trimmedName, address ?? null, trimmedCnpj],
    );

    const insertId = (result as any).insertId as number;

    return res.status(201).json({
      id: insertId,
      name: trimmedName,
      address: address ?? null,
      cnpj: trimmedCnpj,
    });
  } catch (err) {
    console.error("Erro ao criar empresa:", err);
    return res.status(500).json({ error: "Erro ao criar empresa." });
  }
}

export async function listCompaniesHandler(_req: Request, res: Response) {
  try {
    const [rows] = await pool.query<Company[]>(
      "SELECT id, name, address, cnpj FROM companies ORDER BY name ASC",
    );

    return res.json(rows);
  } catch (err) {
    console.error("Erro ao listar empresas:", err);
    return res.status(500).json({ error: "Erro ao listar empresas." });
  }
}

