# Lezerv artisan location app design

_Started 2026-10-04 18:45 UTC_

---

## User

Continuing from "Mobile app design brief".

## Assistant

We were redesigning your mobile marketplace app from a Modernist system into the Industry system—a more industrial, blueprint-style design language with engineering-inspired layouts and status shown through typography and line weight rather than colour.

You chose Android, light mode, equal focus on client and artisan roles, and asked me to apply design recommendations as labelled PROPOSAL items. The app connects clients posting jobs with artisans bidding and completing them, including escrow payment, chat, and review/rebook flows.

Decisions made:
- Switched from Modernist (red accents, Archivo) to Industry (Barlow Condensed, steel blue, grid background, square forms with corner marks). This gave the app a technical, trustworthy feel suited to a services platform.
- Built the prototype and board in parallel: the prototype is clickable and covers the full client-to-artisan job lifecycle; the board documents all screens, flows, components, states and open decisions.
- Marked five PROPOSAL features (escrow, earnings, payout account, "Post a job for this artisan", widened search) to flag what needs backend planning.
- Kept the old Modernist version for reference.

Current state:
- **Lezerv App.dc.html** (prototype): fully interactive Android app with client jobs, artisan onboarding, quotes, payments, chat (phone masking), review and rebook.
- **Lezerv Board.dc.html**: all screens, flows, components, type scale, escrow states and technical notes. Includes screens the prototype omits: splash, permission prompts, KYC, payout setup, loading and error states.
- Job photos are hatched placeholders (images can't be generated).
- Support bot handoff was left out per your selection.

Next: review the board, finalize the PROPOSAL items' backend requirements, or move into round 2 (detailed states, copy, accessibility).

Files: lz-icon.js, android-frame.jsx, Lezerv App.dc.html, Lezerv Board.dc.html, Lezerv App (Modernist).dc.html.

## User

[1] all right okay so we need to work on the old design uh the the idea images you look nice but what I get the color you know our normal lizard early if you can't view how the website is very so this is the website https://www.lezerv.com/ okay um so I want to get the website from my column from the logo if the logo color of the uh of the company this is doing or dark green and we're going to get all these different artisans so the way Invasion the app you don't does the like a normal mobile app I want you into tapping to Google Map technology where we can get location of each time in the community to use experiment to so I can just come to the app and then go that is right click to find artisan close to me a laundry service close to be delivered each time you know application it was will be here even Google Map but won't really be using the actual Google Maps if you person will make it the boomplay and only show what's our company uses for and then cannot also what we did what is the Android app when you using the normal uh react we're using Android studio one of the beautiful app into work on yeah the industrial and what we just industrial modernize together [1] so this one look like something an AI just being lazy and just give it to you we need you to put enough work so you can start putting list them

## Assistant

_[tool: read_file]_

_[tool: web_fetch]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: web_fetch]_

_[tool: grep]_

_[tool: web_fetch]_

_[tool: web_fetch]_

_[tool: write_file]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: dc_write]_

_[tool: show_html]_

_[tool: ready_for_verification]_

I've built a new version, **Lezerv App v2**, with the map as the home screen. The previous version is untouched. The background check hasn't reported back yet, and I haven't clicked through every flow myself.

**Client side**
- **Map home:** you can drag the map, filter by category using the services listed on lezerv.com, and search. Each nearby artisan is a pin, filled when available and outlined when busy. A ring shows 2.5 km around you, and a bottom sheet lists who's nearest. Tapping a pin opens a short preview with distance, arrival time, rating, and buttons for the profile and booking.
- **Booking and live tracking:** after paying into escrow, you watch the artisan drive to you, share a start code when they arrive, then rate them and release payment.
- **Laundry:** you set items, a pickup window, and standard or express return. A rider is tracked through pickup, washing and delivery.

**Artisan side**
- **Going online:** an online switch brings in a job request with a 30-second timer. Shaded areas on the map show where demand is high.
- **Doing the job:** accepting starts turn-by-turn directions to the client. The artisan enters the client's start code (4827 in the demo), then marks the job complete.
- **Earnings and coverage:** a weekly earnings chart, and a slider in Account that sets how far away they'll take jobs, shown as a ring on the map.

**Style:** it combines Industry and Modernist. From Industry: the corner marks and condensed headings. From Modernist: thick black divider lines, left-aligned text and big numbers. The screen layout follows standard Android patterns, so it maps directly to what you'd build in Android Studio.

**Map:** the map is drawn by the app itself, not Google Maps, so only Lezerv's artisans appear on it. The build notes beside the phone suggest MapLibre, a free open-source map library, styled in Lezerv's colours. You can switch the map style, and turn the distance ring and demand areas on or off, in Tweaks.

**Caveats:**
- The website doesn't expose its colours or logo, so the dark green is my estimate. Please upload the logo file and I'll match the exact colour and add the real logo.
- Names, prices, map locations and the start code are sample data.

Next, I can apply the same direction to the Board file.

## User

Found issues — fixing…

## User

Found issues — fixing…

