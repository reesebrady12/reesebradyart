import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { adminApi } from "../lib/admin-api";
import { supabase } from "../lib/supabase";

type AuthState = {
  session: Session | null;
  loading: boolean;
  authorized: boolean;
  forbidden: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const refresh = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    setAuthorized(false);
    setForbidden(false);
    if (data.session)
      try {
        await adminApi("/api/admin/session");
        setAuthorized(true);
      } catch (error) {
        if (
          typeof error === "object" &&
          error &&
          "status" in error &&
          error.status === 403
        )
          setForbidden(true);
      }
    setLoading(false);
  };
  useEffect(() => {
    queueMicrotask(() => void refresh());
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(() => void refresh());
    return () => data.subscription.unsubscribe();
  }, []);
  const logout = async () => {
    await supabase?.auth.signOut();
    setSession(null);
    setAuthorized(false);
  };
  return (
    <AuthContext.Provider
      value={{ session, loading, authorized, forbidden, refresh, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Missing AuthProvider");
  return value;
};
