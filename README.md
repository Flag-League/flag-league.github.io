# Human Flag League

Website for the Human Flag League. CTF League without Clankers. Made by humans,
made for humans.

Live at <https://flag-league.github.io>

It is a static site: plain HTML, CSS and a little JavaScript, no build step.
Bootstrap is vendored in `vendor/`, so the site loads nothing from a CDN. The
scoreboard, team pages and event pages are all computed in the browser from a
single data file, `data/teams.json`.

## Updating the data

Everything the site shows comes from `data/teams.json`. It has two parts: a map of
events, and a list of teams that reference those events.

```jsonc
{
  "events": {
    "defcon2026": {             // event id, used in URLs, keep it stable
      "name": "DEF CON CTF 2026",
      "starts_at": 1717848000,  // unix time, seconds, UTC
      "ends_at": 1717884000,    // the year of this date picks the season tab
      "weight": 36.0
    }
  },
  "teams": [
    {
      "id": "fluxfingers",      // team id, used in URLs, keep it stable
      "name": "FluxFingers",
      "logo_url": "https://.../favicon.png",  // optional, PNG
      "web": "https://...",                   // optional
      "description": "Short one-line description.",  // optional, shown on Teams
      "country": "DE",          // ISO 3166-1 alpha-2 code
      "aliases": ["..."],       // optional
      "events": {
        "defcon2026": { "score": 12354, "place": 1 }
      }
    }
  ]
}
```

A few things to know:

- Add an event once under `events`. Then, for each team that played it, add a
  `score` and `place` under that team's own `events` map, using the same id.
- League points for an event are `(score / best) * weight`, where `best` is the
  highest score among the league teams that played it.
- A team's score for a year is the sum of its points over events that ended that
  year.
- `place` is the team's finishing position in the CTF. It is used to order the
  league teams on the event page; the best league team becomes rank 1.
- Do not rename an `id` once it is live. Team and event page links depend on it.

Run the validator before committing. The same check also runs on every push.

```
pip install jsonschema
python .github/validate_teams.py
```

## Local preview

The pages fetch `data/teams.json` and use ES modules, so they need to be served over
HTTP. Opening the files directly (`file://`) will not work.

```
python3 -m http.server 8000
```

Then open <http://localhost:8000>.
