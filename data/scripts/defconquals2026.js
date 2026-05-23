// ==UserScript==
// @name         Human Flag League - DEF CON CTF Quals 2026
// @namespace    flag-league
// @description  Reduce the DEF CON CTF Quals 2026 scoreboard and challenges to Human Flag League teams, with scores recomputed among the league only.
// @homepage     https://flag-league.github.io/
// @match        https://bbbctf.com/*
// @run-at       document-start
// @grant        none
// @version      1.0.0
// ==/UserScript==

(function () {
  'use strict';

  const TEAMS_JSON = 'https://flag-league.github.io/data/teams.json';
  const SCOREBOARD_PATH = '/api/scoreboard';
  const CHALLENGES_PATH = '/api/challenges';

  const league = {
    async fetchJson(url) {
      const res = await fetch(url, { credentials: 'omit' });
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
      return res.json();
    },
    norm(name) {
      return String(name).trim().toLowerCase().replace(/\s+/g, ' ');
    },
    buildRoster(data) {
      return (data.teams || []).map((t) => ({
        id: t.id,
        name: t.name,
        names: new Set([t.name].concat(t.aliases || []).map(league.norm)),
      }));
    },
    matchRoster(name, roster) {
      const n = league.norm(name);
      return roster.find((r) => r.names.has(n)) || null;
    },
  };

  // bbbctf.com is a React SPA, so DOM rewriting won't work cleanly. Instead we
  // hook fetch, intercept /api/scoreboard and /api/challenges, and rewrite the
  // JSON before React sees it. Internal cross-fetches use originalFetch to
  // bypass the hook.
  const originalFetch = window.fetch.bind(window);

  // Flag-value formulas verified empirically against the live /api/challenges
  // payload on 2026-05-23. Each completed survey contributes +1 to the team
  // total (e.g. SuperDiceCodeLovers: 3001 from solves + 7 surveys = 3008).
  function flagValueAt(flag, leagueSolves) {
    const fn = flag.scoringFunction || {};
    if (fn.kind === 'Static') return fn.score || 0;
    if (fn.kind === 'External') return fn.maximum || 0;
    if (fn.kind === 'Logarithmic') {
      if (leagueSolves <= 0) return fn.initial || 0;
      return Math.max(fn.minimum || 0,
        Math.ceil(fn.initial - fn.decayFactor * Math.log(leagueSolves)));
    }
    return 0;
  }

  // External challenges (KOTH-style) carry a per-team per-solve `score` field
  // that doesn't depend on solve count, so the league filter doesn't change it.
  function teamSolveScore(flag, solve, leagueSolves) {
    const fn = flag.scoringFunction || {};
    if (fn.kind === 'External') return Number(solve.score) || 0;
    return flagValueAt(flag, leagueSolves);
  }

  let rosterPromise = null;
  function getRoster() {
    if (!rosterPromise) {
      rosterPromise = league.fetchJson(TEAMS_JSON).then(league.buildRoster);
    }
    return rosterPromise;
  }

  async function fetchRaw(path) {
    const res = await originalFetch(path);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + path);
    return res.json();
  }

  function indexFlags(challengesData) {
    const map = new Map();
    for (const c of (challengesData.challenges || [])) {
      for (const f of (c.flags || [])) map.set(f.id, f);
    }
    return map;
  }

  function filterLeague(scoreboardData, roster) {
    const out = [];
    for (const t of (scoreboardData.teams || [])) {
      if (league.matchRoster(t.name, roster)) out.push(t);
    }
    return out;
  }

  function countSolves(leagueTeams) {
    const counts = new Map();
    for (const t of leagueTeams) {
      for (const s of (t.solves || [])) {
        counts.set(s.flag, (counts.get(s.flag) || 0) + 1);
      }
    }
    return counts;
  }

  async function transformScoreboard(scoreboardData) {
    const [roster, challengesData] = await Promise.all([
      getRoster(), fetchRaw(CHALLENGES_PATH),
    ]);
    const flags = indexFlags(challengesData);
    const leagueTeams = filterLeague(scoreboardData, roster);
    const counts = countSolves(leagueTeams);

    const rescored = leagueTeams.map((t) => {
      let score = 0;
      for (const s of (t.solves || [])) {
        const f = flags.get(s.flag);
        if (!f) continue;
        score += teamSolveScore(f, s, counts.get(s.flag) || 0);
      }
      score += (t.surveys || []).length;
      return Object.assign({}, t, { score });
    });

    rescored.sort((a, b) =>
      b.score - a.score ||
      String(a.lastSolve || '').localeCompare(String(b.lastSolve || '')) ||
      a.name.localeCompare(b.name));

    let rank = 0, prev = null;
    rescored.forEach((t, i) => {
      if (prev === null || t.score !== prev) { rank = i + 1; prev = t.score; }
      t.rank = rank;
    });

    return Object.assign({}, scoreboardData, { teams: rescored });
  }

  async function transformChallenges(challengesData) {
    const [roster, scoreboardData] = await Promise.all([
      getRoster(), fetchRaw(SCOREBOARD_PATH),
    ]);
    const leagueTeams = filterLeague(scoreboardData, roster);
    const counts = countSolves(leagueTeams);

    const newChallenges = (challengesData.challenges || []).map((c) => ({
      ...c,
      flags: (c.flags || []).map((f) => {
        const n = counts.get(f.id) || 0;
        return { ...f, currentValue: flagValueAt(f, n), solveCount: n };
      }),
    }));

    return { ...challengesData, challenges: newChallenges };
  }

  function urlOf(input) {
    if (typeof input === 'string') return input;
    if (input && typeof input.url === 'string') return input.url;
    return '';
  }
  function pathOf(url) {
    try { return new URL(url, location.origin).pathname; }
    catch { return url; }
  }

  window.fetch = async function (input, init) {
    const path = pathOf(urlOf(input));
    const isScoreboard = path === SCOREBOARD_PATH;
    const isChallenges = path === CHALLENGES_PATH;
    if (!isScoreboard && !isChallenges) return originalFetch(input, init);

    const res = await originalFetch(input, init);
    if (!res.ok) return res;

    try {
      const data = await res.clone().json();
      const transformed = isScoreboard
        ? await transformScoreboard(data)
        : await transformChallenges(data);
      return new Response(JSON.stringify(transformed), {
        status: res.status,
        statusText: res.statusText,
        headers: new Headers(res.headers),
      });
    } catch (err) {
      console.error('[flag-league]', err);
      return res;
    }
  };
})();
