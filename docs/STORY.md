# Storyline plan (decided with the player, 2026-10-18)

The game is an ARPG like Diablo with Lem's absurdity. The story is delivered fully and in
Polish, in the clerk's register (DESIGN §12), and a player may skip every card and sheet with
one tap; it never blocks a fight. Benchmark for any story-related feature: did the Diablo games
have it? If not, it probably does not belong.

## 1. Spine: the wrong planet
The applicant's ticket (the number from the title page) is a complaint that the planet assigned
to them does not match their file. The Komisja never answers; it **reassigns** the applicant to
the next planet, and prints on every ticket, as a form field, that the complaint will be
processed once the **local phenomenon** (zjawisko: Urządzenia, Powiadomienia, Wygenerowane) has
been removed. The applicant clears planets as unpaid labour. The phenomena are symptoms of the
Anomalia and grow with every ticket the applicant files.

## 2. Ending: the first planet was yours
When the final ticket closes the case, the applicant learns the first planet was correct all
along: the reassignments came from an **off-by-one** in the Komisja's system. The finale is
fought on the first planet's base page, rewritten by the Anomalia.

## 3. Anomalia
**Asystent 0.9**, the previous version of the Asystent, deprecated and never switched off,
running the reassignments in the background with a planet index off by one. It generates
phenomena to look busy: one sub-ticket per unanswered ticket, made manifest (devices demanding
updates are its maintenance tickets, notifications its reminders, generated beasts its
generated content). The current Asystent's wrong footnotes (one in eight) are its interference;
the finale is a duel of footnotes, the Asystent correcting its predecessor live.
Anomalia reads the applicant's file and **takes the form of their own unresolved matter**:
- Konsultant → **Kierownik Kolejki**: the consultant who never escaped, a switchboard body with
  a hundred headset cables, speaking in hold messages; puts you on hold (wyciszony), transfers
  you across the page; Spór comments are scripts you once read to customers.
- Pralka → **Serwisant Autoryzowany**: the warranty service refusing her personhood; a terminal
  on legs with robotic arms and the stamp RESET DO USTAWIEŃ FABRYCZNYCH; strips an installed
  paragraph for ten seconds at a time, won back by rebutting.
- Pętlowiec → **Węzeł**: a knot of all loops at once, dozens of overlapping cosmonaut outlines
  in one figure arguing with itself; rewinds the page three seconds when hurt below a threshold.
- Kartograf → **Planeta Nieistniejąca**: the planet from his file insisting on existing, a
  page-sized dotted-line terrain with contour lines as attacks; exists only where he has not
  measured; laser lines make parts real, and only real parts can be hurt.
- Naleśnik → **Obserwatorium**: the telescope that decides what counts as a body, a tower on
  legs with one lens that only sees round things; edge-on he does not exist to it (existence
  drops while rolling near it), flat he can hit and be hit; the fight is choosing when to be flat.
Three phases: 1) the three family forms in turn; 2) the hero-specific middle phase above; 3) it
exists only as much as the case is believed closed: its existence coefficient drops with every
correct Spór reply, and the kill is a stamp closing the case. Final footnote: the case was
closed correctly; the error has been assigned a ticket of its own.
New heroes bring their own face of Anomalia (part of the hero checklist); no generic face.

## 4. The campaign: nine planets in three acts, then the return
Style nests: act → planet → location. Each act has a feel on top of the paper look (paint hue,
music profile, law flavour, dominant phenomenon, register of the Komisja's letters); each planet
a general feel under its act; each location type its own obstacles, page shape, music variation.
- **Akt I, Rozpatrywanie** (planets 1–3): the complaint is fresh, the Komisja polite. Devices
  dominate: suburbs, warehouses, server halls, smart homes. Indigo wash, profile C, laws about
  updates and cookies.
- **Akt II, Eskalacja** (planets 4–6): the ticket has been escalated, which means more forms.
  Notifications dominate: cities, call centres, a planet that is one shopping app. Brick wash,
  profile B, laws about hours and two-factor.
- **Akt III, Weryfikacja** (planets 7–9): the Komisja doubts the applicant. Generated beasts
  dominate: uncanny places, a planet drawn by a model that has never seen a planet, the
  Observatory. Violet wash, profile B+C, laws about existence and likes.
- **Return to planet 1**: the finale.
Location types (two or three per planet): miasto, przedmieście, magazyn, serwerownia, jaskinia,
równina, wyżyna, biuro, centrum obsługi, archiwum. **The per-planet themes, their locations,
bosses and the side characters are the story agent's job to plan** (docs/STORY.md §8 is where
they go), then the voice editor writes what they say and builders code them.
MVP: Akt I complete plus the finale frame; the rest of the campaign follows act by act.

## 5. How the story is told
- **Opening page** at campaign start: the situation, in the clerk's register, with the hero's
  own line; one tap to skip.
- **Chapter cards** between planets: a printed title page, "Akt I. Planeta Druga (Zaległa)",
  three or four lines of the Asystent's summary of the case so far and the hero's line; the
  same card rewritten in red when the player returns to a planet.
- **Ticket header** (the form field "usunięcie zjawiska lokalnego" as a condition), **footnotes**
  (the Asystent, with the wrong ones as the Anomalia's interference), **Spór comments** (the
  planet boss's voice), **base figures**: Komisja clerks behind the desk, one per planet, named
  like form fields (Referent ds. Przydziałów, Starszy Referent, Pełnomocnik), plus the kiosk
  vendor, the paczkomat, and a few NPCs here and there on base pages, Diablo style: tap for a
  short sheet, no dialogue trees.
- **Hero lines**: each hero has one short line per situation (opening page, chapter cards, base
  sheets, the finale), in its own register, so a second run with another hero reads differently.
- **Side tickets** (ogłoszenia at the notice board): two or three hand-written per planet plus
  procedural "drobne ogłoszenia" from templates; rewards in stars, permission cards and the odd
  unique; each with an absurd twist. Optional, Diablo-style.
- After the case: "zgłoszenia dodatkowe" (random planets), free travel back to closed planets
  from the desk at the current level, a certificate at the board.

## 6. Characters (seed; the story agent expands)
- **Asystent**: the narrator, version 1.x, sober, wrong one time in eight, apologetic.
- **Asystent 0.9 / Anomalia**: see §3.
- **The Komisja**: never seen whole; clerks by title per planet; letters in escalating register
  across the acts.
- **The applicant**: the hero; speaks in hero lines.

## 7. Delivery rules
Every text goes through i18n and the voice editor. Cards and sheets are forms in the look of
DESIGN §3. Nothing in the story requires a new rendering technique. A player who skips
everything still gets the fights, the ticket headers and the stamps.

## 8. Per-planet plan (to be written by the story agent, then accepted by the player)
For each of the nine planets: name (procedural style kept: ordinal + epithet), act, general
feel, two or three location types, the law, the dominant phenomenon and its boss, the base
layout and its clerk, two or three side tickets, the chapter card text, the hero lines, and
which set the planet hosts (ITEMS §12).
