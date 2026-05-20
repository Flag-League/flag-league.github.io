import { loadData } from './data.js';
import { el, teamLogo, countryBadge, teamHref, showError, showEmpty } from './render.js';

const gridEl = document.getElementById('teams-grid');

function card(team) {
  return el('div', { class: 'col' },
    el('div', { class: 'card h-100 team-card' },
      el('div', { class: 'card-body d-flex flex-column' }, [
        el('div', { class: 'd-flex align-items-center gap-3 mb-2' }, [
          teamLogo(team, 48),
          el('h2', { class: 'h5 mb-0' }, [
            el('a', {
              href: teamHref(team),
              class: 'text-decoration-none stretched-link',
            }, team.name),
            ' ',
            countryBadge(team.country),
          ]),
        ]),
        team.description
          ? el('p', { class: 'text-secondary small flex-grow-1 mb-2' }, team.description)
          : el('div', { class: 'flex-grow-1' }),
        team.web
          ? el('a', {
              href: team.web,
              target: '_blank',
              rel: 'noopener',
              class: 'small card-weblink',
            }, team.web.replace(/^https?:\/\//, '').replace(/\/$/, ''))
          : null,
      ])));
}

async function init() {
  let data;
  try {
    data = await loadData();
  } catch (err) {
    console.error(err);
    showError(gridEl, "Couldn't load the league data. Please try again later.");
    return;
  }

  if (!data.teams.length) {
    showEmpty(gridEl, 'No teams yet.');
    return;
  }
  gridEl.removeAttribute('aria-busy');
  gridEl.replaceChildren(
    el('div', { class: 'row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3' },
      data.teams.map(card))
  );
}

init();
