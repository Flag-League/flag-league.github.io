// Assembles the contact address at runtime so it is not a plain string
// in the page source.
const slot = document.getElementById('contact-email');
if (slot) {
  const address =
    ['flag', 'league'].join('-') +
    String.fromCharCode(64) +
    ['mailbox', 'org'].join('.');
  const link = document.createElement('a');
  link.href = 'mailto:' + address;
  link.textContent = address;
  slot.replaceChildren(link);
}
