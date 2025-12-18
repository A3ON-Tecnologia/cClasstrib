import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import axios from "axios";

interface User {
  id: number;
  username: string;
  is_admin: boolean;
}

interface Company {
  id: number;
  name: string;
  address: string | null;
  cnpj: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  company: Company | null;
  loading: boolean;
  login: (
    username: string,
    password: string,
  ) => Promise<{ user: User; token: string }>;
  setActiveCompany: (company: Company | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "cclass_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as {
          token: string;
          user: User;
          company?: Company | null;
        };
        setToken(parsed.token);
        setUser(parsed.user);
        setCompany(parsed.company ?? null);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (token && user) {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ token, user, company }),
      );
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [token, user, company]);

  async function login(username: string, password: string) {
    const res = await axios.post("/api/login", { username, password });
    setToken(res.data.token);
    setUser(res.data.user);
    return { user: res.data.user as User, token: res.data.token as string };
  }

  function logout() {
    setToken(null);
    setUser(null);
    setCompany(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        company,
        loading,
        login,
        setActiveCompany: setCompany,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return ctx;
}
