/**
 * Tipos do módulo de onboarding (aulas guiadas dos módulos do admin).
 *
 * 100% config-driven: um novo tour é adicionado registrando um objeto
 * TourConfig (ver config/index.ts), sem tocar no engine.
 */

/** Posição preferencial do popover em relação ao elemento destacado. */
export type StepPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'auto'

/** Como a etapa avança automaticamente (fluxo adaptativo). */
export type StepAdvanceOn =
  | { type: 'click'; selector?: string }
  | { type: 'route'; route: string }
  | { type: 'element-visible'; selector: string }

/**
 * Ação de demonstração — o tour executa como se fosse um clique humano,
 * com cursor animado, para mostrar um fluxo na prática.
 */
export type DemoAction =
  | { click: string; text?: string; waitFor?: string; timeoutMs?: number }
  | { doubleClick: string; text?: string; waitFor?: string; timeoutMs?: number }
  | { wait: number }

export type StepDemo = {
  actions: DemoAction[]
  /** Rótulo do botão (padrão: "Ver na prática"). */
  label?: string
}

/** Papel pedagógico da etapa (guia a linguagem e o selo exibido). */
export type StepKind =
  | 'problema'
  | 'beneficio'
  | 'caso-real'
  | 'demonstracao'
  | 'pratica'
  | 'proximo-passo'

export type TourStep = {
  id: string
  /** Seletor CSS do elemento a destacar. Sem target = etapa centralizada. */
  target?: string
  /** Rota em que a etapa acontece (continuidade entre telas do admin). */
  route?: string
  title: string
  /** Corpo da etapa. String simples mantém o config serializável. */
  body: string
  kind?: StepKind
  placement?: StepPlacement
  /** Avanço automático quando o usuário executa a ação esperada. */
  advanceOn?: StepAdvanceOn
  /** Raio do recorte do spotlight (padrão 8). */
  spotlightRadius?: number
  /** Margem extra ao redor do elemento destacado (padrão 6). */
  spotlightPadding?: number
  /** Demonstração ao vivo (cursor simulado executa os cliques). */
  demo?: StepDemo
  /** Pula a etapa quando o alvo não existe (ex.: depende de haver registros). */
  skipIfMissing?: boolean
  /** Pula a etapa quando o alvo EXISTE (etapas só do estado vazio). */
  skipIfPresent?: boolean
  /** Seletor usado apenas para a condição skipIfMissing/skipIfPresent. */
  conditionTarget?: string
}

export type TourConfig = {
  /** Identificador único e estável (persistido no progresso do usuário). */
  id: string
  /** Nome exibido ao usuário (bate com o item da sidebar). */
  name: string
  /** Categoria/seção da sidebar, para agrupar o catálogo de treinamentos. */
  module: string
  /** Rotas em que o tour se aplica. A primeira é a "casa" do tour. */
  routes: string[]
  /** Frase curta exibida no cabeçalho do painel de ajuda. */
  descricao?: string
  /** Inicia automaticamente na primeira visita à rota. Padrão: true. */
  autoStart?: boolean
  /**
   * Feature sem página própria (acessada via modal). O engine não navega
   * até a rota ao iniciar — as etapas ficam centralizadas.
   */
  virtualRoute?: boolean
  /** Ordem sugerida dentro do treinamento completo da plataforma. */
  order?: number
  steps: TourStep[]
}

/** Status persistido de um tour para o usuário. */
export type TourProgressStatus = 'not-started' | 'in-progress' | 'completed' | 'skipped'

export type TourProgress = {
  status: TourProgressStatus
  /** Última etapa acessada — permite retomar de onde parou. */
  stepIndex: number
  /** Quantas etapas foram vistas (para % por tela). */
  seenSteps: number
  updatedAt: string
}

/** Estado persistido do onboarding (localStorage, por usuário). */
export type OnboardingPersistedState = {
  version: 1
  tours: Record<string, TourProgress>
  preferences: {
    /** Inicia tours automaticamente na primeira visita a cada tela. */
    autoStart: boolean
    /** Tours marcados como "não mostrar novamente". */
    dontShowAgain: string[]
    /** Modo treinamento contínuo (ativado pelo botão de ajuda). */
    trainingMode: boolean
    updatedAt?: string
  }
}

export type ModuleProgress = {
  module: string
  completed: number
  total: number
  percent: number
}

export type OverallProgress = {
  completed: number
  total: number
  percent: number
  byModule: ModuleProgress[]
}
