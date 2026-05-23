// /scripts page: one card per CTF that has a userscript under
// data/scripts/<eventId>.js, with the event's metadata and a copy button.

import { loadData } from './data.js';
import { el, eventWhen, eventState, eventHref, showLoading, showError } from './render.js';

const SCRIPTS_DIR = '/data/scripts/';

const STATE_BADGE = {
  running: { label: 'Running', cls: 'text-bg-success' },
  upcoming: { label: 'Upcoming', cls: 'text-bg-primary' },
  past: { label: 'Past', cls: 'text-bg-secondary' },
};

export async function fetchScript(eventId) {
  try {
    const res = await fetch(`${SCRIPTS_DIR}${eventId}.js`, { cache: 'no-cache' });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall back to execCommand */ }
  try {
    const ta = el('textarea', { value: text });
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function copyButton(getText) {
  const label = el('span', {}, 'Copy script');
  const btn = el('button', { type: 'button', class: 'btn btn-sm btn-primary script-copy' }, label);
  let timer;
  btn.addEventListener('click', async () => {
    const ok = await copyText(getText());
    label.textContent = ok ? 'Copied!' : 'Copy failed';
    btn.classList.toggle('copied', ok);
    clearTimeout(timer);
    timer = setTimeout(() => {
      label.textContent = 'Copy script';
      btn.classList.remove('copied');
    }, 1800);
  });
  return btn;
}

function scriptCard({ id, event, source }) {
  const badge = STATE_BADGE[eventState(event)] || STATE_BADGE.past;
  return el('div', { class: 'col' },
    el('div', { class: 'card h-100 script-card' },
      el('div', { class: 'card-body d-flex flex-column' }, [
        el('div', { class: 'd-flex align-items-center gap-2 mb-1' }, [
          el('h2', { class: 'h5 mb-0 flex-grow-1' },
            el('a', { href: eventHref(id), class: 'cell-link' }, event.name)),
          el('span', { class: `badge ${badge.cls}` }, badge.label),
        ]),
        el('p', { class: 'small text-body-secondary mb-2' },
          `${eventWhen(event)}, weight ${event.weight}`),
        el('pre', { class: 'script-code mb-2' }, el('code', {}, source)),
        el('div', { class: 'd-flex align-items-center gap-3 mt-auto' }, [
          copyButton(() => source),
          el('a', { href: eventHref(id), class: 'small' }, 'CTF details'),
        ]),
      ])));
}

export async function renderScripts(app) {
  document.title = 'Scripts - Human Flag League';
  showLoading(app);

  let data;
  try {
    data = await loadData();
  } catch (err) {
    showError(app, err.message);
    return;
  }

  const entries = (await Promise.all(
    Object.keys(data.events).map(async (id) => ({
      id,
      event: data.events[id],
      source: await fetchScript(id),
    }))
  )).filter((e) => e.source);
  entries.sort((a, b) => (b.event.ends_at || 0) - (a.event.ends_at || 0));

  const header = [
    el('h1', { class: 'mb-1' }, 'Scripts'),
    el('p', { class: 'lead text-body-secondary mb-4' },
      'Browser userscripts that filter a CTF scoreboard down to the league and ' +
      'recompute scores among league teams only. Install one in a userscript ' +
      'manager such as Tampermonkey, then open the CTF.'),
  ];

  if (!entries.length) {
    app.replaceChildren(...header,
      el('p', { class: 'text-secondary' }, 'No userscripts are available yet.'));
    return;
  }

  app.replaceChildren(...header,
    el('div', { class: 'row row-cols-1 row-cols-lg-2 g-3' }, entries.map(scriptCard)));
}
