// Client-side router. One shell (index.html), clean URLs, no full reloads.
import { renderScoreboard } from './page-scoreboard.js';
import { renderTeams } from './page-teams.js';
import { renderTeam } from './page-team.js';
import { renderEvent } from './page-event.js';
import { renderAbout } from './page-about.js';
import { renderScripts } from './page-scripts.js';
import { showNotFound } from './render.js';

const app = document.getElementById('app');
const navLinks = document.querySelectorAll('[data-nav]');

const routes = [
  { re: /^\/(?:index\.html)?$/, nav: 'scoreboard', run: () => renderScoreboard(app) },
  { re: /^\/teams\/?$/, nav: 'teams', run: () => renderTeams(app) },
  { re: /^\/team\/([^/]+)\/?$/, nav: 'teams', run: (m) => renderTeam(app, decodeURIComponent(m[1])) },
  { re: /^\/event\/([^/]+)\/?$/, nav: '', run: (m) => renderEvent(app, decodeURIComponent(m[1])) },
  { re: /^\/about\/?$/, nav: 'about', run: () => renderAbout(app) },
  { re: /^\/scripts\/?$/, nav: '', run: () => renderScripts(app) },
];

function setNav(name) {
  navLinks.forEach((a) => {
    const on = a.dataset.nav === name;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function route() {
  for (const r of routes) {
    const m = location.pathname.match(r.re);
    if (m) {
      setNav(r.nav);
      r.run(m);
      return;
    }
  }
  setNav('');
  document.title = 'Page not found - Human Flag League';
  showNotFound(app, 'Page not found', 'That page caught no flag.');
}

function internalLink(target) {
  const a = target.closest('a');
  if (!a) return null;
  const href = a.getAttribute('href');
  if (!href || href[0] !== '/' || a.target === '_blank' || a.hasAttribute('download')) return null;
  return href;
}

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const href = internalLink(e.target);
  if (href == null) return;
  e.preventDefault();
  if (href !== location.pathname + location.search + location.hash) {
    history.pushState(null, '', href);
    route();
    window.scrollTo(0, 0);
  }
  document.getElementById('nav')?.classList.remove('show');
});

window.addEventListener('popstate', route);

route();
