import { useState, useEffect, ChangeEvent, FormEvent, useMemo } from "react";
import { Link } from "wouter";
// LISTA DE ICONES/ COMPONENTES LUCIDE REACT
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ArrowLeftRight,
  CornerDownLeft,
  CornerDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as XLSX from "xlsx";
import { useAuth } from "@/contexts/AuthContext";

interface TabelaItem {
  ncm: string;
  cfop: string;
  cClasstrib_sugerido: string | null;
  qtd_registros: number;
  descricao: string;
  nome_produto?: string;
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

interface NCMAgrupado {
  ncm: string;
  descricao: string;
  cfops: TabelaItem[];
}

const formatarCClasstrib = (valor: string | null): string => {
  if (!valor) return "Não Encontrado";
  const limpo = String(valor).trim();
  if (!limpo || limpo === "N/A" || limpo === "Não Encontrado")
    return "Não Encontrado";
  return limpo.padStart(6, "0");
};

export default function Home() {
  const { logout, company, token, user, setActiveCompany } = useAuth() as any;
  const [dados, setDados] = useState<DadosJson | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [ncmsAgrupados, setNcmsAgrupados] = useState<NCMAgrupado[]>([]);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [progressoUpload, setProgressoUpload] = useState(0);
  const [mostrarCfopsNa, setMostrarCfopsNa] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [availableCompanies, setAvailableCompanies] = useState<any[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "OK" | "AUSENTE" | "CFOP_NA">("TODOS");

  const cfopsVisiveis = useMemo(() => {
    if (filtroStatus !== "CFOP_NA" && filtroStatus !== "AUSENTE") return [];
    const set = new Set<string>();
    ncmsAgrupados.forEach((grupo) => {
      grupo.cfops.forEach((item) => set.add(item.cfop));
    });
    return Array.from(set).sort();
  }, [ncmsAgrupados, filtroStatus]);

  const totalNCMs = useMemo(() => {
    if (!dados?.tabela_consolidada) return 0;
    const uniqueNcms = new Set(dados.tabela_consolidada.map((item) => item.ncm));
    return uniqueNcms.size;
  }, [dados]);

  useEffect(() => {
    if (token) {
      fetch("/api/companies", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("Falha ao buscar empresas");
        })
        .then((data) => setAvailableCompanies(data))
        .catch((err) => console.error("Erro ao buscar empresas:", err));
    }
  }, [token]);

  // Progresso "simulado" do processamento da planilha
  useEffect(() => {
    if (!enviando) {
      setProgressoUpload(0);
      return;
    }

    let valor = 0;
    setProgressoUpload(0);

    const id = window.setInterval(() => {
      valor = Math.min(valor + 5, 90); // sobe até 90% enquanto processa
      setProgressoUpload(valor);
    }, 200);

    return () => window.clearInterval(id);
  }, [enviando]);

  // Ao logar e selecionar a empresa,
  // sempre busca do backend o último upload daquela empresa.
  useEffect(() => {
    if (!company?.id || !token) return;

    const loadLastUpload = async () => {
      try {
        setCarregando(true);
        const res = await fetch(
          `/api/company-last-upload?companyId=${company.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (res.status === 204) {
          setDados(null);
          setNcmsAgrupados([]);
          setCarregando(false);
          return;
        }

        if (!res.ok) {
          console.error("Erro ao buscar último upload da empresa");
          setCarregando(false);
          return;
        }

        const json: DadosJson = await res.json();
        setDados(json);
        atualizarAgrupamento(json.tabela_consolidada);
      } catch (error) {
        console.error("Erro ao carregar último upload:", error);
      } finally {
        setCarregando(false);
      }
    };

    void loadLastUpload();
  }, [company?.id, token]);



  const obterTabelaFiltrada = () => {
    if (!dados) return [];

    let lista = dados.tabela_consolidada;

    // 1. Filtro por Status
    if (filtroStatus === "OK") {
      lista = lista.filter(
        (item) => formatarCClasstrib(item.cClasstrib_sugerido) !== "Não Encontrado"
      );
    } else if (filtroStatus === "AUSENTE") {
      lista = lista.filter(
        (item) => formatarCClasstrib(item.cClasstrib_sugerido) === "Não Encontrado"
      );
    } else if (filtroStatus === "CFOP_NA") {
      const nas = dados.cfops_na || [];
      lista = lista.filter((item) => nas.includes(item.cfop));
    }

    // 2. Filtro por Busca
    const termo = termoBusca.trim().toLowerCase();
    if (!termo) return lista;

    return lista.filter((item) => {
      const campos = [
        item.ncm,
        item.cfop,
        item.descricao,
        item.nome_produto ?? "",
      ];

      return campos.some((campo) =>
        String(campo ?? "").toLowerCase().includes(termo)
      );
    });
  };

  // NCM -> CFOP (agrupando NCM+CFOP+cClasstrib)
  const agruparPorNcmECfop = (tabela: TabelaItem[]): NCMAgrupado[] => {
    const mapaNcm = new Map<string, TabelaItem[]>();
    const descricoes = new Map<string, string>();

    tabela.forEach((item) => {
      if (!mapaNcm.has(item.ncm)) {
        mapaNcm.set(item.ncm, []);
        descricoes.set(item.ncm, item.descricao);
      }
      mapaNcm.get(item.ncm)!.push(item);
    });

    return Array.from(mapaNcm.entries())
      .map(([ncm, itensNcm]) => {
        const mapaCfop = new Map<string, TabelaItem>();

        itensNcm.forEach((item) => {
          const key = `${item.cfop}||${formatarCClasstrib(
            item.cClasstrib_sugerido
          )}`;
          const existente = mapaCfop.get(key);
          if (!existente) {
            mapaCfop.set(key, { ...item });
          } else {
            existente.qtd_registros += item.qtd_registros;

            if (
              !existente.cClasstrib_sugerido &&
              item.cClasstrib_sugerido
            ) {
              existente.cClasstrib_sugerido = item.cClasstrib_sugerido;
            }
          }
        });

        const cfopsUnicos = Array.from(mapaCfop.values()).sort((a, b) =>
          a.cfop.localeCompare(b.cfop)
        );

        return {
          ncm,
          descricao: descricoes.get(ncm) || "",
          cfops: cfopsUnicos,
        };
      })
      .sort((a, b) => a.ncm.localeCompare(b.ncm));
  };

  const atualizarAgrupamento = (tabelaBase?: TabelaItem[]) => {
    const tabela = tabelaBase ?? obterTabelaFiltrada();
    const agrupados = agruparPorNcmECfop(tabela);
    setNcmsAgrupados(agrupados);
    setPaginaAtual(1);
  };

  useEffect(() => {
    if (dados) {
      atualizarAgrupamento();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termoBusca, filtroStatus]);

  const handleArquivoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setArquivo(file);
  };

  const handleUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!arquivo) return;

    setEnviando(true);

    try {
      const formData = new FormData();
      formData.append("file", arquivo);

      const resposta = await fetch("/upload", {
        method: "POST",
        body: formData,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(company?.id ? { "x-company-id": String(company.id) } : {}),
        } as HeadersInit,
      });

      if (!resposta.ok) {
        console.error("Erro ao enviar planilha");
        return;
      }

      const json: DadosJson = await resposta.json();
      setDados(json);
      atualizarAgrupamento(json.tabela_consolidada);
      setExpandidos(new Set());
    } catch (erro) {
      console.error("Erro ao enviar planilha:", erro);
    } finally {
      setEnviando(false);
    }
  };

  const toggleExpandir = (ncm: string) => {
    const novo = new Set(expandidos);
    if (novo.has(ncm)) {
      novo.delete(ncm);
    } else {
      novo.add(ncm);
    }
    setExpandidos(novo);
  };

  const handleExportExcel = () => {
    if (!ncmsAgrupados.length) return;

    const linhas: Array<{
      NCM: string;
      CFOP: string;
      cClasstrib: string;
    }> = [];

    ncmsAgrupados.forEach((ncmGrupo) => {
      ncmGrupo.cfops.forEach((cfop) => {
        linhas.push({
          NCM: ncmGrupo.ncm,
          CFOP: cfop.cfop,
          cClasstrib: formatarCClasstrib(cfop.cClasstrib_sugerido),
        });
      });
    });

    if (!linhas.length) return;

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(linhas);
    XLSX.utils.book_append_sheet(wb, ws, "Analise");

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "analise_tributaria.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800">
        <div className="container mx-auto px-6 py-10">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-6">
              {/* Nome da empresa + CNPJ no topo (dados do cadastro/admin) */}
              <div className="space-y-2 text-slate-100">
                <h2 className="text-2xl font-semibold tracking-tight">
                  {company?.name || "NOME DA EMPRESA"}
                </h2>
                <p className="text-sm font-medium text-slate-300">
                  <span className="font-semibold">CNPJ:</span>{" "}
                  {company?.cnpj || "Não Encontrado"}
                </p>
              </div>


              <div className="h-px bg-slate-800" />

              {/* Título da análise */}
              <div className="space-y-3">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-50">
                  Análise Tributária
                </h1>
                <p className="max-w-3xl text-sm md:text-base text-slate-300">
                  Classificação consolidada de cClasstrib por NCM e CFOP.
                  Identificação automática de inconsistências e sugestões fiscais.
                </p>
                <a
                  href="https://ibsecbspricetax.streamlit.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs md:text-sm font-semibold text-white hover:text-sky-200 underline decoration-sky-500/70"
                >
                  Faça sua Análise: PRICETAX • IBS/CBS 2026 &amp; Ranking SPED
                </a>

              </div>
            </div>
            <div className="mt-2 flex flex-col items-end gap-3">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-500 text-slate-100 hover:bg-slate-800"
                onClick={logout}
              >
                Sair
              </Button>
              <div className="flex items-center gap-2">
                <Link href="/consulta-nbs">
                  <Button
                    variant="outline"
                    className="rounded-full border-[#0b288b] text-[#0b288b] bg-white hover:bg-slate-100"
                  >
                    Consulta NBS
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="rounded-full border-slate-500 text-slate-100 hover:bg-slate-800"
                  onClick={handleExportExcel}
                  disabled={!ncmsAgrupados.length}
                >
                  Exportar para Excel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>


      <main className="container mx-auto px-4 py-8 space-y-6 bg-white">
        {/* Seletor de Empresa (Visível para todos que possuem empresas) */}
        {availableCompanies.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-4 border border-slate-200">
            <label className="text-sm font-medium text-slate-700 mb-1 block">
              Selecione a Empresa
            </label>
            <Select
              value={company?.id ? String(company.id) : undefined}
              onValueChange={(val) => {
                const selected = availableCompanies.find(
                  (c) => String(c.id) === val
                );
                if (selected && setActiveCompany) {
                  setActiveCompany(selected);
                }
              }}
            >
              <SelectTrigger className="w-full md:w-[400px]">
                <SelectValue placeholder="Selecione a empresa..." />
              </SelectTrigger>
              <SelectContent>
                {availableCompanies.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name} (CNPJ: {c.cnpj})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {dados && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 1) Total de NCM (definidos + não encontrados) */}
            <div
              onClick={() => setFiltroStatus("TODOS")}
              className={`rounded-xl shadow-md p-6 border-l-4 border-blue-500 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-105 active:scale-95 ${filtroStatus === "TODOS" ? "bg-blue-50 ring-2 ring-blue-500" : "bg-slate-50"
                }`}
            >
              <div className="text-3xl font-bold text-[#0b288b] mb-2">
                {totalNCMs}
              </div>
              <p className="text-slate-600 text-sm">
                Total de NCM analisados
              </p>
            </div>

            {/* 2) Definidos automaticamente */}
            <div
              onClick={() => setFiltroStatus("OK")}
              className={`rounded-xl shadow-md p-6 border-l-4 border-green-500 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-105 active:scale-95 ${filtroStatus === "OK" ? "bg-green-50 ring-2 ring-green-500" : "bg-slate-50"
                }`}
            >
              <div className="text-3xl font-bold text-[#0b288b] mb-2">
                {dados.resumo.total_ok}
              </div>
              <p className="text-slate-600 text-sm">Definidos automaticamente</p>
            </div>

            {/* 3) cClasstrib Não Encontrado */}
            <div
              onClick={() => setFiltroStatus("AUSENTE")}
              className={`rounded-xl shadow-md p-6 border-l-4 border-amber-500 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-105 active:scale-95 ${filtroStatus === "AUSENTE" ? "bg-amber-50 ring-2 ring-amber-500" : "bg-slate-50"
                }`}
            >
              <div className="w-full flex justify-end mb-1">
                <CornerDownRight
                  size={28}
                  className="text-[#0b288b] hidden md:block"
                  aria-hidden="true"
                />
              </div>
              <div className="text-3xl font-bold text-[#0b288b] mb-2">
                {dados.resumo.total_ausente}
              </div>
              <p className="text-slate-600 text-sm">cClasstrib Não Encontrado</p>
            </div>

            {/* 4) CFOPs Não Encontrados (distintos) */}
            <div
              onClick={() => setFiltroStatus("CFOP_NA")}
              className={`rounded-xl shadow-md p-6 border-l-4 border-slate-500 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:scale-105 active:scale-95 ${filtroStatus === "CFOP_NA" ? "bg-slate-200 ring-2 ring-slate-500" : "bg-slate-50"
                }`}
            >
              <div className="w-full flex justify-start mb-1">
                <CornerDownLeft
                  size={28}
                  className="text-[#0b288b] hidden md:block"
                  aria-hidden="true"
                />
              </div>
              <div className="text-3xl font-bold text-[#0b288b] mb-2">
                {dados.resumo.total_cfop_na}
              </div>
              <p className="text-slate-600 text-sm">CFOPs Não Encontrados</p>
            </div>
          </div>
        )
        }



        {
          user?.is_admin && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-2">
                  Selecione uma planilha XLSX com as colunas NCM, CFOP,
                  cClasstrib_sugerido, status, descricao e nome_produto.
                </p>

                <form
                  className="flex flex-wrap items-center gap-3"
                  onSubmit={handleUpload}
                >
                  <label className="inline-flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() =>
                        document.getElementById("arquivo-upload")?.click()
                      }
                    >
                      Procurar
                    </Button>
                    <span className="text-sm text-slate-600">
                      {arquivo ? arquivo.name : "Nenhum arquivo escolhido"}
                    </span>
                    <input
                      id="arquivo-upload"
                      type="file"
                      accept=".xlsx"
                      onChange={handleArquivoChange}
                      className="hidden"
                    />
                  </label>
                  <Button
                    type="submit"
                    disabled={!arquivo || enviando}
                    className="rounded-full"
                  >
                    {enviando ? "Enviando..." : "Enviar planilha"}
                  </Button>
                </form>

                {enviando && (
                  <div className="mt-3 w-full">
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-2 bg-gradient-to-r from-[#0b288b] to-[#e85909] transition-all duration-150"
                        style={{ width: `${progressoUpload}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-700">
                      {progressoUpload}% processando planilha...
                    </p>
                  </div>
                )}

              </div>

            </div>
          )
        }

        {/* Bloco principal agora em layout de página cheia */}
        <section className="space-y-6">
          <div className="bg-gradient-to-r from-[#0b288b] via-[#0b288b] to-[#e85909] px-6 py-4 flex items-center justify-between text-white">
            <h2 className="font-bold leading-tight flex items-center gap-2">
              <span className="text-xl font-bold">
                Análise por NCM / CFOP / cClassTrib -
              </span>
              <span className="text-sm font-normal">
                CFOP de devolução deve sempre ser verificado o cClasstrib da nota fiscal de entrada
              </span>
            </h2>
            <div className="flex items-center gap-2 text-xs text-[#0b288b]">
              <CheckCircle size={16} />
            </div>
          </div>

          <div className="flex-1 p-6 space-y-6">
            {ncmsAgrupados.length > 0 ? (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600">
                    Filtrar por NCM, CFOP, descriÇõÇœo ou produto
                  </p>
                  <div className="w-full sm:w-80">
                    <Input
                      placeholder="Buscar produto..."
                      value={termoBusca}
                      onChange={(e) => setTermoBusca(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                </div>

                {(filtroStatus === "CFOP_NA" || filtroStatus === "AUSENTE") ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
                    {cfopsVisiveis.map((cfop) => (
                      <div
                        key={cfop}
                        className="bg-slate-50 border border-slate-200 border-l-4 border-l-slate-500 rounded-lg p-6 flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow animate-in fade-in duration-300"
                      >
                        <span className="text-sm font-semibold text-slate-500 uppercase mb-2 text-center">
                          {filtroStatus === "CFOP_NA" ? "CFOP Não Encontrado" : "CFOP - cClasstrib Ausente"}
                        </span>
                        <span className="text-3xl font-bold text-slate-800">
                          {cfop}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {ncmsAgrupados
                        .slice((paginaAtual - 1) * 10, paginaAtual * 10)
                        .map((ncmGrupo) => (
                          <div
                            key={ncmGrupo.ncm}
                            className="border border-slate-200 border-l-4 border-l-blue-500 rounded-lg overflow-hidden"
                          >
                            <button
                              onClick={() => toggleExpandir(ncmGrupo.ncm)}
                              className="w-full bg-slate-50 hover:bg-slate-100 transition-colors px-6 py-4 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-4 flex-1 text-left">
                                <div className="flex-shrink-0">
                                  {expandidos.has(ncmGrupo.ncm) ? (
                                    <ChevronDown
                                      size={20}
                                      className="text-[#0b288b]"
                                    />
                                  ) : (
                                    <ChevronRight
                                      size={20}
                                      className="text-slate-400"
                                    />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <h3 className="text-lg font-bold text-slate-900">
                                    NCM: {ncmGrupo.ncm}
                                  </h3>
                                  {ncmGrupo.descricao && (
                                    <p className="text-sm text-slate-600 mt-1">
                                      {ncmGrupo.descricao}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <span className="text-sm font-medium text-slate-600 bg-slate-200 px-3 py-1 rounded-full">
                                  {ncmGrupo.cfops.length} CFOP
                                  {ncmGrupo.cfops.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                            </button>

                            {expandidos.has(ncmGrupo.ncm) && (
                              <div className="bg-white border-t border-slate-200 divide-y divide-slate-200">
                                {ncmGrupo.cfops.map((cfop, idx) => (
                                  <div
                                    key={`${ncmGrupo.ncm}-${cfop.cfop}-${idx}`}
                                    className="px-6 py-4 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-b-0"
                                  >
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">
                                            CFOP
                                          </p>
                                          <p className="text-lg font-bold text-slate-900">
                                            {cfop.cfop}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">
                                            cClasstrib sugerido
                                          </p>
                                          <p className="text-lg font-bold font-mono">
                                            {formatarCClasstrib(
                                              cfop.cClasstrib_sugerido
                                            ) === "Não Encontrado" ? (
                                              <span className="text-[#e85909]">
                                                Não Encontrado
                                              </span>
                                            ) : (
                                              <span className="text-green-600">
                                                {formatarCClasstrib(
                                                  cfop.cClasstrib_sugerido
                                                )}
                                              </span>
                                            )}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>

                    {/* Paginação */}
                    <div className="mt-6 flex items-center justify-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={paginaAtual === 1}
                        onClick={() =>
                          setPaginaAtual((p) => Math.max(1, p - 1))
                        }
                      >
                        Anterior
                      </Button>
                      <span className="text-xs text-slate-500">
                        Página {paginaAtual} de{" "}
                        {Math.max(1, Math.ceil(ncmsAgrupados.length / 10))}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={
                          paginaAtual >= Math.ceil(ncmsAgrupados.length / 10)
                        }
                        onClick={() =>
                          setPaginaAtual((p) =>
                            Math.min(
                              Math.ceil(ncmsAgrupados.length / 10),
                              p + 1
                            )
                          )
                        }
                      >
                        Próxima
                      </Button>
                    </div>

                    {/* Itens com cClasstrib = N/A para todas as NCMs */}
                    <div className="mt-6 border-t border-slate-200 pt-4">
                      <h3 className="text-sm font-semibold text-slate-900 mb-2">
                        Itens com cClasstrib = N/A
                      </h3>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {ncmsAgrupados
                          .flatMap((ncmGrupo) =>
                            ncmGrupo.cfops
                              .filter(
                                (cfop) =>
                                  formatarCClasstrib(
                                    cfop.cClasstrib_sugerido
                                  ) === "N/A"
                              )
                              .map((cfop) => ({
                                ncm: ncmGrupo.ncm,
                                cfop: cfop.cfop,
                              }))
                          )
                          .map((item, idx) => (
                            <div
                              key={`${item.ncm}-${item.cfop}-${idx}`}
                              className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded px-3 py-2 flex flex-wrap gap-2"
                            >
                              <span className="font-semibold">
                                NCM:{" "}
                                <span className="font-mono font-normal">
                                  {item.ncm}
                                </span>
                              </span>
                              <span className="font-semibold">
                                CFOP:{" "}
                                <span className="font-mono font-normal">
                                  {item.cfop}
                                </span>
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className="text-slate-600 text-center py-8">
                Nenhum dado disponível.
              </p>
            )}
          </div>
        </section>
      </main >
    </div >
  );
}
