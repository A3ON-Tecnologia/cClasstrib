import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Login() {
  const { login, loading, user, setActiveCompany } = useAuth();
  const [, setLocation] = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [selectingCompany, setSelectingCompany] = useState(false);
  const [companies, setCompanies] = useState<
    { id: number; name: string; cnpj: string }[]
  >([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | "">("");
  const [pendingIsAdmin, setPendingIsAdmin] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Informe usuário e senha");
      return;
    }
    try {
      setSubmitting(true);
      const { user: loggedUser, token } = await login(username, password);
      toast.success("Login realizado com sucesso");

      const res = await fetch("/api/companies", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Erro ao carregar empresas");
      }
      const data = (await res.json()) as {
        id: number;
        name: string;
        cnpj: string;
      }[];

      if (loggedUser.is_admin) {
        // Admin não vê modal de empresa, vai direto para o painel
        setLocation("/admin");
        return;
      }

      if (data.length === 0) {
        toast.error("Nenhuma empresa associada a este usuário");
        return;
      }

      setCompanies(data);
      setPendingIsAdmin(false);
      setSelectingCompany(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Erro ao fazer login";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handleConfirmCompany(e: FormEvent) {
    e.preventDefault();
    if (!selectedCompanyId) {
      toast.error("Selecione uma empresa");
      return;
    }
    const company = companies.find((c) => c.id === selectedCompanyId);
    if (!company) {
      toast.error("Empresa inválida");
      return;
    }
    setActiveCompany({
      id: company.id,
      name: company.name,
      cnpj: company.cnpj,
      address: null,
    });
    if (pendingIsAdmin) {
      setLocation("/admin");
    } else {
      setLocation("/home");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-orange-500 px-4">
      <div className="w-full max-w-sm bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-white/20 p-6">
        <div className="flex justify-center mb-6">
          <img
            src="/logo_v2.png"
            alt="Logo"
            className="h-24 w-auto object-contain mix-blend-multiply"
          />
        </div>
        <h1 className="text-xl font-semibold text-slate-900 mb-1">
          Acesso ao sistema
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Informe seu usuário e senha.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              Usuário
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              disabled={submitting}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Senha</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              autoComplete="current-password"
              disabled={submitting}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={submitting || loading}
          >
            {submitting ? "Validando..." : "Entrar"}
          </Button>
        </form>
      </div>

      {selectingCompany && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-white/20 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              Selecione a empresa
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Escolha a empresa que deseja utilizar neste acesso.
            </p>

            <form onSubmit={handleConfirmCompany} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Empresa
                </label>
                <select
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                  value={selectedCompanyId}
                  onChange={(e) =>
                    setSelectedCompanyId(
                      e.target.value ? Number(e.target.value) : "",
                    )
                  }
                >
                  <option value="">Selecione uma empresa</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.cnpj}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectingCompany(false);
                    setCompanies([]);
                    setSelectedCompanyId("");
                  }}
                >
                  Voltar
                </Button>
                <Button type="submit">Entrar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
