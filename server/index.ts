import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import * as XLSX from "xlsx";

interface TabelaItem {
  ncm: string;
  cfop: string;
  cClasstrib_sugerido: string | null;
  qtd_registros: number;
  status: string;
  descricao: string;
  nome_produto: string;
}

interface CasoAusente {
  ncm: string;
  cfop: string;
  qtd_registros: number;
  descricao: string;
}

interface DadosJson {
  tabela_consolidada: TabelaItem[];
  casos_ausentes: CasoAusente[];
  resumo: {
    total_combinacoes: number;
    total_ok: number;
    total_ausente: number;
    total_multiplo: number;
    total_cfop_na: number;
  };
  empresa?: {
    nome: string;
    cnpj: string;
  };
  cfops_na: string[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  const upload = multer({ storage: multer.memoryStorage() });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Upload de planilha XLSX e conversão para o formato esperado pelo frontend
  app.post(
    "/upload",
    upload.single("file"),
    (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "Nenhum arquivo enviado." });
        }

        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: null,
        });

        const normalizeKey = (key: string) =>
          key.toLowerCase().replace(/[^a-z0-9]/g, "");

        const tabela_consolidada: TabelaItem[] = rows
          .map((row) => {
            const mapped: Record<string, unknown> = {};

            Object.entries(row).forEach(([key, value]) => {
              const k = normalizeKey(key);
              mapped[k] = value;
            });

            const ncm = String(
              mapped["ncm"] ?? mapped["codigoncm"] ?? ""
            ).trim();
            const cfop = String(
              mapped["cfop"] ?? mapped["codigocfop"] ?? ""
            ).trim();

            if (!ncm || !cfop) return null;

            const cClasstribRaw =
              mapped["cclasstrib_sugerido"] ??
              mapped["cclasstribsugerido"] ??
              mapped["cclasstrib"] ??
              null;

            const status =
              String(mapped["status"] ?? "").trim().toUpperCase() || "OK";

            const qtd_registrosNumber = Number(
              mapped["qtd_registros"] ?? mapped["qtdregistros"] ?? 1
            );

            const descricao =
              String(mapped["descricao"] ?? mapped["descricaoproduto"] ?? "")
                .trim() || "";

            const nome_produto =
              String(mapped["nome_produto"] ?? mapped["nomeproduto"] ?? "")
                .trim() || descricao;

            const item: TabelaItem = {
              ncm,
              cfop,
              cClasstrib_sugerido:
                cClasstribRaw === null || cClasstribRaw === ""
                  ? null
                  : String(cClasstribRaw).trim(),
              qtd_registros: Number.isFinite(qtd_registrosNumber)
                ? qtd_registrosNumber
                : 1,
              status,
              descricao,
              nome_produto,
            };

            return item;
          })
          .filter((item): item is TabelaItem => item !== null);

        const casos_ausentes: CasoAusente[] = tabela_consolidada
          .filter((item) => item.status === "AUSENTE")
          .map((item) => ({
            ncm: item.ncm,
            cfop: item.cfop,
            qtd_registros: item.qtd_registros,
            descricao: item.descricao,
          }));

        const total_combinacoes = tabela_consolidada.length;

        // total_ausente: quantos registros não tiveram cClasstrib encontrado (N/A)
        const cfopsSemCclasstrib = new Set<string>();
        const total_ausente = tabela_consolidada.filter((item) => {
          const valor = item.cClasstrib_sugerido;
          const naoTem =
            !valor || String(valor).trim().toUpperCase() === "N/A";

          if (naoTem) {
            // Agrupado por CFOP apenas (independente do NCM)
            cfopsSemCclasstrib.add(item.cfop);
          }

          return naoTem;
        }).length;

        const total_cfop_na = cfopsSemCclasstrib.size;

        // total_ok: diferença entre total de combinações e os que estão com cClasstrib = N/A
        const total_ok = total_combinacoes - total_ausente;

        const resumo: DadosJson["resumo"] = {
          total_combinacoes,
          total_ok,
          total_ausente,
          total_multiplo: 0,
          total_cfop_na,
        };

        let empresa: DadosJson["empresa"] = undefined;
        const sheetEmpresa =
          workbook.Sheets["EMPRESA"] ||
          workbook.Sheets["Empresa"] ||
          workbook.Sheets["empresa"];
        if (sheetEmpresa) {
          const empresaRows = XLSX.utils.sheet_to_json<unknown[]>(sheetEmpresa, {
            header: 1,
            blankrows: false,
          });

          const row0 = empresaRows[0] as unknown[] | undefined;
          const row1 = empresaRows[1] as unknown[] | undefined;

          const nome = String(row0?.[0] ?? "").trim();
          const cnpjParte1 = String(row1?.[0] ?? "").trim();
          const cnpjParte2 = String(row1?.[1] ?? "").trim();
          const cnpj = [cnpjParte1, cnpjParte2].filter(Boolean).join(" ");

          if (nome || cnpj) {
            empresa = { nome, cnpj };
          }
        }

        const payload: DadosJson = {
          tabela_consolidada,
          casos_ausentes,
          resumo,
          empresa,
          cfops_na: Array.from(cfopsSemCclasstrib),
        };

        return res.json(payload);
      } catch (error) {
        console.error("Erro ao processar upload:", error);
        return res.status(500).json({
          error: "Erro ao processar a planilha. Verifique o formato do arquivo.",
        });
      }
    }
  );

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3045;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
