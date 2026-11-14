import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { Session, User } from "@supabase/supabase-js";

import { authService } from "./auth.service";
import {
  profileService,
  type UserProfile,
} from "./profile.service";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  profileError: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const currentUserId = session?.user?.id ?? null;

  useEffect(() => {
    const subscription = authService.onAuthStateChange((newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    const initializeSession = async () => {
      try {
        const currentSession = await authService.getSession();
        setSession(currentSession);
      } catch (error) {
        console.error("Failed to retrieve authentication session:", error);
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    void initializeSession();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      if (!currentUserId) {
        setProfile(null);
        setProfileError(null);
        setProfileLoading(false);
        return;
      }

      // Indicate loading without clearing an already-loaded profile (stale-while-revalidate)
      setProfileLoading(true);

      try {
        const userProfile = await profileService.getProfile(currentUserId);

        if (isActive) {
          setProfile(userProfile);
          setProfileError(null);
        }
      } catch (error) {
        console.error("Failed to load user profile:", error);

        if (isActive) {
          setProfileError(
            error instanceof Error
              ? error.message
              : "Unable to load user profile."
          );
        }
      } finally {
        if (isActive) {
          setProfileLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, [currentUserId]);

  const login = useCallback(async (email: string, password: string) => {
    await authService.login({ email, password });
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setProfile(null);
    setSession(null);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      profileLoading,
      profileError,
      login,
      logout,
    }),
    [session, profile, loading, profileLoading, profileError, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// This module intentionally exports the hook alongside the provider.
// Keep this local exception until the auth context is split into modules.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }

  return context;
}