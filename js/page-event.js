import { loadData, getEventParticipants } from './data.js';
import {
  el, teamCell, dataTable, eventState, eventWhen,
  formatPoints, formatScore, showError, showNotFound, showLoading,
} from './render.js';

export async function renderEvent(app, id) {
  showLoading(app);

  let data;
  try {
    data = await loadData();
  } catch (err) {
    console.error(err);
    showError(app, "Couldn't load the league data. Please try again later.");
    return;
  }

  const result = getEventParticipants(data, id);
  if (!result) {
    document.title = 'Event not found - Human Flag League';
    showNotFound(app, 'Event not found', `There is no event with the id "${id}".`);
    return;
  }

  const { event, participants } = result;
  document.title = `${event.name} - Human Flag League`;

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

  app.replaceChildren(
    el('p', { class: 'mb-3' }, el('a', { href: '/', class: 'back-link' }, '← Scoreboard')),
    header,
    body
  );
}
