import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { ResultSetHeader } from "mysql2";
import { pool } from "./db.js";

interface User {
  id: number;
  username: string;
  password_hash: string;
  is_admin: number;
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = "8h";

export async function ensureUserTable() {
  const createSql = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      is_admin TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  await pool.query(createSql);
}

export async function ensureAdminUser() {
  const defaultUser = process.env.ADMIN_USER || "admin";
  const defaultPass = process.env.ADMIN_PASSWORD || "admin123";

  const [rows] = await pool.query<User[]>(
    "SELECT id FROM users WHERE username = ? LIMIT 1",
    [defaultUser],
  );

  if (rows.length > 0) return;

  const password_hash = await bcrypt.hash(defaultPass, 10);

  await pool.query(
    "INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)",
    [defaultUser, password_hash],
  );

  console.log(
    `Usuário administrador padrão criado: ${defaultUser} / ${defaultPass}`,
  );
}

export async function loginHandler(req: Request, res: Response) {
  try {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Usuário e senha são obrigatórios." });
    }

    const [rows] = await pool.query<User[]>(
      "SELECT * FROM users WHERE username = ? LIMIT 1",
      [username],
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Usuário ou senha inválidos." });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      return res.status(401).json({ error: "Usuário ou senha inválidos." });
    }

    const token = jwt.sign(
      { sub: user.id, username: user.username, is_admin: !!user.is_admin },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        is_admin: !!user.is_admin,
      },
    });
  } catch (err) {
    console.error("Erro no login:", err);
    return res.status(500).json({ error: "Erro ao realizar login." });
  }
}

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    is_admin: boolean;
  };
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não informado." });
  }

  const token = auth.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      sub: number;
      username: string;
      is_admin: boolean;
    };

    req.user = {
      id: payload.sub,
      username: payload.username,
      is_admin: payload.is_admin,
    };

    return next();
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
}

export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: "Acesso restrito a administradores." });
  }
  return next();
}

export async function createUserHandler(req: AuthRequest, res: Response) {
  try {
    const { username, password, is_admin } = req.body as {
      username?: string;
      password?: string;
      is_admin?: boolean;
    };

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Usuário e senha são obrigatórios." });
    }

    const [existing] = await pool.query<User[]>(
      "SELECT id FROM users WHERE username = ? LIMIT 1",
      [username],
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "Usuário já existe." });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const isAdminFlag = is_admin ? 1 : 0;

    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)",
      [username, password_hash, isAdminFlag],
    );

    return res.status(201).json({
      id: result.insertId,
      username,
      is_admin: !!isAdminFlag,
    });
  } catch (err) {
    console.error("Erro ao criar usuário:", err);
    return res.status(500).json({ error: "Erro ao criar usuário." });
  }
}

export async function listUsersHandler(req: AuthRequest, res: Response) {
  try {
    const search = String(req.query.q ?? "").trim();
    const like = `%${search}%`;

    const [rows] = await pool.query<User[]>(
      search
        ? "SELECT id, username, is_admin, created_at FROM users WHERE username LIKE ? ORDER BY username ASC"
        : "SELECT id, username, is_admin, created_at FROM users ORDER BY username ASC",
      search ? [like] : [],
    );

    return res.json(
      rows.map((u) => ({
        id: u.id,
        username: u.username,
        is_admin: !!u.is_admin,
      })),
    );
  } catch (err) {
    console.error("Erro ao listar usuários:", err);
    return res.status(500).json({ error: "Erro ao listar usuários." });
  }
}
