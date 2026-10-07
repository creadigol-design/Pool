# Tafarn y Fic Pool Team

A small web app for the Tafarn y Fic pool team to track who's playing each match, keep the fixture list and record scores.

No build step and no server: open `index.html` in a browser, or host the folder on any static host (GitHub Pages, Netlify, etc.).

The squad (17 players) and the Division 2 2026-27 fixtures (16 matches; weeks 8 and 17 are free weeks) are pre-loaded the first time the app opens; edit it on the Squad tab. The look is a purple / neon-green football-broadcast style.

## Features

- **Fixtures** – next match, upcoming fixtures, matches that still need a score, and results.
- **Availability** – mark each player In / Maybe / Out for a fixture and see the running count on the fixture card.
- **Scores** – enter frames for/against (win/draw/loss is worked out automatically), tick who played and how many frames each won.
- **Stats** – team record and per-player appearances, attendance % and frames won.
- **Import** – paste fixtures copied from the league website (one per line). Accepted shapes:
  - `Tue 14 Oct 2025 20:00 Tafarn y Fic v The Red Lion` (also `The Bull v Tafarn y Fic` for away games)
  - `21/10/2025, The Crown, A`
  - `2025-10-28, 20:30, Ship Inn, H`
- **Backup** – download/restore everything as JSON from the Data tab.

## Where data lives

Data is saved in the browser's `localStorage`, so it is per device. To move it between phones, or share it with the team, use **Data → Download backup** and **Restore backup**. A shared database (so everyone sees the same live data) would be the next step if the team wants it.
