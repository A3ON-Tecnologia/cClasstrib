
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, Loader2, Download, ArrowLeft } from "lucide-react";
import * as XLSX from "xlsx";
import { Link } from "wouter";

interface NBSRecord {
    id: number;
    nbs_code: string;
    descricao_nbs: string;
    item_lc_116: string;
    descricao_item: string;
    ps_onerosa: string | null;
    adq_exterior: string | null;
    indop: string;
    local_incidencia: string; // "Domicílio principal do adquirente"
    c_class_trib: string;
    nome_c_class_trib: string; // "Situações tributadas integralmente pelo IBS e CBS."
}

interface Meta {
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export default function NBSQuery() {
    const { token } = useAuth();
    const [data, setData] = useState<NBSRecord[]>([]);
    const [meta, setMeta] = useState<Meta | null>(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        fetchNBS(1, debouncedSearch);
    }, [debouncedSearch]);

    const fetchNBS = async (page = 1, q = "") => {
        if (!token) return;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append("page", String(page));
            params.append("limit", "100"); // Standardize table size
            if (q) params.append("q", q);

            const res = await fetch(`/api/nbs?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const json = await res.json();
                setData(json.data);
                setMeta(json.meta);
            }
        } catch (err) {
            console.error("Failed to fetch NBS data", err);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        if (!data.length) return;
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "NBS");
        XLSX.writeFile(wb, "NBS_Export.xlsx");
    };

    return (
        <div className="min-h-screen bg-slate-950">
            {/* Header */}
            <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800">
                <div className="container mx-auto px-6 py-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/home">
                            <a className="p-2 -ml-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-full transition-colors">
                                <ArrowLeft size={20} />
                            </a>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-50">Consulta NBS</h1>
                            <p className="text-sm text-slate-300">Correlação de Itens LC 116 com NBS e Classificação Tributária</p>
                        </div>
                    </div>

                    <div className="text-xs text-slate-400">
                        {meta?.total ? `${meta.total} resultados` : "..."}
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-6 py-8 space-y-8">

                {/* Search Section */}
                <section className="bg-gradient-to-r from-[#0b288b] via-[#0b288b] to-[#e85909] rounded-xl shadow-sm border border-transparent p-8 text-center space-y-6">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-white">Busque por Código ou Descrição</h2>
                        <p className="text-slate-100 max-w-2xl mx-auto">Encontre rapidamente a correlação entre itens da LC 116, códigos NBS e classificações tributárias IBS/CBS</p>
                    </div>

                    <div className="max-w-2xl mx-auto relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <Input
                            className="pl-12 h-12 text-lg rounded-lg border-white/20 bg-white/10 text-white placeholder:text-slate-300 shadow-sm focus:ring-2 focus:ring-white focus:border-transparent transition-all"
                            placeholder="Digite um código NBS, item LC 116 ou descrição..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center justify-center gap-3">
                        <Button variant="outline" className="gap-2 text-white border-white/20 bg-white/10 hover:bg-white/20 hover:text-white border-transparent">
                            <Filter size={16} />
                            Filtros
                        </Button>
                        <Button variant="outline" className="gap-2 text-white border-white/20 bg-white/10 hover:bg-white/20 hover:text-white border-transparent" onClick={handleExport}>
                            <Download size={16} />
                            Exportar CSV
                        </Button>
                    </div>
                </section>

                {/* Table Section */}
                <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
                    <div className="overflow-x-auto pb-4">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                                <tr>
                                    <th className="px-4 py-3 min-w-[80px] w-[80px] bg-slate-50 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-bold text-slate-500">
                                        ITEM LC <br /> 116
                                    </th>
                                    <th className="px-2 py-3 min-w-[200px] w-[200px] font-bold text-slate-500 text-[9px]">DESCRIÇÃO ITEM</th>
                                    <th className="px-2 py-3 min-w-[100px] w-[100px] font-bold text-slate-500 text-[9px]">NBS</th>
                                    <th className="px-2 py-3 min-w-[200px] max-w-[300px] font-bold text-slate-500 text-[9px]">DESCRIÇÃO NBS</th>
                                    <th className="px-2 py-3 min-w-[60px] w-[60px] text-center font-bold text-slate-500 text-[9px]">PS <br /> ONEROSA?</th>
                                    <th className="px-2 py-3 min-w-[60px] w-[60px] text-center font-bold text-slate-500 text-[9px]">ADQ <br /> EXTERIOR?</th>
                                    <th className="px-2 py-3 min-w-[60px] w-[60px] text-center font-bold text-slate-500 text-[9px]">INDOP</th>
                                    <th className="px-2 py-3 min-w-[140px] w-[140px] font-bold text-slate-500 text-[9px]">LOCAL INCIDÊNCIA IBS</th>
                                    <th className="px-2 py-3 min-w-[80px] w-[80px] text-center font-bold text-slate-500 text-[9px]">CCLASSTRIB</th>
                                    <th className="px-2 py-3 min-w-[200px] font-bold text-slate-500 text-[9px]">NOME CCLASSTRIB</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={10} className="px-6 py-20 text-center text-slate-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="animate-spin text-[#0b288b]" size={32} />
                                                <span>Carregando dados...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : data.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                                            Nenhum registro encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    data.map((row) => (
                                        <tr key={row.id} className="hover:bg-slate-50 transition-colors group border-b border-slate-50">
                                            <td className="px-4 py-4 font-bold text-slate-900 bg-white group-hover:bg-slate-50 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-transparent group-hover:border-slate-200 align-top">
                                                {row.item_lc_116}
                                            </td>

                                            <td className="px-2 py-4 text-slate-600 align-top leading-relaxed text-xs">
                                                <div className="line-clamp-4 hover:line-clamp-none transition-all">
                                                    {row.descricao_item}
                                                </div>
                                            </td>

                                            <td className="px-2 py-4 text-[#0b288b] font-bold align-top text-xs whitespace-nowrap">
                                                {row.nbs_code}
                                            </td>

                                            <td className="px-2 py-4 text-slate-600 align-top leading-relaxed text-xs">
                                                <div className="line-clamp-4 hover:line-clamp-none transition-all">
                                                    {row.descricao_nbs}
                                                </div>
                                            </td>

                                            <td className="px-2 py-4 text-center align-top">
                                                <BadgeYN value={row.ps_onerosa} />
                                            </td>
                                            <td className="px-2 py-4 text-center align-top">
                                                <BadgeYN value={row.adq_exterior} />
                                            </td>

                                            <td className="px-2 py-4 text-slate-500 font-mono text-xs text-center align-top font-medium">{row.indop}</td>
                                            <td className="px-2 py-4 text-slate-600 align-top text-xs">{row.local_incidencia}</td>

                                            <td className="px-2 py-4 text-center align-top">
                                                {row.c_class_trib && (
                                                    <span className="inline-block bg-slate-100 text-slate-500 px-2 py-1 rounded text-[11px] font-mono border border-slate-200 whitespace-nowrap font-bold">
                                                        {row.c_class_trib}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-2 py-4 text-slate-600 text-[11px] align-top leading-relaxed">
                                                {row.nome_c_class_trib}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {meta && meta.pages > 1 && (
                        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={meta.page <= 1 || loading}
                                onClick={() => fetchNBS(meta.page - 1, debouncedSearch)}
                            >
                                Anterior
                            </Button>
                            <span className="text-sm text-slate-600">
                                Página <span className="font-medium text-slate-900">{meta.page}</span> de {meta.pages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={meta.page >= meta.pages || loading}
                                onClick={() => fetchNBS(meta.page + 1, debouncedSearch)}
                            >
                                Próxima
                            </Button>
                        </div>
                    )}
                </section>

            </main>
        </div>
    );
}

function BadgeYN({ value }: { value: string | null }) {
    if (!value) return <span className="text-slate-300">-</span>;

    const normalized = String(value).trim().toUpperCase();
    const isSim = ['S', 'SIM'].includes(normalized);
    const isNao = ['N', 'NÃO', 'NAO'].includes(normalized);

    if (isSim) {
        return <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-[#0b288b] font-bold text-xs rounded shadow-sm">S</span>
    }
    if (isNao) {
        return <span className="inline-flex items-center justify-center w-6 h-6 bg-slate-100 text-slate-500 font-bold text-xs rounded border border-slate-200">N</span>
    }
    return <span className="text-slate-300">-</span>;
}
