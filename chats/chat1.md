# Mobile app design brief

_Started 2026-10-03 09:10 UTC_

---

## User

Design a mobile app for

## Assistant



## User

Answered — visual: Modernist (flat, red accent, Archivo, 2px rules); round1: Navigation map and role-aware tabs, Client flow screens (home → post → jobs → quote → review → rebook), Artisan flow screens (onboarding/KYC → board → quote → complete), Chat, Messages inbox, notific…; format: Both; device: Android; role_focus: Both equally; decisions: Yes, apply my recommendations and label them PROPOSAL; dark: Light only

## Assistant

_[tool: list_files]_

_[tool: list_files]_

_[tool: ask_user]_

_[tool: write_file]_

_[tool: read_file]_

_[tool: copy_starter_component]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: delete_file]_

_[tool: write_file]_

_[tool: list_files]_

_[tool: dc_write]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: write_file]_

_[tool: dc_write]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: list_files]_

_[tool: copy_files]_

_[tool: str_replace_edit]_

_[tool: write_file]_

_[tool: dc_write]_

_[tool: dc_write]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: run_script]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: show_html]_

_[tool: str_replace_edit]_

_[tool: dc_write]_

_[tool: ready_for_verification]_

I rebuilt both files in the Industry system, which I read as your "industrial standard". I haven't looked at the board myself yet, so a background check is running on it.

The app now has a blueprint feel:
- Barlow Condensed uppercase headings
- A faint grid ground
- Square objects with "+" registration marks at the corners
- Job screens set out like engineering title blocks
- One steel-blue action per view

Status shows through labels, fills and line styles rather than colours.

- **Prototype (`Lezerv App.dc.html`):** a clickable Android app with client and artisan sides sharing the same jobs. You can post a job, accept a price, pay into escrow, chat (phone numbers get hidden), review, rebook, send prices and start or complete jobs.
- **Board (`Lezerv Board.dc.html`):** covers everything else you picked for round 1, and the sheets are labelled to match.
  - The role-aware tabs and deep-link map, plus the flow diagrams (client job, artisan onboarding, estimate vs firm, decline, guest sign-up).
  - Screens the prototype doesn't have: splash, notification permission prompt, ID verification, payout account, and offline/loading, plus empty/error states and push notification mock-ups.
  - Escrow states, components, mobile type scale, the four open decisions and the technical plan.
- **Old version:** the Modernist one is kept as `Lezerv App (Modernist).dc.html`.
- **PROPOSAL items:** escrow, earnings, payout account, "Post a job for this artisan" and widen search are labelled PROPOSAL and need backend work. Names, counts and prices are sample data.

I left out the support bot handoff flow since you didn't select it. Job photos are hatched placeholders because I can't generate images.

