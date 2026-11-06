/* MyTV — fontes de dados: clima (Open-Meteo), placares (ESPN), filmes (TMDB), nota IMDb (OMDb) */
(function () {
  const C = window.MYTV_CONFIG;

  function get(url, headers, ms, body) {
    return new Promise((ok, fail) => {
      const x = new XMLHttpRequest(); x.open(body ? 'POST' : 'GET', url, true); x.timeout = ms || 12000;
      Object.keys(headers || {}).forEach(k => x.setRequestHeader(k, headers[k]));
      x.onload = () => { if (x.status >= 200 && x.status < 300) { try { ok(JSON.parse(x.responseText)); } catch (e) { fail(e); } } else fail(new Error('HTTP ' + x.status + ' ' + url)); };
      x.onerror = () => fail(new Error('rede ' + url)); x.ontimeout = () => fail(new Error('tempo ' + url)); x.send(body ? JSON.stringify(body) : null);
    });
  }
  // cache simples no aparelho
  function cached(key, ttlMin, fn) {
    try { const c = JSON.parse(localStorage.getItem('c:' + key) || 'null'); if (c && Date.now() - c.t < ttlMin * 60000) return Promise.resolve(c.v); } catch (e) { }
    return fn().then(v => { try { localStorage.setItem('c:' + key, JSON.stringify({ t: Date.now(), v: v })); } catch (e) { } return v; });
  }

  /* clima */
  const WX = { 0: 'céu limpo', 1: 'poucas nuvens', 2: 'parcialmente nublado', 3: 'nublado', 45: 'neblina', 48: 'neblina', 51: 'garoa', 53: 'garoa', 55: 'garoa', 61: 'chuva fraca', 63: 'chuva', 65: 'chuva forte', 80: 'pancadas de chuva', 81: 'pancadas de chuva', 82: 'temporal', 95: 'trovoadas', 96: 'trovoadas', 99: 'trovoadas' };
  function weather() {
    const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + C.local.lat + '&longitude=' + C.local.lon + '&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=2&timezone=' + encodeURIComponent(C.fuso);
    return cached('wx', 20, () => get(u)).then(d => ({
      temp: Math.round(d.current.temperature_2m), desc: WX[d.current.weather_code] || '', isDay: !!d.current.is_day,
      amanha: { max: Math.round(d.daily.temperature_2m_max[1]), min: Math.round(d.daily.temperature_2m_min[1]), desc: WX[d.daily.weather_code[1]] || '' }
    }));
  }

  /* placares */
  function hasSpoiler(names) { return C.spoiler.some(s => names.some(n => n.toLowerCase().indexOf(s.toLowerCase()) >= 0)); }
  function parseEvent(ev, lg) {
    const comp = (ev.competitions || [])[0] || {}, st = (comp.status || ev.status || {}), type = st.type || {};
    const cs = (comp.competitors || []).slice().sort((a, b) => (a.homeAway === 'home' ? 1 : 0) - (b.homeAway === 'home' ? 1 : 0));
    // ESPN: futebol vem mandante x visitante; NBA/NFL o costume é visitante @ mandante. Mantemos mandante primeiro no futebol.
    const order = lg.esporte === 'soccer' ? cs.slice().reverse() : cs;
    const teams = order.map(c => ({ name: (c.team || {}).shortDisplayName || (c.team || {}).displayName || '?', full: (c.team || {}).displayName || '', abbr: (c.team || {}).abbreviation || '', logo: (c.team || {}).logo || '', score: c.score, winner: !!c.winner }));
    const names = teams.map(t => t.full + ' ' + t.name);
    const bc = ((comp.broadcasts || [])[0] || {}).names || [];
    return {
      id: ev.id, liga: lg, date: new Date(ev.date), state: type.state || 'pre', detail: type.shortDetail || type.detail || '', clock: st.displayClock, period: st.period,
      teams: teams, spoiler: hasSpoiler(names), tv: bc[0] || '', big: C.timesGrandes.some(g => names.some(n => n.indexOf(g) >= 0))
    };
  }
  function ymd(d) { return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
  function scoreboard(lg) {
    const u = 'https://site.api.espn.com/apis/site/v2/sports/' + lg.esporte + '/' + lg.liga + '/scoreboard?dates=' + ymd(new Date());
    return get(u).then(d => (d.events || []).map(e => parseEvent(e, lg))).catch(() => []);
  }
  function allGames() { return Promise.all(C.ligas.map(scoreboard)).then(a => [].concat.apply([], a)); }

  /* TMDB */
  const IMG = 'https://image.tmdb.org/t/p/';
  function tmdb(path, ttl) {
    if (!C.tmdbToken) return Promise.reject(new Error('sem chave TMDB'));
    const sep = path.indexOf('?') >= 0 ? '&' : '?';
    return cached('t:' + path, ttl || 180, () => get('https://api.themoviedb.org/3' + path + sep + 'language=pt-BR', { Authorization: 'Bearer ' + C.tmdbToken, accept: 'application/json' }));
  }
  function norm(r, kind) {
    const type = r.media_type || kind || (r.first_air_date ? 'tv' : 'movie');
    return { id: r.id, type: type, title: r.title || r.name || '', text: r.overview || '', year: (r.release_date || r.first_air_date || '').slice(0, 4), vote: r.vote_average ? r.vote_average.toFixed(1).replace('.', ',') : '', backdrop: r.backdrop_path ? IMG + 'w1280' + r.backdrop_path : '', backdropS: r.backdrop_path ? IMG + 'w300' + r.backdrop_path : '', backdropM: r.backdrop_path ? IMG + 'w780' + r.backdrop_path : '', pop: r.popularity || 0, poster: r.poster_path ? IMG + 'w500' + r.poster_path : '', genres: r.genre_ids || [] };
  }
  const list = (path, kind) => tmdb(path).then(d => (d.results || []).map(r => norm(r, kind)).filter(x => x.backdrop || x.poster));
  const trending = () => list('/trending/all/week');
  const nowPlaying = () => list('/movie/now_playing?region=BR', 'movie');
  const streamingHot = () => list('/trending/all/day');
  function topRated() {
    const since = (new Date().getFullYear() - 6) + '-01-01';
    return list('/discover/movie?sort_by=vote_average.desc&vote_count.gte=1500&primary_release_date.gte=' + since + '&watch_region=BR&with_watch_monetization_types=flatrate', 'movie');
  }
  const iso = d => d.toISOString().slice(0, 10);
  // vitrine por streaming (TMDB, catálogo do Brasil): o que saiu nos últimos N dias, por popularidade
  function provider(ids, days) {
    const to = iso(new Date()), from = iso(new Date(Date.now() - days * 864e5)), base = '&watch_region=BR&with_watch_providers=' + ids + '&sort_by=popularity.desc&vote_count.gte=5';
    return Promise.all([
      list('/discover/movie?primary_release_date.gte=' + from + '&primary_release_date.lte=' + to + base, 'movie').catch(() => []),
      list('/discover/tv?first_air_date.gte=' + from + '&first_air_date.lte=' + to + base, 'tv').catch(() => [])
    ]).then(a => a[0].concat(a[1]).sort((x, y) => y.pop - x.pop));
  }
  let GEN = null;
  function genres() { if (GEN) return Promise.resolve(GEN); return Promise.all([tmdb('/genre/movie/list', 10080), tmdb('/genre/tv/list', 10080)]).then(a => { GEN = {}; a.forEach(d => (d.genres || []).forEach(g => GEN[g.id] = g.name)); return GEN; }).catch(() => (GEN = {})); }
  function logo(it) {
    return tmdb('/' + it.type + '/' + it.id + '/images?include_image_language=pt,en,null', 1440).then(d => { const l = (d.logos || []).find(x => x.iso_639_1 === 'pt') || (d.logos || [])[0]; return l ? IMG + 'w500' + l.file_path : ''; }).catch(() => '');
  }
  function providers(it) { return tmdb('/' + it.type + '/' + it.id + '/watch/providers', 720).then(d => ((d.results || {}).BR || {}).flatrate || []).then(f => f.map(p => p.provider_name)).catch(() => []); }
  function trailer(it) {
    return tmdb('/' + it.type + '/' + it.id + '/videos?include_video_language=pt,en', 1440).then(d => { const v = (d.results || []).filter(x => x.site === 'YouTube'); const t = v.find(x => x.type === 'Trailer' && x.iso_639_1 === 'pt') || v.find(x => x.type === 'Trailer') || v[0]; return t ? t.key : ''; }).catch(() => '');
  }
  function imdb(it) {
    if (!C.omdbKey) return Promise.resolve('');
    return tmdb('/' + it.type + '/' + it.id + '/external_ids', 10080).then(x => x.imdb_id ? cached('o:' + x.imdb_id, 1440, () => get('https://www.omdbapi.com/?i=' + x.imdb_id + '&apikey=' + C.omdbKey)) : {}).then(o => (o.imdbRating && o.imdbRating !== 'N/A') ? o.imdbRating.replace('.', ',') : '').catch(() => '');
  }

  /* Stremio: biblioteca e "continuar assistindo" da sua conta */
  function stremioKey() {
    if (C.stremioAuthKey) return Promise.resolve(C.stremioAuthKey);
    if (!C.stremioEmail || !C.stremioSenha) return Promise.reject(new Error('sem login do Stremio'));
    return cached('stremio-key', 43200, () => get('https://api.strem.io/api/login', { 'Content-Type': 'application/json' }, 12000, { type: 'Login', email: C.stremioEmail, password: C.stremioSenha, facebook: false }).then(r => { if (!r.result || !r.result.authKey) throw new Error('login do Stremio recusado'); return r.result.authKey; }));
  }
  function stremio() {
    return stremioKey().then(k => cached('stremio-lib', 8, () => get('https://api.strem.io/api/datastoreGet', { 'Content-Type': 'application/json' }, 15000, { authKey: k, collection: 'libraryItem', ids: [], all: true }).then(r => r.result || [])))
      .then(all => all.filter(i => i && i.name).map(i => {
        const st = i.state || {}, id = i._id || '';
        return { id: id, title: i.name, type: i.type, poster: i.poster || '', img: /^tt\d+/.test(id) ? 'https://images.metahub.space/background/medium/' + id.split(':')[0] + '/img' : (i.background || i.poster || ''), last: Date.parse(st.lastWatched || i._mtime || 0) || 0, progress: st.duration ? Math.min(1, st.timeOffset / st.duration) : 0, inProgress: st.timeOffset > 0 && (!st.duration || st.timeOffset / st.duration < .95), inLibrary: !i.removed && !i.temp, ep: st.season ? 'T' + st.season + ' E' + st.episode : '' };
      }));
  }

  /* YouTube: em alta no Brasil (chave grátis do Google) */
  function youtube() {
    if (!C.youtubeKey) return Promise.reject(new Error('sem chave do YouTube'));
    return cached('yt', 60, () => get('https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=BR&maxResults=24&key=' + C.youtubeKey))
      .then(d => (d.items || []).map(v => ({ id: v.id, title: v.snippet.title, channel: v.snippet.channelTitle, img: ((v.snippet.thumbnails.maxres || v.snippet.thumbnails.high || {}).url) || '' })));
  }

  /* Games: Steam (lançamentos e mais vendidos no Brasil, sem chave) */
  const money = c => c ? 'R$ ' + (c / 100).toFixed(2).replace('.', ',') : 'Gratuito';
  function games() {
    return cached('steam', 180, () => get('https://store.steampowered.com/api/featuredcategories?cc=br&l=portuguese')).then(d => {
      const seen = {}, out = [];
      [['new_releases', 'Lançamento'], ['top_sellers', 'Mais vendido']].forEach(([k, lab]) => (((d || {})[k] || {}).items || []).forEach(i => {
        if (!i || !i.id || seen[i.id] || !i.header_image || /steam deck|valve index/i.test(i.name || '')) return; seen[i.id] = 1;
        out.push({ id: i.id, title: i.name, img: i.header_image, big: 'https://cdn.akamai.steamstatic.com/steam/apps/' + i.id + '/library_hero.jpg', tag: lab, price: money(i.final_price) + (i.discount_percent ? ' (-' + i.discount_percent + '%)' : '') });
      }));
      return out;
    });
  }
  function gameInfo(id) {
    return cached('steamapp:' + id, 1440, () => get('https://store.steampowered.com/api/appdetails?appids=' + id + '&cc=br&l=portuguese')).then(d => {
      const x = ((d || {})[id] || {}).data || {};
      return { text: (x.short_description || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&'), genres: (x.genres || []).map(g => g.description).slice(0, 3), date: (x.release_date || {}).date || '', meta: (x.metacritic || {}).score || '' };
    }).catch(() => ({ text: '', genres: [], date: '', meta: '' }));
  }

  window.DATA = { weather, allGames, trending, nowPlaying, streamingHot, topRated, provider, genres, logo, providers, trailer, imdb, stremio, youtube, games, gameInfo };
})();
