import type { ConfiguracaoAplicacao } from '../../electron/servicos/tipos'

export const configuracaoPadrao: ConfiguracaoAplicacao = {
  // Estado inicial da tela, antes de o processo principal empurrar a config
  // real. Tem de apontar para o mesmo projeto de electron/main.ts: o form de
  // configuracao e editavel, e salvar com o valor semeado aqui gravaria um
  // projeto incorreto.
  supabaseUrl: 'https://olkzbualikbyudupizxz.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sa3pidWFsaWtieXVkdXBpenh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MzkyODUsImV4cCI6MjEwMjQxNTI4NX0.Fqkmj-VTpzzx5ve59oiblv7xesqTBJF0To8EV0zB7Wc',
  nomeImpressora: '',
  larguraPapelMm: 80,
  tamanhoFonteBasePx: 15,
  espacamentoLinha: 1.35,
  espacamentoItensPx: 8,
  intervaloPollingSegundos: 2,
  copias: 1,
  autoImpressao: true,
  tema: 'sistema'
}

export const largurasPapelSugeridas = [58, 80, 90, 112]

export const limitesConfiguracao = {
  larguraPapelMm: { min: 48, max: 120 },
  tamanhoFonteBasePx: { min: 10, max: 24 },
  espacamentoLinha: { min: 1, max: 2.2, passo: 0.05 },
  espacamentoItensPx: { min: 0, max: 24 },
  intervaloPollingSegundos: { min: 1, max: 120 },
  copias: { min: 1, max: 5 }
} as const

export const configuracoesIguais = (a: ConfiguracaoAplicacao, b: ConfiguracaoAplicacao) =>
  (Object.keys(a) as (keyof ConfiguracaoAplicacao)[]).every((chave) => a[chave] === b[chave])
