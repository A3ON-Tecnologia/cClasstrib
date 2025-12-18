import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Login() {
  const { login, loading, user } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Informe usuário e senha");
      return;
    }
    try {
      setSubmitting(true);
      await login(username, password);
      toast.success("Login realizado com sucesso");
      setLocation("/home");
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Erro ao fazer login";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!loading && user) {
      setLocation("/home");
    }
  }, [loading, user, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-slate-200 p-6">
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
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={submitting || loading}
          >
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
