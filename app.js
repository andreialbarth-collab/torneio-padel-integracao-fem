/* Torneio Impulse Padel BVB — sistema de sorteio e classificação
 * 16 jogadores (8 direitas + 8 esquerdas), 5 rodadas, 4 jogos por rodada,
 * quadras Stone (verde) e Cresol (laranja). Dados salvos no navegador. */
(() => {
  'use strict';

  const KEY = 'impulse-padel-bvb-v1';
  const ROUNDS = 5;
  const N = 8;
  const RANDOM_ROUNDS = 2; // rodadas 1 e 2 totalmente aleatórias
  const COURTS = {
    stone: { name: 'Stone', tag: 'Quadra verde' },
    cresol: { name: 'Cresol', tag: 'Quadra laranja' },
  };
  const SLOTS = [
    { court: 'stone', slot: 1 }, { court: 'cresol', slot: 1 },
    { court: 'stone', slot: 2 }, { court: 'cresol', slot: 2 },
  ];
  const SIDE = { D: 'Direita', E: 'Esquerda' };

  const blank = () => ({
    version: 1,
    started: false,
    players: [],
    setup: { D: Array(N).fill(''), E: Array(N).fill('') },
    rounds: [],
    settings: { start: '14:00', game: 15, gap: 5 },
    tab: 'jogadores',
  });

  let S = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        return Object.assign(blank(), s, { settings: Object.assign(blank().settings, s.settings || {}) });
      }
    } catch (e) { /* armazenamento indisponível */ }
    return blank();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  // ---------- utilitários ----------
  function rnd() {
    if (window.crypto && crypto.getRandomValues) {
      const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296;
    }
    return Math.random();
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const player = (id) => S.players.find((p) => p.id === id);
  const pname = (id) => (player(id) ? player(id).name : '?');
  const done = (g) => Number.isInteger(g.sa) && Number.isInteger(g.sb);
  const roundDone = (r) => r.games.every(done);
  const lastRound = () => S.rounds[S.rounds.length - 1];
  const tkey = (team) => team.slice().sort().join('+');
  const courtSort = (a, b) => (a.court === 'stone' ? 0 : 1) - (b.court === 'stone' ? 0 : 1);
  const finished = () => S.rounds.length === ROUNDS && roundDone(lastRound());

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function slotTime(roundN, slot) {
    const [h, m] = (S.settings.start || '14:00').split(':').map(Number);
    const idx = (roundN - 1) * 2 + (slot - 1);
    const total = h * 60 + m + idx * (Number(S.settings.game) + Number(S.settings.gap));
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  // ---------- classificação ----------
  function standings() {
    const rows = {};
    S.players.forEach((p) => { rows[p.id] = { id: p.id, name: p.name, side: p.side, tb: p.tb, pts: 0, j: 0, v: 0, e: 0, d: 0, pf: 0, ps: 0, form: [] }; });
    S.rounds.forEach((r) => r.games.forEach((g) => {
      if (!done(g)) return;
      [[g.a, g.sa, g.sb], [g.b, g.sb, g.sa]].forEach(([team, f, s]) => team.forEach((id) => {
        const x = rows[id]; if (!x) return;
        x.j++; x.pf += f; x.ps += s;
        if (f > s) { x.v++; x.pts += 3; x.form.push('V'); }
        else if (f === s) { x.e++; x.pts += 1; x.form.push('E'); }
        else { x.d++; x.form.push('D'); }
      }));
    }));
    // 1) pontos  2) saldo  3) pontos feitos  4) sorteio (fixo, definido no início)
    const sort = (l) => l.sort((a, b) => b.pts - a.pts || (b.pf - b.ps) - (a.pf - a.ps) || b.pf - a.pf || a.tb - b.tb);
    const all = Object.values(rows);
    return { D: sort(all.filter((x) => x.side === 'D')), E: sort(all.filter((x) => x.side === 'E')) };
  }

  // ---------- sorteio ----------
  function teamsRandom(prev) {
    const D = S.players.filter((p) => p.side === 'D').map((p) => p.id);
    const E = S.players.filter((p) => p.side === 'E').map((p) => p.id);
    const prevPartners = new Set();
    if (prev) prev.games.forEach((g) => [g.a, g.b].forEach((t) => prevPartners.add(tkey(t))));
    let best = null; let bestCost = Infinity;
    for (let k = 0; k < 3000 && bestCost > 0; k++) {
      const e = shuffle(E); const d = shuffle(D);
      const teams = d.map((id, i) => [id, e[i]]);
      const cost = teams.filter((t) => prevPartners.has(tkey(t))).length;
      if (cost < bestCost) { best = teams; bestCost = cost; }
    }
    return best.map((p) => ({ p, label: '' }));
  }

  function teamsRanking() {
    const st = standings();
    return st.D.map((d, i) => ({ p: [d.id, st.E[N - 1 - i].id], label: `${i + 1}º D + ${N - i}º E` }));
  }

  function allMatchings(items) {
    if (!items.length) return [[]];
    const [a, ...rest] = items; const out = [];
    rest.forEach((b, i) => {
      const remaining = rest.filter((_, j) => j !== i);
      allMatchings(remaining).forEach((m) => out.push([[a, b], ...m]));
    });
    return out;
  }

  // Confrontos sempre aleatórios. Regra: não repetir confronto da rodada anterior.
  // Custo 1000 = mesma dupla x mesma dupla da rodada anterior (proibido).
  // Custo 1 por adversário individual repetido da rodada anterior (evitado quando possível).
  function matchups(teams, prev) {
    const prevMatch = new Set(); const prevOpp = new Set();
    if (prev) prev.games.forEach((g) => {
      prevMatch.add([tkey(g.a), tkey(g.b)].sort().join(' x '));
      g.a.forEach((x) => g.b.forEach((y) => prevOpp.add([x, y].sort().join('-'))));
    });
    let min = Infinity; let cands = [];
    allMatchings([...teams.keys()]).forEach((m) => {
      let c = 0;
      m.forEach(([i, j]) => {
        const A = teams[i].p; const B = teams[j].p;
        if (prevMatch.has([tkey(A), tkey(B)].sort().join(' x '))) c += 1000;
        A.forEach((x) => B.forEach((y) => { if (prevOpp.has([x, y].sort().join('-'))) c += 1; }));
      });
      if (c < min) { min = c; cands = [m]; } else if (c === min) cands.push(m);
    });
    const m = cands[Math.floor(rnd() * cands.length)];
    return shuffle(m).map(([i, j]) => (rnd() < 0.5 ? [teams[i], teams[j]] : [teams[j], teams[i]]));
  }

  function drawRound() {
    const n = S.rounds.length + 1;
    const prev = S.rounds[n - 2];
    const mode = n <= RANDOM_ROUNDS ? 'random' : 'ranking';
    const teams = mode === 'random' ? teamsRandom(prev) : teamsRanking();
    const games = matchups(teams, prev).map(([A, B], i) => ({
      id: `r${n}g${i + 1}`, court: SLOTS[i].court, slot: SLOTS[i].slot,
      a: A.p, b: B.p, la: A.label, lb: B.label, sa: null, sb: null,
    }));
    S.rounds.push({ n, mode, games, at: Date.now() });
  }

  function canDraw() {
    if (!S.started || S.rounds.length >= ROUNDS) return false;
    return !S.rounds.length || roundDone(lastRound());
  }
  const roundHasScores = (r) => r.games.some((g) => g.sa !== null || g.sb !== null);

  // ---------- ações ----------
  const actions = {
    tab(el) { S.tab = el.dataset.tab; save(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
    example() {
      const d = ['Lucas', 'Rafael', 'Bruno', 'Thiago', 'Diego', 'Marcelo', 'Felipe', 'André'];
      const e = ['Gustavo', 'Rodrigo', 'Pedro', 'Mateus', 'Daniel', 'Vinícius', 'Leandro', 'Caio'];
      S.setup = { D: d, E: e }; save(); render();
    },
    start() {
      const names = [...S.setup.D, ...S.setup.E].map((s) => s.trim());
      if (names.some((s) => !s)) return toast('Preencha os 16 nomes antes de iniciar.');
      const lower = names.map((s) => s.toLowerCase());
      if (new Set(lower).size !== lower.length) return toast('Há nomes repetidos. Use nomes únicos.');
      S.players = [
        ...S.setup.D.map((name, i) => ({ id: `D${i + 1}`, name: name.trim(), side: 'D', tb: rnd() })),
        ...S.setup.E.map((name, i) => ({ id: `E${i + 1}`, name: name.trim(), side: 'E', tb: rnd() })),
      ];
      S.started = true; S.tab = 'rodadas'; save(); render();
      toast('Torneio iniciado! Sorteie a 1ª rodada.');
    },
    draw() {
      if (!canDraw()) return toast('Finalize todos os placares da rodada atual antes de sortear.');
      drawRound(); S.tab = 'rodadas'; save(); render();
      toast(`Rodada ${S.rounds.length} sorteada!`);
    },
    redraw() {
      const r = lastRound();
      if (!r || roundHasScores(r)) return toast('Só é possível sortear de novo antes de lançar placares.');
      S.rounds.pop(); drawRound(); save(); render();
      toast(`Rodada ${r.n} sorteada novamente.`);
    },
    undo() {
      const r = lastRound();
      if (!r || roundHasScores(r)) return toast('Apague os placares desta rodada antes de desfazer.');
      if (!confirm(`Desfazer o sorteio da rodada ${r.n}?`)) return;
      S.rounds.pop(); save(); render();
    },
    fullscreen() {
      const el = document.documentElement;
      if (!document.fullscreenElement) (el.requestFullscreen ? el.requestFullscreen() : Promise.resolve()).catch(() => {});
      else document.exitFullscreen();
    },
    export() {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `torneio-impulse-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    import() { document.getElementById('importFile').click(); },
    reset() {
      if (!confirm('Apagar TODO o torneio (jogadores, rodadas e placares)? Faça um backup antes.')) return;
      S = blank(); save(); render(); toast('Torneio reiniciado.');
    },
  };

  // ---------- render ----------
  const sideTag = (id) => { const p = player(id); return p ? `<span class="side side-${p.side}">${p.side}</span>` : ''; };

  function header() {
    const n = S.rounds.length;
    const status = !S.started ? 'Inscrições' : finished() ? 'Torneio encerrado' : n ? `Rodada ${n} de ${ROUNDS}` : 'Aguardando sorteio';
    const dots = Array.from({ length: ROUNDS }, (_, i) => {
      const r = S.rounds[i];
      const cls = !r ? '' : roundDone(r) ? 'done' : 'live';
      return `<span class="dot ${cls}" title="Rodada ${i + 1}">${i + 1}</span>`;
    }).join('');
    return `
    <header class="hero">
      <div class="hero-inner">
        <div class="brand">
          <div class="ball" aria-hidden="true"></div>
          <div>
            <p class="eyebrow">Padel Futebolizado</p>
            <h1>Torneio Impulse Padel BVB</h1>
          </div>
        </div>
        <div class="chips">
          <span class="chip">📍 Impulse Padel BVB</span>
          <span class="chip">🕑 14:00 – 18:00</span>
          <span class="chip">👥 8 direitas + 8 esquerdas</span>
          <span class="chip">⏱️ Jogos de ${esc(S.settings.game)} min</span>
        </div>
        <div class="progress">
          <span class="status">${status}</span>
          <div class="dots">${dots}</div>
        </div>
      </div>
      <nav class="tabs" role="tablist">
        ${[['jogadores', 'Jogadores'], ['rodadas', 'Rodadas'], ['classificacao', 'Classificação'], ['telao', 'Telão'], ['regras', 'Regras']]
          .map(([k, l]) => `<button role="tab" class="tab ${S.tab === k ? 'active' : ''}" data-action="tab" data-tab="${k}" ${!S.started && ['rodadas', 'classificacao', 'telao'].includes(k) ? 'disabled' : ''}>${l}</button>`).join('')}
      </nav>
    </header>`;
  }

  function viewPlayers() {
    const col = (side) => {
      const list = S.started ? S.players.filter((p) => p.side === side) : S.setup[side].map((name, i) => ({ name, i }));
      return `
      <section class="card">
        <div class="card-head"><h2><span class="side side-${side} big">${side}</span> ${side === 'D' ? 'Direitas' : 'Esquerdas'}</h2><span class="muted">${N} jogadores</span></div>
        <ol class="name-list">
          ${list.map((p, i) => `
            <li><span class="num">${i + 1}</span>
              <input type="text" maxlength="28" placeholder="Nome do jogador ${i + 1}" value="${esc(p.name)}"
                ${S.started ? `data-pid="${p.id}"` : `data-side="${side}" data-idx="${i}"`} id="nm-${side}-${i}" autocomplete="off" />
            </li>`).join('')}
        </ol>
      </section>`;
    };
    return `
      <div class="grid2">${col('D')}${col('E')}</div>
      <section class="card">
        <div class="card-head"><h2>Configurações</h2></div>
        <div class="settings">
          <label>Início do 1º jogo<input type="time" data-setting="start" value="${esc(S.settings.start)}" /></label>
          <label>Duração do jogo (min)<input type="number" min="5" max="60" data-setting="game" value="${esc(S.settings.game)}" /></label>
          <label>Intervalo entre jogos (min)<input type="number" min="0" max="30" data-setting="gap" value="${esc(S.settings.gap)}" /></label>
        </div>
        <p class="muted small">Com 2 quadras, cada rodada tem 2 horários (2 jogos simultâneos em cada). Término previsto do último jogo: <b>${slotTimeEnd()}</b>.</p>
      </section>
      <div class="actions">
        ${S.started
          ? `<p class="muted">Torneio em andamento — você pode corrigir a grafia dos nomes; os lados são fixos.</p>`
          : `<button class="btn ghost" data-action="example">Preencher exemplo</button>
             <button class="btn primary" data-action="start">Iniciar torneio →</button>`}
      </div>
      <section class="card subtle">
        <div class="card-head"><h2>Backup</h2></div>
        <p class="muted small">Os dados ficam salvos neste navegador. Exporte um backup ao fim de cada rodada.</p>
        <div class="actions left">
          <button class="btn ghost" data-action="export">Exportar backup</button>
          <button class="btn ghost" data-action="import">Importar backup</button>
          <button class="btn danger" data-action="reset">Reiniciar torneio</button>
          <input type="file" id="importFile" accept="application/json" hidden />
        </div>
      </section>`;
  }

  function slotTimeEnd() {
    const last = slotTime(ROUNDS, 2);
    const [h, m] = last.split(':').map(Number);
    const t = h * 60 + m + Number(S.settings.game);
    return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  }

  function teamBlock(team, label, score, side, g, editable, r) {
    const win = done(g) && (side === 'a' ? g.sa > g.sb : g.sb > g.sa);
    const draw = done(g) && g.sa === g.sb;
    return `
      <div class="team ${win ? 'win' : ''} ${draw ? 'draw' : ''}">
        <div class="team-names">
          ${label ? `<span class="seed">${esc(label)}</span>` : ''}
          ${team.map((id) => `<div class="pl">${sideTag(id)}<span>${esc(pname(id))}</span></div>`).join('')}
        </div>
        ${editable
          ? `<input class="score" type="number" inputmode="numeric" min="0" max="99" id="s-${g.id}-${side}" data-game="${g.id}" data-round="${r.n}" data-team="${side}" value="${score ?? ''}" placeholder="–" aria-label="Placar" />`
          : `<span class="score ro">${score ?? '–'}</span>`}
      </div>`;
  }

  function gameCard(g, r, editable) {
    const c = COURTS[g.court];
    const res = !done(g) ? '<span class="pill wait">Aguardando placar</span>'
      : g.sa === g.sb ? '<span class="pill draw">Empate · 1 pt cada</span>'
        : '<span class="pill win">Vitória · 3 pts</span>';
    return `
      <article class="game court-${g.court}">
        <div class="game-head"><span class="court-name">Quadra ${c.name}</span><span class="court-tag">${c.tag}</span></div>
        ${teamBlock(g.a, g.la, g.sa, 'a', g, editable, r)}
        <div class="vs">x</div>
        ${teamBlock(g.b, g.lb, g.sb, 'b', g, editable, r)}
        <div class="game-foot">${res}</div>
      </article>`;
  }

  function roundCard(r, editable) {
    const slots = [1, 2].map((s) => {
      const gs = r.games.filter((g) => g.slot === s).sort(courtSort);
      return `
        <div class="slot">
          <div class="slot-head"><span>${s}º horário</span><span class="time">⏰ ${slotTime(r.n, s)}</span></div>
          <div class="games">${gs.map((g) => gameCard(g, r, editable)).join('')}</div>
        </div>`;
    }).join('');
    const ok = roundDone(r);
    return `
      <section class="card round ${ok ? 'closed' : 'open'}">
        <div class="card-head">
          <h2>Rodada ${r.n}</h2>
          <div class="badges">
            <span class="pill ${r.mode === 'random' ? 'random' : 'rank'}">${r.mode === 'random' ? '🎲 Duplas aleatórias' : '🤖 Duplas niveladas'}</span>
            <span class="pill ${ok ? 'win' : 'live'}">${ok ? 'Encerrada' : 'Em andamento'}</span>
          </div>
        </div>
        ${slots}
      </section>`;
  }

  function viewRounds() {
    const r = lastRound();
    const next = S.rounds.length + 1;
    let bar = '';
    if (finished()) {
      bar = `<div class="banner win">🏆 Torneio encerrado! Veja o resultado final na aba Classificação.</div>`;
    } else if (canDraw()) {
      const mode = next <= RANDOM_ROUNDS ? 'duplas e confrontos aleatórios' : 'duplas niveladas pela classificação, confrontos aleatórios';
      bar = `<div class="banner"><div><b>Pronto para a Rodada ${next}</b><span class="muted"> · ${mode}</span></div>
             <button class="btn primary" data-action="draw">🎲 Sortear rodada ${next}</button></div>`;
    } else if (r) {
      const left = r.games.filter((g) => !done(g)).length;
      bar = `<div class="banner live"><div><b>Rodada ${r.n} em andamento</b><span class="muted"> · falta${left > 1 ? 'm' : ''} ${left} placar${left > 1 ? 'es' : ''} para liberar o próximo sorteio</span></div>
        ${!roundHasScores(r) ? `<div class="row"><button class="btn ghost" data-action="redraw">Sortear de novo</button><button class="btn ghost" data-action="undo">Desfazer</button></div>` : ''}</div>`;
    }
    const cards = S.rounds.slice().reverse().map((x) => roundCard(x, x === r)).join('');
    const pending = Array.from({ length: ROUNDS - S.rounds.length }, (_, i) => {
      const n = S.rounds.length + i + 1;
      return `<div class="pending"><b>Rodada ${n}</b> · ${n <= RANDOM_ROUNDS ? '🎲 aleatória' : '🤖 nivelada pelo ranking'} · início previsto ${slotTime(n, 1)}</div>`;
    }).join('');
    return `${bar}${S.rounds.length && !finished() ? '<p class="muted small hint">Placar no estilo tie-break (pontos corridos). Empate é permitido. Apenas a rodada atual pode ser editada.</p>' : ''}${cards}${pending ? `<section class="card subtle"><div class="card-head"><h2>Próximas rodadas</h2></div>${pending}</section>` : ''}`;
  }

  function table(rows, side, compact) {
    return `
      <section class="card">
        <div class="card-head"><h2><span class="side side-${side} big">${side}</span> ${side === 'D' ? 'Direitas' : 'Esquerdas'}</h2></div>
        <div class="table-wrap">
        <table class="standings ${compact ? 'compact' : ''}">
          <thead><tr><th>#</th><th class="l">Jogador</th><th title="Pontos">P</th><th title="Jogos">J</th>${compact ? '' : '<th title="Vitórias">V</th><th title="Empates">E</th><th title="Derrotas">D</th><th title="Pontos feitos">PF</th><th title="Pontos sofridos">PS</th>'}<th title="Saldo">SG</th>${compact ? '' : '<th class="l">Últimos</th>'}</tr></thead>
          <tbody>
          ${rows.map((x, i) => `
            <tr class="${i < 3 ? `top top${i + 1}` : ''}">
              <td><span class="pos">${i + 1}</span></td>
              <td class="l name">${esc(x.name)}</td>
              <td><b>${x.pts}</b></td><td>${x.j}</td>
              ${compact ? '' : `<td>${x.v}</td><td>${x.e}</td><td>${x.d}</td><td>${x.pf}</td><td>${x.ps}</td>`}
              <td class="${x.pf - x.ps > 0 ? 'pos-sg' : x.pf - x.ps < 0 ? 'neg-sg' : ''}">${x.pf - x.ps > 0 ? '+' : ''}${x.pf - x.ps}</td>
              ${compact ? '' : `<td class="l"><span class="form">${x.form.map((f) => `<i class="f-${f}">${f}</i>`).join('')}</span></td>`}
            </tr>`).join('')}
          </tbody>
        </table></div>
      </section>`;
  }

  function viewStandings() {
    const st = standings();
    let extra = '';
    if (finished()) {
      extra = `
        <section class="card podium">
          <div class="card-head"><h2>🏆 Campeões</h2></div>
          <div class="grid2">
            ${['D', 'E'].map((s) => `<div class="champ"><span class="side side-${s} big">${s}</span><div><p class="muted small">Melhor ${SIDE[s].toLowerCase()}</p><p class="champ-name">${esc(st[s][0].name)}</p><p class="muted small">${st[s][0].pts} pts · saldo ${st[s][0].pf - st[s][0].ps}</p></div></div>`).join('')}
          </div>
        </section>`;
    } else if (S.rounds.length >= RANDOM_ROUNDS && canDraw()) {
      const n = S.rounds.length + 1;
      extra = `
        <section class="card subtle">
          <div class="card-head"><h2>Prévia das duplas · Rodada ${n}</h2><span class="muted small">confrontos serão sorteados</span></div>
          <div class="preview">
            ${st.D.map((d, i) => `<div class="pv"><span class="seed">${i + 1}º D + ${N - i}º E</span><span>${esc(d.name)} &amp; ${esc(st.E[N - 1 - i].name)}</span></div>`).join('')}
          </div>
        </section>`;
    }
    return `${extra}<div class="grid2">${table(st.D, 'D')}${table(st.E, 'E')}</div>
      <p class="muted small center">Critérios: 1º pontos (V=3, E=1, D=0) · 2º saldo de pontos · 3º pontos feitos · 4º sorteio.</p>`;
  }

  function viewTV() {
    const r = lastRound(); const st = standings();
    const games = r ? [1, 2].map((s) => `
      <div class="slot"><div class="slot-head"><span>${s}º horário</span><span class="time">⏰ ${slotTime(r.n, s)}</span></div>
      <div class="games">${r.games.filter((g) => g.slot === s).sort(courtSort).map((g) => gameCard(g, r, false)).join('')}</div></div>`).join('')
      : '<p class="muted">Nenhuma rodada sorteada ainda.</p>';
    return `
      <div class="tv">
        <div class="tv-head"><h2>${r ? `Rodada ${r.n} ${r.mode === 'random' ? '· 🎲 aleatória' : '· 🤖 nivelada'}` : 'Aguardando sorteio'}</h2>
          <button class="btn ghost" data-action="fullscreen">⛶ Tela cheia</button></div>
        <div class="tv-grid">
          <section class="card">${games}</section>
          <div>${table(st.D, 'D', true)}${table(st.E, 'E', true)}</div>
        </div>
      </div>`;
  }

  function viewRules() {
    return `
      <section class="card rules">
        <div class="card-head"><h2>Como funciona</h2></div>
        <div class="rules-grid">
          <div><h3>📋 Formato</h3><ul>
            <li>16 jogadores: 8 direitas + 8 esquerdas. Toda dupla tem 1 direita + 1 esquerda.</li>
            <li>5 rodadas, 4 jogos por rodada; cada jogador joga 1 jogo por rodada (5 no total).</li>
            <li>2 jogos na quadra Stone (verde) e 2 na Cresol (laranja), em 2 horários de ${esc(S.settings.game)} min.</li></ul></div>
          <div><h3>⚽ Pontuação</h3><ul>
            <li>Vitória 3 · Empate 1 · Derrota 0.</li>
            <li>Placar estilo tie-break, pontos corridos, sem vantagem.</li>
            <li>Os pontos do jogo valem para os dois jogadores da dupla.</li></ul></div>
          <div><h3>🥇 Desempate</h3><ul>
            <li>1º Pontos conquistados</li><li>2º Saldo de pontos</li><li>3º Pontos feitos</li>
            <li>4º Sorteio (definido automaticamente no início)</li></ul></div>
          <div><h3>🤖 Sorteio</h3><ul>
            <li>Rodadas 1 e 2: duplas totalmente aleatórias (na 2ª, evita repetir parceiro da 1ª).</li>
            <li>Rodadas 3 a 5: 1º D + 8º E, 2º D + 7º E … 8º D + 1º E.</li>
            <li>Confrontos e quadras sempre aleatórios; nunca repete o confronto (dupla x dupla) da rodada anterior e evita repetir adversários.</li>
            <li>A rodada seguinte só pode ser sorteada após todos os placares da atual.</li></ul></div>
        </div>
      </section>`;
  }

  function render() {
    const views = { jogadores: viewPlayers, rodadas: viewRounds, classificacao: viewStandings, telao: viewTV, regras: viewRules };
    if (!S.started && ['rodadas', 'classificacao', 'telao'].includes(S.tab)) S.tab = 'jogadores';
    document.body.classList.toggle('is-tv', S.tab === 'telao');
    document.getElementById('app').innerHTML = `${header()}<main class="container">${(views[S.tab] || viewPlayers)()}</main>
      <footer class="foot">Impulse Padel BVB · sistema de sorteio futebolizado</footer>`;
  }

  // ---------- eventos ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el && !el.disabled && actions[el.dataset.action]) actions[el.dataset.action](el);
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.side) { S.setup[t.dataset.side][Number(t.dataset.idx)] = t.value; save(); }
    else if (t.dataset.pid) { const p = player(t.dataset.pid); if (p && t.value.trim()) { p.name = t.value.trim(); save(); } }
    else if (t.dataset.setting) {
      const k = t.dataset.setting;
      S.settings[k] = k === 'start' ? t.value : Math.max(0, parseInt(t.value, 10) || 0); save();
    } else if (t.dataset.game) {
      const r = S.rounds.find((x) => x.n === Number(t.dataset.round));
      const g = r && r.games.find((x) => x.id === t.dataset.game);
      if (!g || r !== lastRound()) return;
      const v = t.value === '' ? null : Math.max(0, Math.min(99, parseInt(t.value, 10)));
      g[t.dataset.team === 'a' ? 'sa' : 'sb'] = Number.isInteger(v) ? v : null; save();
    }
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'importFile' && t.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || !Array.isArray(data.rounds) || !data.setup) throw new Error('inválido');
          S = Object.assign(blank(), data); save(); render(); toast('Backup importado.');
        } catch (err) { toast('Arquivo de backup inválido.'); }
      };
      reader.readAsText(t.files[0]);
      return;
    }
    if (t.dataset.game || t.dataset.setting || t.dataset.pid) {
      setTimeout(() => {
        const id = document.activeElement && document.activeElement.id;
        const wasDone = canDraw();
        render();
        if (id) { const el = document.getElementById(id); if (el) el.focus(); }
        if (t.dataset.game && wasDone && !finished()) toast(`Rodada ${lastRound().n} completa! Sorteio da próxima liberado.`);
        if (t.dataset.game && finished()) toast('🏆 Torneio encerrado!');
      }, 0);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('score')) {
      const inputs = [...document.querySelectorAll('input.score')];
      const next = inputs[inputs.indexOf(e.target) + 1];
      if (next) next.focus(); else e.target.blur();
    }
  });

  // expõe funções puras para testes automatizados
  window.__torneio = { get state() { return S; }, standings, drawRound, actions };

  render();
})();
