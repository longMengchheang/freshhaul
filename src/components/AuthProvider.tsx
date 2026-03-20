'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getCurrentUserProfile } from '@/app/actions/users';
import { deriveRoleStates, getActiveRoles } from '@/lib/user-roles';
import type { AppSystemRole, AppUserProfile } from '@/types/app';
import { createClient, getClientEnvError } from '@/utils/supabase/client';
import { User, Session } from '@supabase/supabase-js';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: AppUserProfile | null;
  systemRole: AppSystemRole;
  activeRoles: Array<'buyer' | 'farmer' | 'driver'>;
  roleStates: {
    buyer: 'active' | 'pending_verification' | 'rejected' | 'suspended' | 'not_applied';
    farmer: 'active' | 'pending_verification' | 'rejected' | 'suspended' | 'not_applied';
    driver: 'active' | 'pending_verification' | 'rejected' | 'suspended' | 'not_applied';
  };
  loading: boolean;
  configError: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  systemRole: 'user',
  activeRoles: [],
  roleStates: { buyer: 'not_applied', farmer: 'not_applied', driver: 'not_applied' },
  loading: true,
  configError: null,
  signOut: async () => {},
  refreshProfile: async () => {},
});

function getProfileFromAuthUser(user: User): AppUserProfile | null {
  const name = user.user_metadata.name;
  const phone = user.user_metadata.phone;
  const countryCode = user.user_metadata.country_code;
  const province = user.user_metadata.province;
  const legacyRole = user.user_metadata.role;
  const systemRole = user.user_metadata.system_role === 'admin' ? 'admin' : 'user';
  const now = new Date().toISOString();
  const roles: AppUserProfile['roles'] = [
    {
      id: `${user.id}-buyer`,
      user_id: user.id,
      role_name: 'buyer',
      status: 'active',
      created_at: now,
      updated_at: now,
    },
  ];

  if (legacyRole === 'farmer' || legacyRole === 'driver') {
    roles.push({
      id: `${user.id}-${legacyRole}`,
      user_id: user.id,
      role_name: legacyRole,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
  }

  if (
    typeof name === 'string' &&
    typeof phone === 'string' &&
    typeof province === 'string'
  ) {
    return {
      id: user.id,
      system_role: systemRole,
      name,
      phone,
      avatar_url: null,
      country_code: typeof countryCode === 'string' ? countryCode.toUpperCase() : 'KH',
      province,
      created_at: now,
      roles,
    };
  }

  return null;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(Boolean(supabase));
  const configError = !supabase ? getClientEnvError() : null;
  const hasBootstrappedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      hasBootstrappedRef.current = true;
      return;
    }

    let active = true;

    async function syncSession(nextSession: Session | null) {
      if (!active) {
        return;
      }

      const nextUserId = nextSession?.user?.id ?? null;
      const isSameUser = nextUserId === currentUserIdRef.current;
      if (!hasBootstrappedRef.current || !isSameUser) {
        setLoading(true);
      }
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      currentUserIdRef.current = nextUserId;

      if (nextSession?.user) {
        const fallbackProfile = getProfileFromAuthUser(nextSession.user);
        setProfile((previous) => previous ?? fallbackProfile);

        const profileResult = await getCurrentUserProfile();
        if (!active) {
          return;
        }

        if (profileResult.success && profileResult.data) {
          setProfile(profileResult.data);
        } else if (fallbackProfile) {
          setProfile((previous) => previous ?? fallbackProfile);
        } else {
          setProfile(null);
        }
        setLoading(false);
        hasBootstrappedRef.current = true;
      } else {
        setProfile(null);
        setLoading(false);
        hasBootstrappedRef.current = true;
      }
    }

    void supabase.auth.getSession().then(({ data }) => syncSession(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    if (!supabase) {
      window.location.href = '/auth/login';
      return;
    }
    await supabase.auth.signOut();
    setProfile(null);
    window.location.href = '/auth/login';
  };

  const refreshProfile = async () => {
    if (!session?.user) {
      setProfile(null);
      return;
    }

    const fallbackProfile = getProfileFromAuthUser(session.user);
    const profileResult = await getCurrentUserProfile();
    if (profileResult.success && profileResult.data) {
      setProfile(profileResult.data);
      return;
    }

    setProfile(fallbackProfile);
  };

  const roleStates = profile ? deriveRoleStates(profile.roles) : { buyer: 'not_applied', farmer: 'not_applied', driver: 'not_applied' } as const;
  const activeRoles = profile ? getActiveRoles(profile.roles) : [];
  const systemRole = profile?.system_role ?? (session?.user.user_metadata.system_role === 'admin' ? 'admin' : 'user');

  return (
    <AuthContext.Provider value={{ user, session, profile, systemRole, activeRoles, roleStates, loading, configError, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
