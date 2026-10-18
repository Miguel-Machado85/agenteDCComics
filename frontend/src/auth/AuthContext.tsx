import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { getToken, keycloak } from './keycloak'

export interface Usuario {
  /** `sub` del token: es el `uploaded_by` de los documentos. */
  sub: string
  username: string
}

interface AuthContextValue {
  usuario: Usuario
  logout: () => Promise<void>
  getToken: () => Promise<string>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Se monta despues de initKeycloak() (ver main.tsx): ya hay sesion. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const valor = useMemo<AuthContextValue>(() => {
    const token = keycloak.tokenParsed
    return {
      usuario: {
        sub: token?.sub ?? '',
        username: (token?.preferred_username as string | undefined) ?? '',
      },
      logout: () => keycloak.logout({ redirectUri: window.location.origin }),
      getToken,
    }
  }, [])

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

// El hook vive junto al provider a proposito (un solo modulo de sesion)
// oxlint-disable-next-line react/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth() debe usarse dentro de <AuthProvider>.')
  }
  return ctx
}
