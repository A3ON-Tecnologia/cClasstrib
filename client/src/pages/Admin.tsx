import { FormEvent, useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface SimpleUser {
  id: number;
  username: string;
  is_admin: boolean;
}

interface SimpleCompany {
  id: number;
  name: string;
  address: string | null;
  cnpj: string;
}

export default function Admin() {
  const { user, token, logout } = useAuth();
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [companies, setCompanies] = useState<SimpleCompany[]>([]);
  const [searchUser, setSearchUser] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [submittingUser, setSubmittingUser] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyCnpj, setCompanyCnpj] = useState("");
  const [submittingCompany, setSubmittingCompany] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<number[]>([]);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  if (!user) return null;

  const isAdminUser = user.is_admin;

  async function fetchUsers(query?: string) {
    if (!token) return;
    try {
      setLoadingUsers(true);
      const res = await axios.get<SimpleUser[]>("/api/users", {
        params: query ? { q: query } : undefined,
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data ?? []);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Erro ao buscar usuários";
      toast.error(msg);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function fetchCompanies() {
    if (!token) return;
    try {
      const res = await axios.get<SimpleCompany[]>("/api/companies", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCompanies(res.data ?? []);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Erro ao buscar empresas";
      toast.error(msg);
    }
  }

  useEffect(() => {
    if (isAdminUser) {
      fetchUsers();
      fetchCompanies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminUser]);

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Preencha usuário e senha do novo usuário");
      return;
    }
    if (!isAdminUser) {
      toast.error("Somente administradores podem criar usuários");
      return;
    }
    try {
      setSubmittingUser(true);
      await axios.post(
        "/api/users",
        { username, password, is_admin: isAdmin },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Usuário criado com sucesso");
      setUsername("");
      setPassword("");
      setIsAdmin(false);
      fetchUsers(searchUser);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Erro ao criar usuário";
      toast.error(msg);
    } finally {
      setSubmittingUser(false);
    }
  }

  async function handleCreateCompany(e: FormEvent) {
    e.preventDefault();
    if (!companyName.trim() || !companyCnpj.trim()) {
      toast.error("Nome e CNPJ são obrigatórios");
      return;
    }
    if (!isAdminUser) {
      toast.error("Somente administradores podem cadastrar empresas");
      return;
    }
    try {
      setSubmittingCompany(true);
      if (editingCompanyId) {
        await axios.put(
          `/api/companies/${editingCompanyId}`,
          {
            name: companyName,
            address: companyAddress || undefined,
            cnpj: companyCnpj,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success("Empresa atualizada com sucesso");
      } else {
        await axios.post(
          "/api/companies",
          {
            name: companyName,
            address: companyAddress || undefined,
            cnpj: companyCnpj,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success("Empresa cadastrada com sucesso");
      }
      setCompanyName("");
      setCompanyAddress("");
      setCompanyCnpj("");
      setEditingCompanyId(null);
      fetchCompanies();
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Erro ao cadastrar empresa";
      toast.error(msg);
    } finally {
      setSubmittingCompany(false);
    }
  }

  async function handleLinkUserCompany(e: FormEvent) {
    e.preventDefault();
    if (!selectedUserId || selectedCompanyIds.length === 0) {
      toast.error("Selecione usuário e uma ou mais empresas");
      return;
    }
    try {
      setLinking(true);
      await Promise.all(
        selectedCompanyIds.map((companyId) =>
          axios.post(
            "/api/company-users",
            { user_id: selectedUserId, company_id: companyId },
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        ),
      );
      toast.success("Usuário associado às empresas com sucesso");
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ?? "Erro ao associar usuário às empresas";
      toast.error(msg);
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlinkUserCompany(e: FormEvent) {
    e.preventDefault();
    if (!selectedUserId || selectedCompanyIds.length === 0) {
      toast.error("Selecione usuário e uma ou mais empresas");
      return;
    }
    try {
      setUnlinking(true);
      const responses = await Promise.all(
        selectedCompanyIds.map((companyId) =>
          axios.post(
            "/api/company-users/unlink",
            { user_id: selectedUserId, company_id: companyId },
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        ),
      );
      const totalRemoved = responses.reduce(
        (sum, res) => sum + (res.data?.removed ?? 0),
        0,
      );
      if (totalRemoved === 0) {
        toast.error(
          "Nenhuma associação foi removida (verifique se o usuário realmente estava associado).",
        );
      } else {
        toast.success("Associação removida com sucesso");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ??
        "Erro ao remover associação usuário × empresa";
      toast.error(msg);
    } finally {
      setUnlinking(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              Painel administrativo
            </h1>
            <p className="text-xs text-slate-500">
              Usuário: {user.username} {isAdminUser ? "(administrador)" : "(comum)"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            Sair
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {isAdminUser ? (
          <div className="space-y-6">
            {/* Usuários */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-1">
                Criar novo usuário
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Preencha os dados para cadastrar um novo usuário no sistema.
              </p>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    Usuário
                  </label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="login do usuário"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    Senha
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="senha do usuário"
                    autoComplete="new-password"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={isAdmin}
                    onChange={(e) => setIsAdmin(e.target.checked)}
                  />
                  Usuário administrador
                </label>

                <Button type="submit" disabled={submittingUser}>
                  {submittingUser ? "Salvando..." : "Criar usuário"}
                </Button>
              </form>
            </section>

            {/* Empresas */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-1">
                Cadastro de empresas
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Cadastre empresas com nome, endereço e CNPJ. Nome e CNPJ são
                obrigatórios.
              </p>

              <form
                onSubmit={handleCreateCompany}
                className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,2fr)_auto]"
              >
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    Nome *
                  </label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Nome da empresa"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    Endereço
                  </label>
                  <Input
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    placeholder="Rua, número, cidade"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    CNPJ *
                  </label>
                  <Input
                    value={companyCnpj}
                    onChange={(e) => setCompanyCnpj(e.target.value)}
                    placeholder="CNPJ"
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={submittingCompany}>
                    {submittingCompany
                      ? "Salvando..."
                      : editingCompanyId
                      ? "Salvar alterações"
                      : "Cadastrar"}
                  </Button>
                </div>
              </form>

              <div className="mt-5 border border-slate-200 rounded-lg max-h-72 overflow-y-auto">
                {companies.length === 0 ? (
                  <p className="text-sm text-slate-500 p-4">
                    Nenhuma empresa cadastrada.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-200">
                    {companies.map((c) => (
                      <li
                        key={c.id}
                        className="px-4 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {c.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            CNPJ: {c.cnpj}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {c.address && (
                            <p className="text-xs text-slate-500">
                              Endereço: {c.address}
                            </p>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => {
                              setEditingCompanyId(c.id);
                              setCompanyName(c.name);
                              setCompanyAddress(c.address ?? "");
                              setCompanyCnpj(c.cnpj);
                            }}
                          >
                            Editar
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Associação usuário x empresa (multiseleção) */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-slate-900 mb-1">
                Associação usuário × empresa
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Defina quais usuários podem utilizar cada empresa.
              </p>

              <form className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto]">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    Usuário
                  </label>
                  <select
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                    value={selectedUserId}
                    onChange={(e) =>
                      setSelectedUserId(
                        e.target.value ? Number(e.target.value) : "",
                      )
                    }
                  >
                    <option value="">Selecione um usuário</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username} {u.is_admin ? "(admin)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">
                    Empresas
                  </label>
                  <select
                    multiple
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm h-28"
                    value={selectedCompanyIds.map(String)}
                    onChange={(e) => {
                      const options = Array.from(e.target.selectedOptions);
                      const ids = options.map((opt) => Number(opt.value));
                      setSelectedCompanyIds(ids);
                    }}
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    onClick={handleLinkUserCompany}
                    disabled={linking}
                  >
                    {linking ? "Salvando..." : "Associar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleUnlinkUserCompany}
                    disabled={unlinking}
                  >
                    {unlinking ? "Removendo..." : "Remover associação"}
                  </Button>
                </div>
              </form>
            </section>

            {/* Lista de usuários */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Usuários cadastrados
                  </h2>
                  <p className="text-xs text-slate-500">
                    Consulte os usuários existentes e seus perfis.
                  </p>
                </div>
              </div>

              <div className="mb-3">
                <Input
                  placeholder="Buscar por usuário..."
                  value={searchUser}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchUser(value);
                    fetchUsers(value);
                  }}
                />
              </div>

              <div className="border border-slate-200 rounded-lg max-h-80 overflow-y-auto">
                {loadingUsers ? (
                  <p className="text-sm text-slate-500 p-4">
                    Carregando usuários...
                  </p>
                ) : users.length === 0 ? (
                  <p className="text-sm text-slate-500 p-4">
                    Nenhum usuário encontrado.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-200">
                    {users.map((u) => (
                      <li
                        key={u.id}
                        className="px-4 py-2.5 flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {u.username}
                          </p>
                          <p className="text-xs text-slate-500">
                            {u.is_admin ? "Administrador" : "Usuário comum"}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Seu usuário não é administrador. Contate o administrador do sistema
            para gerenciar usuários.
          </p>
        )}
      </main>
    </div>
  );
}
