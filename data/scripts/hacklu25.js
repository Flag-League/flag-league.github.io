// ==UserScript==
// @name         Human Flag League - Hack.lu CTF 2025
// @namespace    flag-league
// @description  Reduce the Hack.lu CTF 2025 scoreboard and challenges to Human Flag League teams, with scores recomputed among the league only.
// @homepage     https://flag-league.github.io/
// @match        https://archive.fluxfingers.net/2025/*
// @run-at       document-idle
// @grant        none
// @version      1.0.0
// ==/UserScript==

(function () {
  'use strict';

  // ===========================================================================
  // GENERIC  -  CTF-agnostic league logic. Reuse for another CTF by copying this
  // section unchanged; only the ADAPTER section below is CTF-specific.
  // ===========================================================================

  const league = {
    async fetchDoc(url) {
      const res = await fetch(url, { credentials: 'omit' });
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
      return new DOMParser().parseFromString(await res.text(), 'text/html');
    },

    async fetchJson(url) {
      const res = await fetch(url, { credentials: 'omit' });
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
      return res.json();
    },

    intOf(text) {
      const m = String(text).replace(/,/g, '').match(/\d+/);
      return m ? parseInt(m[0], 10) : 0;
    },

    // textContent without <style>/<script> noise (this CTF inlines emotion
    // <style> tags inside table cells and challenge cards).
    text(el) {
      if (!el) return '';
      const clone = el.cloneNode(true);
      clone.querySelectorAll('style,script').forEach((n) => n.remove());
      return (clone.textContent || '').trim();
    },

    norm(name) {
      return String(name).trim().toLowerCase().replace(/\s+/g, ' ');
    },

    // teams.json -> [{ id, name, names:Set(normalized name + aliases) }]
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

    // samples [{solves, value}] -> f(n): the scoring curve, linearly
    // interpolated between samples and clamped at both ends.
    makeCurve(samples) {
      const bySolves = new Map();
      for (const s of samples) {
        if (s.solves >= 0 && s.value >= 0) bySolves.set(s.solves, s.value);
      }
      const pts = [...bySolves.entries()]
        .map(([solves, value]) => ({ solves, value }))
        .sort((a, b) => a.solves - b.solves);
      return function valueAt(n) {
        if (!pts.length) return 0;
        if (n <= pts[0].solves) return pts[0].value;
        const last = pts[pts.length - 1];
        if (n >= last.solves) return last.value;
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i];
          if (n <= b.solves) {
            const t = (n - a.solves) / (b.solves - a.solves);
            return a.value + t * (b.value - a.value);
          }
        }
        return last.value;
      };
    },

    // Recompute challenge values from league-only solve counts, then team
    // totals. teams: [{ name, solves:Set(challengeId), ... }].
    recalc(teams, challenges, curve) {
      const chal = challenges.map((c) => {
        let solves = 0;
        for (const t of teams) if (t.solves.has(c.id)) solves++;
        return Object.assign({}, c, {
          leagueSolves: solves,
          leagueValue: solves > 0 ? Math.round(curve(solves)) : 0,
        });
      });
      const valueOf = new Map(chal.map((c) => [c.id, c.leagueValue]));

      const ranked = teams.map((t) => {
        let score = 0;
        for (const id of t.solves) score += valueOf.get(id) || 0;
        return Object.assign({}, t, { leagueScore: score, solveCount: t.solves.size });
      });
      ranked.sort((a, b) =>
        b.leagueScore - a.leagueScore ||
        b.solveCount - a.solveCount ||
        a.name.localeCompare(b.name));

      let rank = 0, prev = null;
      ranked.forEach((t, i) => {
        if (prev === null || t.leagueScore !== prev) { rank = i + 1; prev = t.leagueScore; }
        t.leagueRank = rank;
      });
      return { challenges: chal, teams: ranked };
    },
  };

  // ===========================================================================
  // ADAPTER  -  Hack.lu CTF 2025  (archive.fluxfingers.net/2025).
  // Holds every CTF-specific detail: URLs and how to read/rewrite its pages.
  // ===========================================================================

  const BASE = 'https://archive.fluxfingers.net/2025/';
  const TEAMS_JSON = 'https://flag-league.github.io/data/teams.json';

  const adapter = {
    scoreboardUrl: BASE + 'scoreboard',
    challengesUrl: BASE + 'challenges',
    isScoreboard: () => /\/scoreboard(?:\.html)?$/.test(location.pathname),
    isChallenges: () => /\/challenges(?:\.html)?$/.test(location.pathname),

    // Scoreboard doc -> [{ name, teamUrl, ctfScore, ctfRank, el }].
    scrapeScoreboard(doc) {
      const rows = [];
      const seen = new Set();
      doc.querySelectorAll('a[href*="teams/"]').forEach((link) => {
        const href = link.getAttribute('href') || '';
        if (!/teams\/\d+\.html/.test(href)) return;
        const tr = link.closest('tr');
        if (!tr || seen.has(tr)) return;
        seen.add(tr);
        const cells = tr.querySelectorAll('td');
        const scoreCell = tr.querySelector('td[aria-label="Cart total"]');
        rows.push({
          name: league.text(link.querySelector('p') || link),
          teamUrl: new URL(href, BASE).href,
          ctfScore: league.intOf(league.text(scoreCell)),
          ctfRank: league.intOf(league.text(cells[0])),
          el: tr,
        });
      });
      return rows;
    },

    // Challenges doc -> [{ id, name, value, globalSolves }].
    scrapeChallenges(doc) {
      const out = [];
      const seen = new Set();
      doc.querySelectorAll('a[href*="challenges/"]').forEach((a) => {
        const m = (a.getAttribute('href') || '').match(/challenges\/(\d+)\.html/);
        if (!m || seen.has(m[1])) return;
        seen.add(m[1]);
        const text = league.text(a);
        const img = a.querySelector('img[alt]');
        const value = text.match(/\$\s*([\d,]+)/);
        const sold = text.match(/Already sold[^\d]*([\d,]+)/i);
        out.push({
          id: m[1],
          name: img ? img.alt.trim() : '#' + m[1],
          value: value ? league.intOf(value[1]) : 0,
          globalSolves: sold ? league.intOf(sold[1]) : 0,
        });
      });
      return out;
    },

    // Team-page doc -> Set of solved challenge ids.
    scrapeTeamSolves(doc) {
      const set = new Set();
      doc.querySelectorAll('a[href*="challenges/"]').forEach((a) => {
        const m = (a.getAttribute('href') || '').match(/challenges\/(\d+)\.html/);
        if (m) set.add(m[1]);
      });
      return set;
    },

    // Drop non-league rows; replace rank and score values in place.
    renderScoreboard(result) {
      const tbody = document.querySelector('table tbody');
      if (!tbody) throw new Error('Scoreboard table not found.');
      // Emotion injects <style> tags between rows; move them to <head> so they
      // survive once the non-league rows are dropped.
      tbody.querySelectorAll('style').forEach((s) => document.head.appendChild(s));
      tbody.replaceChildren.apply(tbody, result.teams.map((t) => {
        const cells = t.el.querySelectorAll('td');
        cells[0].textContent = t.leagueRank;
        const scoreCell = t.el.querySelector('td[aria-label="Cart total"]') ||
          cells[cells.length - 1];
        const p = scoreCell.querySelector('p');
        if (p) p.textContent = '$' + t.leagueScore;
        else scoreCell.textContent = '$' + t.leagueScore;
        return t.el;
      }));
    },

    // Replace each challenge's value and solve count with the league figures.
    renderChallenges(result) {
      const byId = new Map(result.challenges.map((c) => [c.id, c]));
      document.querySelectorAll('a[href*="challenges/"]').forEach((a) => {
        const m = (a.getAttribute('href') || '').match(/challenges\/(\d+)\.html/);
        if (!m) return;
        const c = byId.get(m[1]);
        if (!c) return;
        const sup = [...a.querySelectorAll('sup')]
          .find((s) => league.text(s).indexOf('$') >= 0);
        if (sup) {
          // The value sits after the "$"; skip any emotion <style> in between.
          let valueEl = sup.nextElementSibling;
          while (valueEl && (valueEl.tagName === 'STYLE' || valueEl.tagName === 'SCRIPT')) {
            valueEl = valueEl.nextElementSibling;
          }
          if (valueEl) valueEl.textContent = c.leagueValue;
        }
        const badge = [...a.querySelectorAll('span')]
          .find((s) => /already sold/i.test(league.text(s)));
        if (badge) {
          const nums = [...badge.querySelectorAll('span')]
            .filter((s) => /^\d[\d,]*$/.test(league.text(s)));
          if (nums.length) nums[nums.length - 1].textContent = c.leagueSolves;
        }
      });
    },
  };

  // ===========================================================================
  // ENTRY POINT
  // ===========================================================================

  async function main() {
    const onScoreboard = adapter.isScoreboard();
    const onChallenges = adapter.isChallenges();
    if (!onScoreboard && !onChallenges) return;

    try {
      const roster = league.buildRoster(await league.fetchJson(TEAMS_JSON));

      const sbDoc = onScoreboard ? document : await league.fetchDoc(adapter.scoreboardUrl);
      const teams = [];
      for (const row of adapter.scrapeScoreboard(sbDoc)) {
        if (league.matchRoster(row.name, roster)) teams.push(row);
      }
      if (!teams.length) throw new Error('No league teams found on the scoreboard.');

      const chDoc = onChallenges ? document : await league.fetchDoc(adapter.challengesUrl);
      const challenges = adapter.scrapeChallenges(chDoc);
      const curve = league.makeCurve(
        challenges.map((c) => ({ solves: c.globalSolves, value: c.value })));

      await Promise.all(teams.map(async (t) => {
        t.solves = adapter.scrapeTeamSolves(await league.fetchDoc(t.teamUrl));
      }));

      const result = league.recalc(teams, challenges, curve);
      if (onScoreboard) adapter.renderScoreboard(result);
      else adapter.renderChallenges(result);
    } catch (err) {
      console.error('[flag-league]', err);
    }
  }

  main();
})();
