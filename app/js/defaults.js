/* MyTV — configurações padrão (vão pelo site e atualizam sozinhas). As chaves ficam no config.js da TV. */
window.MYTV_DEFAULTS = {


  // Clima
  local: { nome: "Rio", lat: -22.91, lon: -43.17 },
  fuso: "America/Sao_Paulo",

  // Apps que aparecem na fileira por padrão, nessa ordem (pedaço do nome). Os outros ficam em "Todos os apps"
  // e podem ser ligados pela engrenagem.
  ordemApps: ["youtube", "netflix", "globoplay", "quick", "ultra", "stremio", "nba", "chromecast", "prime", "disney", "max", "apple tv", "kick", "spotify", "internet", "browser"],
  // Apps que nunca aparecem na fileira
  esconderApps: ["mytv"],

  // Times com placar escondido (anti-spoiler). Compara com o nome que vem do placar.
  spoiler: ["Clippers", "Flamengo", "Manchester United", "Rams", "Falcons"],

  // Pra onde cada tipo de conteúdo leva (pedaço do nome do app instalado)
  destino: {
    aoVivo: "quick",          // jogos ao vivo em geral
    nba: "nba",               // jogos da NBA
    nfl: "quick",
    netflix: "netflix",       // filme/série disponível na Netflix
    padraoFilmes: "stremio",  // o resto
    trailer: "youtube"
  },

  // Ligas do "Acontecendo agora" (peso maior = aparece antes)
  ligas: [
    { esporte: "soccer", liga: "uefa.champions", nome: "Champions", peso: 10 },
    { esporte: "soccer", liga: "conmebol.libertadores", nome: "Libertadores", peso: 9 },
    { esporte: "soccer", liga: "bra.1", nome: "Brasileirão", peso: 8 },
    { esporte: "soccer", liga: "esp.1", nome: "La Liga", peso: 8 },
    { esporte: "soccer", liga: "eng.1", nome: "Premier League", peso: 8 },
    { esporte: "soccer", liga: "ita.1", nome: "Serie A", peso: 6 },
    { esporte: "soccer", liga: "ger.1", nome: "Bundesliga", peso: 6 },
    { esporte: "soccer", liga: "fra.1", nome: "Ligue 1", peso: 5 },
    { esporte: "basketball", liga: "nba", nome: "NBA", peso: 7 },
    { esporte: "football", liga: "nfl", nome: "NFL", peso: 6 }
  ],
  // Times grandes ganham prioridade no "Acontecendo agora"
  timesGrandes: ["Real Madrid", "Barcelona", "Manchester City", "Liverpool", "Arsenal", "Chelsea", "Paris Saint-Germain", "Bayern", "Inter", "Milan", "Juventus", "Palmeiras", "Corinthians", "São Paulo", "Boca", "River", "Lakers", "Celtics", "Warriors", "Knicks", "Chiefs", "Eagles"],

  // Protetor de tela: entra depois de X minutos sem mexer no controle (0 desliga)
  protetorMinutos: 5,
  // Som curtinho ao navegar e ao apertar OK (dá pra desligar pela engrenagem)
  sons: true,
  // Vídeos do protetor (YouTube). Sorteia uma playlist/mix ou um vídeo a cada vez e começa num ponto aleatório.
  // Se o YouTube não tocar dentro do MyTV, o protetor usa as capas dos destaques.
  protetor: {
    player: "https://rlepri.github.io/mytv/player/",                      // endereço do player hospedado (ex.: https://rlepri.github.io/mytv/)
    listas: ["RDodgN3wLaAys"],       // a parte depois de "list=" no link
    videos: ["6h-sEV6uNxo"],         // a parte depois de "v=" no link
    bloquear: ["t-pain", "t pain", "bieber", "norah jones"] // pula vídeos com isso no título ou no canal
  },

  // Vitrines dos streamings (IDs de provedor do TMDB no Brasil)
  provedores: { netflix: "8", prime: "119", disney: "337", apple: "350", max: "1899|384" }
};
