import type { OnboardingPersistedState } from './types'

/**
 * Persistência do onboarding em localStorage, por usuário.
 *
 * Decisão (2026-07-23): progresso fica só no localStorage — não há tabela no
 * Supabase (evita migração coordenada web/Electron/bot). Chave por usuário do
 * admin; quando o login é hardcoded (sem id), usa 'default'.
 */

const STORAGE_PREFIX = 'bar-da-ladeira:onboarding:'

export const defaultState: OnboardingPersistedState = {
  version: 1,
  tours: {},
  preferences: {
    autoStart: true,
    dontShowAgain: [],
    trainingMode: false,
  },
}

const storageKey = (userId: string) => `${STORAGE_PREFIX}${userId}`

export const loadState = (userId: string): OnboardingPersistedState => {
  if (typeof window === 'undefined') return defaultState

  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return defaultState

    const parsed = JSON.parse(raw) as Partial<OnboardingPersistedState>
    if (parsed.version !== 1) return defaultState

    return {
      version: 1,
      tours: parsed.tours ?? {},
      preferences: {
        ...defaultState.preferences,
        ...parsed.preferences,
      },
    }
  } catch {
    return defaultState
  }
}

export const saveState = (userId: string, state: OnboardingPersistedState) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(state))
  } catch {
    // Quota cheia / modo privado: onboarding não pode quebrar o app.
  }
}
