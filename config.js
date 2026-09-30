// Chaves públicas do projeto "Grupo VEGA" no Supabase (publishable key: segura para o navegador; o acesso é controlado por RLS e pelas funções RPC).
window.VEGA_CONFIG = {
  supabaseUrl: "https://lfdwpdhfflqjzcqabsee.supabase.co",
  supabaseKey: "sb_publishable_-oIdtaQvEVNlqdOB75rRfA_fXIfVlfu",
  // Slides do deck que pertencem a cada módulo (data-slide nas telas)
  modules: [
    { id: 1, title: "Abertura", subtitle: "Quem somos, salas, pontos e mensalidades", from: 3, to: 11 },
    { id: 2, title: "Padrão de atendimento", subtitle: "Antes, durante e depois de cada viagem", from: 12, to: 22 },
    { id: 3, title: "Comunicação assertiva", subtitle: "Reservas, comunicação, cadeirinhas e eventos", from: 23, to: 43 },
    { id: 4, title: "Regras do grupo", subtitle: "Valores mínimos, fila, aceite e penalidades", from: 44, to: 53 },
    { id: 5, title: "Turismo em Minas", subtitle: "Visão de mercado e oportunidades", from: 54, to: 66 },
  ],
  // Tempo mínimo de leitura por tela = base + palavras ÷ palavrasPorSegundo, limitado entre mín. e máx.
  // Só vale na primeira passagem por cada tela; ao revisar, o botão libera na hora.
  reading: { baseSeconds: 2, wordsPerSecond: 3.5, minSeconds: 4, maxSeconds: 20 },
  minSecondsPerScreen: 4,   // (compatibilidade) usado se "reading" não existir
  passPercent: 80,
};
