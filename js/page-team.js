import { loadData, getTeamBreakdown } from './data.js';
import {
  el, teamLogo, countryBadge, eventLink, dataTable,
  formatDate, formatPoints, showError, showNotFound, showLoading,
} from './render.js';

function yearSection(y) {
  const head = el('div', { class: 'd-flex flex-wrap align-items-baseline gap-2 mt-4 mb-2' }, [
    el('h2', { class: 'h4 mb-0' }, String(y.year)),
    el('span', { class: 'text-secondary small' },
      y.rank ? `League rank #${y.rank} of ${y.fieldSize}` : ''),
    el('span', { class: 'ms-auto text-body-secondary' }, `${formatPoints(y.subtotal)} pts`),
  ]);

  const table = dataTable(
    [
      { label: 'Rank', cls: 'col-rank' },
      { label: 'Event' },
      { label: 'Ended' },
      { label: 'Weight', end: true },
      { label: 'Points', end: true, cls: 'fw-semibold' },
    ],
    y.events.map((ev) => ({
      cells: [
        ev.rank != null ? String(ev.rank) : '-',
        eventLink(ev.eventId, ev.event.name),
        formatDate(ev.event.ends_at),
        formatPoints(ev.event.weight),
        formatPoints(ev.points),
      ],
    }))
  );

  return el('section', {}, [head, table]);
}

export async function renderTeam(app, id) {
  showLoading(app);

  let data;
  try {
    data = await loadData();
  } catch (err) {
    console.error(err);
    showError(app, "Couldn't load the league data. Please try again later.");
    return;
  }

  const breakdown = getTeamBreakdown(data, id);
  if (!breakdown) {
    document.title = 'Team not found - Human Flag League';
    showNotFound(app, 'Team not found', `There is no team with the id "${id}".`);
    return;
  }

  const { team, years, overallTotal } = breakdown;
  document.title = `${team.name} - Human Flag League`;

  const info = el('div', { class: 'flex-grow-1' }, [
    el('h1', { class: 'h3 mb-1' }, [team.name, ' ', countryBadge(team.country)]),
    team.description ? el('p', { class: 'mb-1' }, team.description) : null,
    team.aliases && team.aliases.length
      ? el('p', { class: 'text-secondary small mb-1' }, `Aliases: ${team.aliases.join(', ')}`)
      : null,
    team.web
      ? el('a', {
          href: team.web,
          target: '_blank',
          rel: 'noopener',
          class: 'text-decoration-none',
        }, team.web.replace(/^https?:\/\//, '').replace(/\/$/, ''))
      : null,
  ]);

  const total = el('div', { class: 'team-total text-end' }, [
    el('div', { class: 'team-total-value' }, formatPoints(overallTotal)),
    el('div', { class: 'team-total-label' }, 'points all-time'),
  ]);

  const header = el('div', {
    class: 'd-flex flex-wrap align-items-center gap-3 mb-2',
  }, [teamLogo(team, 72), info, total]);

  const body = years.length
    ? years.map(yearSection)
    : [el('p', { class: 'text-secondary' }, 'This team has not played any events yet.')];

  app.replaceChildren(
    el('p', { class: 'mb-3' }, el('a', { href: '/teams', class: 'back-link' }, '← Teams')),
    header,
    ...body
  );
}
