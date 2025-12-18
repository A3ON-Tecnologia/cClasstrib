import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import axios from "axios";

interface User {
  id: number;
  username: string;
  is_admin: boolean;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "cclass_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { token: string; user: User };
        setToken(parsed.token);
        setUser(parsed.user);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (token && user) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [token, user]);

  async function login(username: string, password: string) {
    const res = await axios.post("/api/login", { username, password });
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data.user as User;
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
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
