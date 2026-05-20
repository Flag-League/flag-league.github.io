import { loadData, getYears, getYearScoreboard, getEventsByState } from './data.js';
import {
  el, teamCell, eventHref, dataTable, formatPoints, eventWhen,
  showError, showLoading,
} from './render.js';

const PAST_LIMIT = 6;

function scoreTable(data, year) {
  const rows = getYearScoreboard(data, year);
  if (!rows.length) {
    return el('p', { class: 'text-secondary text-center py-5' },
      `No results recorded for ${year} yet.`);
  }
  return dataTable(
    [
      { label: 'Rank', cls: 'col-rank' },
      { label: 'Team' },
      { label: 'Points', end: true, cls: 'fw-semibold' },
    ],
    rows.map((r) => ({
      cls: r.rank === 1 ? 'leader' : null,
      cells: [String(r.rank), teamCell(r.team), formatPoints(r.points)],
    }))
  );
}

function scoreboardPanel(data) {
  const years = getYears(data);
  if (!years.length) {
    return el('p', { class: 'text-secondary text-center py-5' },
      'No events have been recorded yet.');
  }
  const tabs = [];
  const panes = [];
  years.forEach((year, i) => {
    const active = i === 0;
    const tabId = `tab-${year}`;
    const paneId = `pane-${year}`;
    tabs.push(el('li', { class: 'nav-item', role: 'presentation' },
      el('button', {
        class: active ? 'nav-link active' : 'nav-link',
        id: tabId,
        type: 'button',
        role: 'tab',
        'data-bs-toggle': 'tab',
        'data-bs-target': `#${paneId}`,
        'aria-controls': paneId,
        'aria-selected': active ? 'true' : 'false',
      }, String(year))));
    panes.push(el('div', {
      class: active ? 'tab-pane fade show active' : 'tab-pane fade',
      id: paneId,
      role: 'tabpanel',
      'aria-labelledby': tabId,
      tabindex: '0',
    }, scoreTable(data, year)));
  });
  return el('div', {}, [
    el('ul', { class: 'nav nav-tabs', role: 'tablist' }, tabs),
    el('div', { class: 'tab-content pt-3' }, panes),
  ]);
}

function eventsGroup(title, entries) {
  if (!entries.length) return null;
  return el('div', { class: 'events-group' }, [
    el('h3', { class: 'events-heading' }, title),
    el('div', { class: 'events-list' },
      entries.map(({ id, event }) =>
        el('a', { class: 'event-item', href: eventHref(id) }, [
          el('span', { class: 'event-item-name' }, event.name),
          el('span', { class: 'event-item-date' }, eventWhen(event)),
        ]))),
  ]);
}

function eventsPanel(data) {
  const { upcoming, running, past } = getEventsByState(data);
  const groups = [
    eventsGroup('Upcoming', upcoming),
    eventsGroup('Running', running),
    eventsGroup('Past', past.slice(0, PAST_LIMIT)),
  ].filter(Boolean);
  return groups.length
    ? el('div', {}, groups)
    : el('p', { class: 'text-secondary' }, 'No events yet.');
}

export async function renderScoreboard(app) {
  document.title = 'Human Flag League';
  showLoading(app);

  let data;
  try {
    data = await loadData();
  } catch (err) {
    console.error(err);
    showError(app, "Couldn't load the league data. Please try again later.");
    return;
  }

  app.replaceChildren(
    el('h1', { class: 'mb-1' }, 'Stop the slopping in CTFs.'),
    el('p', { class: 'hero-tagline mb-4' }, [
      'This CTF league is an attempt to make playing CTFs fun again.',
      el('br'),
      "We follow a strict non-AI policy and don't care about Clankers and their teams.",
    ]),
    el('div', { class: 'row g-4' }, [
      el('div', { class: 'col-lg-8' }, [
        el('h2', { class: 'h4 mb-3' }, 'Scoreboard'),
        scoreboardPanel(data),
      ]),
      el('div', { class: 'col-lg-4' }, [
        el('h2', { class: 'h4 mb-3' }, 'Events'),
        eventsPanel(data),
      ]),
    ])
  );
}
