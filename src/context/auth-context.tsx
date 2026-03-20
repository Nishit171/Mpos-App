import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";
import { getToken, setToken, removeToken } from "../utils/storage/tokenStorage";

interface User {
  token: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, userData?: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const token = await getToken();
        console.log("AUTH CONTEXT LOADED TOKEN:", token);
        if (token) {
          setUser({ token });
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadToken();
  }, []);

  const login = async (token: string, userData: Partial<User> = {}) => {
    await setToken(token);
    console.log("LOGIN SUCCESS");
    console.log("TOKEN SAVED:", token);
    setUser({ token, ...userData });
  };

  const logout = async () => {
    await removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
