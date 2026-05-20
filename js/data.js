// Data loading and the scoring/ranking pipeline. No DOM.

let cached = null;

export async function loadData() {
  if (cached) return cached;

  let res;
  try {
    res = await fetch('/data/teams.json', { cache: 'no-cache' });
  } catch {
    throw new Error('Could not reach teams.json (network error).');
  }
  if (!res.ok) throw new Error(`Could not load teams.json (HTTP ${res.status}).`);

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('teams.json is not valid JSON.');
  }

  if (!data || typeof data !== 'object' ||
      typeof data.events !== 'object' || data.events === null ||
      !Array.isArray(data.teams)) {
    throw new Error('teams.json has an unexpected shape.');
  }
  cached = data;
  return data;
}

function yearOf(unixSeconds) {
  return new Date(unixSeconds * 1000).getUTCFullYear();
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

export function computePoints(score, best, weight) {
  if (!(best > 0) || !(weight >= 0) || !(score >= 0)) return 0;
  return (score / best) * weight;
}

export function eventBest(data, eventId) {
  let best = 0;
  for (const team of data.teams) {
    const r = team.events?.[eventId];
    if (r && typeof r.score === 'number' && r.score > best) best = r.score;
  }
  return best;
}

export function getYears(data) {
  const years = new Set();
  for (const ev of Object.values(data.events)) {
    if (ev && typeof ev.ends_at === 'number') years.add(yearOf(ev.ends_at));
  }
  return [...years].sort((a, b) => b - a);
}

export function getTeamById(data, id) {
  return data.teams.find((t) => t.id === id) || null;
}

export function getEventById(data, id) {
  return data.events[id] || null;
}

export function getYearScoreboard(data, year) {
  const eventIds = Object.keys(data.events).filter(
    (id) => yearOf(data.events[id].ends_at) === year
  );
  const bestByEvent = new Map();
  const best = (id) => {
    if (!bestByEvent.has(id)) bestByEvent.set(id, eventBest(data, id));
    return bestByEvent.get(id);
  };

  const rows = [];
  for (const team of data.teams) {
    let points = 0;
    let eventsPlayed = 0;
    for (const id of eventIds) {
      const r = team.events?.[id];
      if (!r) continue;
      eventsPlayed++;
      points += computePoints(r.score, best(id), data.events[id].weight);
    }
    if (eventsPlayed > 0) rows.push({ team, points, eventsPlayed });
  }

  rows.sort((a, b) =>
    b.points - a.points ||
    b.eventsPlayed - a.eventsPlayed ||
    a.team.name.localeCompare(b.team.name));

  let rank = 0;
  let prev = null;
  rows.forEach((row, i) => {
    if (prev === null || round1(row.points) !== round1(prev)) {
      rank = i + 1;
      prev = row.points;
    }
    row.rank = rank;
  });
  return rows;
}

export function getTeamBreakdown(data, teamId) {
  const team = getTeamById(data, teamId);
  if (!team) return null;

  const byYear = new Map();
  for (const eventId of Object.keys(team.events || {})) {
    const event = data.events[eventId];
    if (!event) continue;
    const mine = getEventParticipants(data, eventId)
      .participants.find((p) => p.team.id === team.id);
    if (!mine) continue;
    const year = yearOf(event.ends_at);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push({
      eventId,
      event,
      rank: mine.rank,
      points: mine.points,
    });
  }

  const years = [...byYear.keys()]
    .sort((a, b) => b - a)
    .map((year) => {
      const events = byYear
        .get(year)
        .sort((a, b) => a.event.ends_at - b.event.ends_at);
      const subtotal = events.reduce((s, e) => s + e.points, 0);
      const board = getYearScoreboard(data, year);
      const me = board.find((r) => r.team.id === team.id);
      return {
        year,
        events,
        subtotal,
        rank: me ? me.rank : null,
        fieldSize: board.length,
      };
    });

  const overallTotal = years.reduce((s, y) => s + y.subtotal, 0);
  return { team, years, overallTotal };
}

// League placement for one event: league teams sorted by their CTF place,
// then numbered 1, 2, 3, ... so the gaps left by non-league teams disappear.
export function getEventParticipants(data, eventId) {
  const event = getEventById(data, eventId);
  if (!event) return null;

  const best = eventBest(data, eventId);
  const rows = [];
  for (const team of data.teams) {
    const r = team.events?.[eventId];
    if (!r) continue;
    rows.push({
      team,
      score: r.score,
      place: r.place,
      points: computePoints(r.score, best, event.weight),
    });
  }

  rows.sort((a, b) =>
    (a.place ?? Infinity) - (b.place ?? Infinity) ||
    a.team.name.localeCompare(b.team.name));

  let rank = 0;
  let prevPlace = null;
  rows.forEach((row, i) => {
    if (prevPlace === null || row.place !== prevPlace) {
      rank = i + 1;
      prevPlace = row.place;
    }
    row.rank = rank;
  });

  return { event, eventId, best, participants: rows };
}

// Events split into upcoming / running / past relative to `nowSeconds`.
export function getEventsByState(data, nowSeconds = Date.now() / 1000) {
  const upcoming = [];
  const running = [];
  const past = [];
  for (const [id, event] of Object.entries(data.events)) {
    const entry = { id, event };
    if (event.starts_at > nowSeconds) upcoming.push(entry);
    else if (event.ends_at > nowSeconds) running.push(entry);
    else past.push(entry);
  }
  upcoming.sort((a, b) => a.event.starts_at - b.event.starts_at);
  running.sort((a, b) => a.event.ends_at - b.event.ends_at);
  past.sort((a, b) => b.event.ends_at - a.event.ends_at);
  return { upcoming, running, past };
}
