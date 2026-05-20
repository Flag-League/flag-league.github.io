import { loadData, getEventParticipants } from './data.js';
import {
  el, teamCell, dataTable, eventState, eventWhen,
  formatPoints, formatScore, showError, showNotFound,
} from './render.js';

const contentEl = document.getElementById('content');

function render({ event, participants }) {
  document.title = `${event.name} - Human Flag League`;
  contentEl.removeAttribute('aria-busy');

  const header = el('div', { class: 'mb-3' }, [
    el('h1', { class: 'h3 mb-1' }, event.name),
    el('p', { class: 'text-secondary mb-0' },
      `${eventWhen(event)} · weight ${formatPoints(event.weight)}`),
  ]);

  let body;
  if (!participants.length) {
    body = el('p', { class: 'text-secondary' },
      eventState(event) === 'upcoming'
        ? 'This CTF has not started yet.'
        : 'No results recorded for this CTF.');
  } else {
    body = dataTable(
      [
        { label: 'Rank', cls: 'col-rank' },
        { label: 'Team' },
        { label: 'Score', end: true },
        { label: 'Points', end: true, cls: 'fw-semibold' },
      ],
      participants.map((p) => ({
        cls: p.rank === 1 ? 'leader' : null,
        cells: [
          String(p.rank),
          teamCell(p.team),
          formatScore(p.score),
          formatPoints(p.points),
        ],
      }))
    );
  }

  contentEl.replaceChildren(header, body);
}

async function init() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    showNotFound(contentEl, 'Event not found', 'No event was specified in the link.');
    return;
  }

  let data;
  try {
    data = await loadData();
  } catch (err) {
    console.error(err);
    showError(contentEl, "Couldn't load the league data. Please try again later.");
    return;
  }

  const result = getEventParticipants(data, id);
  if (!result) {
    showNotFound(contentEl, 'Event not found', `There is no event with the id "${id}".`);
    return;
  }
  render(result);
}

init();
