export function renderAbout(app) {
  document.title = 'About - Human Flag League';
  app.innerHTML = `
    <h1 class="mb-1">About</h1>
    <p class="lead text-body-secondary mb-4">How the league works.</p>

    <section class="mb-4">
      <h2 class="h4">Rules</h2>
      <p>
        The Human Flag League is a capture-the-flag league played without AI.
        While competing under the league, members do not use:
      </p>
      <ul>
        <li>AI code completion or code generation</li>
        <li>AI chat assistants for solving challenges</li>
        <li>AI-generated search summaries</li>
        <li>any other clankers</li>
      </ul>
      <p>It runs on trust. Each team makes sure its own members keep to this.</p>
    </section>

    <section class="mb-4">
      <h2 class="h4">Scoring</h2>
      <p>
        Each CTF a team plays is worth league points, computed as
        <code>points = (score / best) &times; weight</code>.<br>
        Score is the team's score in that CTF, best is the top score among the
        league teams that played it, and weight is the CTF's weight.
      </p>
      <p>
        A team's standing for a year is the sum of its points from every CTF
        that ended that year.
      </p>
    </section>

    <section class="mb-4">
      <h2 class="h4">Apply</h2>
      <p>Applications to join the league are currently closed.</p>
    </section>

    <section class="mb-4">
      <h2 class="h4">Contact</h2>
      <p>Questions about the league? Reach us at <span id="contact-email"></span>.</p>
    </section>
  `;

  // Assemble the address at runtime so it is not a plain string in the source.
  const address =
    ['flag', 'league'].join('-') + String.fromCharCode(64) + ['mailbox', 'org'].join('.');
  const link = document.createElement('a');
  link.href = 'mailto:' + address;
  link.textContent = address;
  app.querySelector('#contact-email').replaceChildren(link);
}
