
import { Request, Response } from "express";
import { pool } from "./db.js";

interface NBSQuery extends Record<string, any> {
    q?: string;
    limit?: string;
    page?: string;
}

export const listNbsHandler = async (req: Request, res: Response) => {
    try {
        const { q, limit = "50", page = "1" } = req.query as NBSQuery;

        // Pagination
        const limitNum = Math.max(1, Math.min(100, Number(limit)));
        const pageNum = Math.max(1, Number(page));
        const offset = (pageNum - 1) * limitNum;

        let searchClause = "";
        const queryParams: any[] = [];

        if (q) {
            const searchTerm = `%${q}%`;
            searchClause = `
        WHERE nbs_code LIKE ?
        OR descricao_nbs LIKE ?
        OR item_lc_116 LIKE ?
        OR descricao_item LIKE ?
      `;
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        // Count total for pagination
        const countSql = `SELECT COUNT(*) as total FROM nbs ${searchClause}`;
        const [countRows]: any = await pool.query(countSql, queryParams);
        const total = countRows[0].total;

        // Fetch data
        const sql = `
      SELECT * FROM nbs
      ${searchClause}
      ORDER BY item_lc_116 ASC, nbs_code ASC
      LIMIT ? OFFSET ?
    `;

        // Adding limit and offset to params
        queryParams.push(limitNum, offset);

        const [rows] = await pool.query(sql, queryParams);

        return res.json({
            data: rows,
            meta: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum)
            }
        });

    } catch (error) {
        console.error("Error listing NBS:", error);
        return res.status(500).json({ error: "Erro ao buscar dados NBS table." });
    }
};
