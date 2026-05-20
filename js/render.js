// Shared DOM construction and formatting helpers.

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2), value);
    } else if (key in node) {
      node[key] = value;
    } else {
      node.setAttribute(key, value);
    }
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const child of kids) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function flagEmoji(code) {
  if (typeof code !== 'string' || !/^[A-Za-z]{2}$/.test(code)) return '';
  const A = 0x1f1e6;
  const up = code.toUpperCase();
  return String.fromCodePoint(
    A + up.charCodeAt(0) - 65,
    A + up.charCodeAt(1) - 65
  );
}

export function countryBadge(code) {
  const flag = flagEmoji(code);
  if (!flag) return document.createTextNode(code || '');
  return el('span', {
    class: 'flag',
    title: code.toUpperCase(),
    'aria-label': code.toUpperCase(),
  }, flag);
}

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatDate(unixSeconds) {
  if (typeof unixSeconds !== 'number') return 'n/a';
  return dateFormat.format(new Date(unixSeconds * 1000));
}

export function formatPoints(n) {
  return (Number.isFinite(n) ? n : 0).toFixed(1);
}

export function formatScore(n) {
  return Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '0';
}

export function eventState(event, nowSeconds = Date.now() / 1000) {
  if (event.starts_at > nowSeconds) return 'upcoming';
  if (event.ends_at > nowSeconds) return 'running';
  return 'past';
}

export function eventWhen(event, nowSeconds = Date.now() / 1000) {
  const state = eventState(event, nowSeconds);
  if (state === 'upcoming') return `Starts ${formatDate(event.starts_at)}`;
  if (state === 'running') return `Started ${formatDate(event.starts_at)}`;
  return `Ended ${formatDate(event.ends_at)}`;
}

export function teamHref(team) {
  return `/team/${encodeURIComponent(team.id)}`;
}

export function eventHref(eventId) {
  return `/event/${encodeURIComponent(eventId)}`;
}

export function teamLogo(team, size = 28) {
  const img = el('img', {
    class: 'team-logo',
    width: size,
    height: size,
    loading: 'lazy',
    alt: '',
    src: team.logo_url || '/img/ctf-league.svg',
  });
  img.addEventListener('error', () => {
    if (!img.src.endsWith('/img/ctf-league.svg')) img.src = '/img/ctf-league.svg';
  }, { once: true });
  return img;
}

export function eventLink(eventId, content) {
  return el('a', { href: eventHref(eventId), class: 'cell-link' }, content);
}

export function teamCell(team) {
  return el('a', {
    href: teamHref(team),
    class: 'team-cell d-inline-flex align-items-center gap-2 text-decoration-none',
  }, [teamLogo(team), el('span', {}, team.name)]);
}

function colClass(col) {
  return [col.end ? 'text-end' : null, col.cls || null]
    .filter(Boolean).join(' ') || null;
}

// Shared table: columns [{label, end?, cls?}], rows [{cls?, cells:[...]}].
// The first cell of each row becomes a row header.
export function dataTable(columns, rows) {
  return el('div', { class: 'table-responsive' },
    el('table', { class: 'table table-hover align-middle mb-0' }, [
      el('thead', {}, el('tr', {}, columns.map((c) =>
        el('th', { scope: 'col', class: colClass(c) }, c.label)))),
      el('tbody', {}, rows.map((r) =>
        el('tr', { class: r.cls || null }, r.cells.map((cell, i) =>
          el(i === 0 ? 'th' : 'td', {
            scope: i === 0 ? 'row' : null,
            class: colClass(columns[i]),
          }, cell))))),
    ]));
}

export function showLoading(container) {
  container.replaceChildren(
    el('div', { class: 'text-center text-secondary py-5' },
      el('div', { class: 'spinner-border', role: 'status' },
        el('span', { class: 'visually-hidden' }, 'Loading')))
  );
}

export function showError(container, message) {
  container.replaceChildren(
    el('div', { class: 'alert alert-danger', role: 'alert' }, message)
  );
}

export function showNotFound(container, title, message) {
  container.replaceChildren(
    el('h1', { class: 'h3' }, title),
    el('p', { class: 'text-secondary' }, message),
    el('a', { href: '/', class: 'btn btn-primary' }, 'Back to the scoreboard')
  );
}
