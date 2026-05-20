const root = document.documentElement;

document.getElementById('theme-toggle')?.addEventListener('click', () => {
  const next = root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-bs-theme', next);
  localStorage.setItem('theme', next);
});
