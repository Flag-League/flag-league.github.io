import {
  loadData, getYears, getYearScoreboard, getEventsByState,
} from './data.js';
import {
  el, teamCell, eventHref, dataTable, formatPoints, eventWhen,
  showError, showEmpty,
} from './render.js';

const tabsEl = document.getElementById('year-tabs');
const panesEl = document.getElementById('year-panes');
const sidebarEl = document.getElementById('events-sidebar');

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

function build(data, years, activeYear) {
  const tabs = [];
  const panes = [];
  for (const year of years) {
    const active = year === activeYear;
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
        dataset: { year: String(year) },
      }, String(year))));
    panes.push(el('div', {
      class: active ? 'tab-pane fade show active' : 'tab-pane fade',
      id: paneId,
      role: 'tabpanel',
      'aria-labelledby': tabId,
      tabindex: '0',
    }, scoreTable(data, year)));
  }
  tabsEl.replaceChildren(...tabs);
  panesEl.replaceChildren(...panes);
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

function renderSidebar(data) {
  const { upcoming, running, past } = getEventsByState(data);
  const groups = [
    eventsGroup('Upcoming', upcoming),
    eventsGroup('Running', running),
    eventsGroup('Past', past.slice(0, PAST_LIMIT)),
  ].filter(Boolean);
  sidebarEl.replaceChildren(...groups);
}

async function init() {
  let data;
  try {
    data = await loadData();
  } catch (err) {
    console.error(err);
    tabsEl.remove();
    showError(panesEl, "Couldn't load the league data. Please try again later.");
    return;
  }

  renderSidebar(data);

  const years = getYears(data);
  if (!years.length) {
    tabsEl.remove();
    showEmpty(panesEl, 'No events have been recorded yet.');
    return;
  }

  const fromUrl = Number(new URLSearchParams(location.search).get('year'));
  const active = years.includes(fromUrl) ? fromUrl : years[0];
  build(data, years, active);
  panesEl.removeAttribute('aria-busy');
  history.replaceState({ year: active }, '', `?year=${active}`);

  tabsEl.addEventListener('shown.bs.tab', (e) => {
    const year = e.target.dataset.year;
    if (year && new URLSearchParams(location.search).get('year') !== year) {
      history.pushState({ year: Number(year) }, '', `?year=${year}`);
    }
  });

  window.addEventListener('popstate', () => {
    const y = Number(new URLSearchParams(location.search).get('year'));
    const target = years.includes(y) ? y : years[0];
    const btn = document.getElementById(`tab-${target}`);
    if (btn && !btn.classList.contains('active')) btn.click();
  });
}

init();
