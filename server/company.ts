import type { Response } from "express";
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

export async function ensureUserCompanyTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS user_companies (
      user_id INT NOT NULL,
      company_id INT NOT NULL,
      PRIMARY KEY (user_id, company_id),
      CONSTRAINT fk_uc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_uc_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
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

export async function updateCompanyHandler(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "ID de empresa inválido." });
    }

    const { name, address, cnpj } = req.body as {
      name?: string;
      address?: string | null;
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
      "UPDATE companies SET name = ?, address = ?, cnpj = ? WHERE id = ?",
      [trimmedName, address ?? null, trimmedCnpj, id],
    );

    const changed =
      typeof (result as any).affectedRows === "number"
        ? (result as any).affectedRows
        : 0;

    if (changed === 0) {
      return res.status(404).json({ error: "Empresa não encontrada." });
    }

    return res.status(200).json({
      id,
      name: trimmedName,
      address: address ?? null,
      cnpj: trimmedCnpj,
    });
  } catch (err) {
    console.error("Erro ao atualizar empresa:", err);
    return res.status(500).json({ error: "Erro ao atualizar empresa." });
  }
}

export async function listCompaniesHandler(req: AuthRequest, res: Response) {
  try {
    const isAdmin = !!req.user?.is_admin;
    const userId = req.user?.id;

    const [rows] = await pool.query<Company[]>(
      isAdmin
        ? "SELECT id, name, address, cnpj FROM companies ORDER BY name ASC"
        : `
        SELECT c.id, c.name, c.address, c.cnpj
        FROM companies c
        INNER JOIN user_companies uc ON uc.company_id = c.id
        WHERE uc.user_id = ?
        ORDER BY c.name ASC
      `,
      isAdmin ? [] : [userId],
    );

    return res.json(rows);
  } catch (err) {
    console.error("Erro ao listar empresas:", err);
    return res.status(500).json({ error: "Erro ao listar empresas." });
  }
}

export async function linkUserCompanyHandler(req: AuthRequest, res: Response) {
  try {
    const { user_id, company_id } = req.body as {
      user_id?: number;
      company_id?: number;
    };

    if (!user_id || !company_id) {
      return res
        .status(400)
        .json({ error: "user_id e company_id são obrigatórios." });
    }

    await pool.query(
      "INSERT IGNORE INTO user_companies (user_id, company_id) VALUES (?, ?)",
      [user_id, company_id],
    );

    return res.status(204).send();
  } catch (err) {
    console.error("Erro ao vincular usuário à empresa:", err);
    return res
      .status(500)
      .json({ error: "Erro ao vincular usuário à empresa." });
  }
}

export async function unlinkUserCompanyHandler(req: AuthRequest, res: Response) {
  try {
    const { user_id, company_id } = req.body as {
      user_id?: number;
      company_id?: number;
    };

    if (!user_id || !company_id) {
      return res
        .status(400)
        .json({ error: "user_id e company_id são obrigatórios." });
    }

    const [result] = await pool.query(
      "DELETE FROM user_companies WHERE user_id = ? AND company_id = ?",
      [user_id, company_id],
    );

    const removed =
      typeof (result as any).affectedRows === "number"
        ? (result as any).affectedRows
        : 0;

    return res.status(200).json({ removed });
  } catch (err) {
    console.error("Erro ao remover associação usuário × empresa:", err);
    return res
      .status(500)
      .json({ error: "Erro ao remover associação usuário × empresa." });
  }
}
