# Storyline: the case file (proposal for the player, 2026-10-18)

The campaign is one ticket, **Zgłoszenie nr 48213**, that the Komisja keeps passing to the next
competent unit. Every unit sits on another planet. Six chapters, six planets, six handovers; the
sixth closes the case. This file proposes the chapters, the three new bosses, the frame of the
roster screen, and where every line of text lands. Accepted parts move into DESIGN as §4.2;
until then nothing here is built. Open questions are at the end (§9). Polish samples are first
drafts for the voice editor, not final text.

## 1. The premise in one paragraph
The character filed an application about their own status (the subject line is the only
per-hero text, §2). The Komisja received it, found it incomplete, and passed it on. Each
planet is the seat of the unit that now holds the file: a landing office, a verification
village, a town of the backlog. Each unit has its own regulamin (the chapter's clause), its
own dominant phenomenon (the family) and a head of unit (the boss) whose Spór comments are the
unit's position on the case. The ticket number never changes; the suffix counts the handovers
(`48213/1` … `48213/6`). When the case closes nothing about the applicant has changed, which
the Komisja regards as a complete and correct outcome. The next ticket is 48214: the
Zgłoszenia dodatkowe, as the code already numbers them (`TICKET_BASE + n`).

The one inexplicable thing (DESIGN §0): the number travels ahead of the applicant. On every
planet the Asystent finds that 48213 was registered there before the character arrived. In
chapter 6 it turns out the Komisja has been processing the number; the applicant was an
attachment.

## 2. Per-hero subject lines (the only hero-specific story text)
Printed as "Dotyczy" on the ticket header at the desk and in the first footnote of chapter 1.
- Pralka Emancypowana: „Wniosek o uznanie za osobę. Załącznik: instrukcja obsługi.”
- Konsultant Infolinii: „Zgłoszenie opuszczenia kolejki bez wywołania numeru.”
- Pętlowiec: „Wniosek o ustalenie kolejności przybycia i wyjazdu.”
- Kartograf: „Wniosek o wpis planet do rejestru planet. Planety w załączeniu nie istnieją.”
- Naleśnik: „Wniosek o status planety karłowatej (odłożony). Prośba o informację o terminie.”
A new hero adds one line (`npm run new-hero` checklist, PLAN 8).

## 3. The six chapters
Planet names use the existing generator's ordinal + adjective, fixed per chapter, so campaign
planets look like every other ticket. Base layouts alternate over the three existing ones.
Pages: 4, 4, 5, 5, 6, 6. Item level and enemy tier follow the chapter index; the priority
multiplies (PLAN 3.2). From chapter 4 the family is a mix.

| # | Stage | Planet | Base | Clause | Family | Boss | Closing stamp |
|---|---|---|---|---|---|---|---|
| 1 | Przyjęcie zgłoszenia | Pierwsza (Wstępna) | lądowisko | Ciasteczka | Urządzenia | Prototyp | PRZYJĘTO · WYMAGA UZUPEŁNIENIA |
| 2 | Weryfikacja tożsamości | Druga (Niepotwierdzona) | wioska | Weryfikacja dwuetapowa | Powiadomienia | Weryfikacja | TOŻSAMOŚĆ: NIEJEDNOZNACZNA |
| 3 | Potwierdzenie istnienia | Trzecia (Domniemana) | lądowisko | Parzystość | Wygenerowane | Hipoteza | ISTNIENIE: POTWIERDZONE (87%) |
| 4 | Rozpatrywanie | Czwarta (Zaległa) | miasteczko | Godziny konsultanta | Urządzenia + Powiadomienia | Kolejka (new) | ROZPATRZONO · DECYZJA W DRODZE |
| 5 | Doręczenie decyzji | Piąta (Tymczasowa) | wioska | Czas wsteczny | Powiadomienia + Wygenerowane | Awizo (new) | DORĘCZONO · TREŚĆ: PATRZ ZAŁĄCZNIK |
| 6 | Zamknięcie sprawy | Szósta (Obowiązkowa) | miasteczko | Opłata serwisowa | all three | Komisja (new) | ZAMKNIĘTO · NADANO NOWY NUMER |

### Chapter 1. Przyjęcie zgłoszenia (Planeta Pierwsza, Wstępna)
The landing office. The ticket is received by the devices that run the office; the cookie
banner is the first thing the applicant must accept. The Prototyp is the intake machine: it has
all the parts, including the ones removed from the series, so it can receive every kind of
application and process none. Its existing Spór comments stand ("Mam wszystkie części",
"Jestem wersją ostateczną").
- Board: „Jednostka przyjmująca. Wnioski przyjmuje się w całości lub wcale.”
- Base idle note: „Numer 48213 zarejestrowano na planecie przed przybyciem zgłaszającego.
  Zgłaszający nie wnosi zastrzeżeń.”
- Page notes (one per page): the office works; the applicant's attachment is examined and
  found to be the applicant; the Asystent misnames the planet (Druga) and corrects it.
- Handover footnote after the boss: „Zgłoszenie przyjęto. Brak załącznika: potwierdzenie
  tożsamości. Przekazano do jednostki weryfikującej (48213/2).”
- On-ramp: the first-run footnotes (walk, attack, rebut, update) live in this chapter.

### Chapter 2. Weryfikacja tożsamości (Planeta Druga, Niepotwierdzona)
A village of notifications: everything reminds the applicant that the verification is pending,
then that it is the last chance, then that the account will be deleted. The exit on every page
wants the two-step code. The Weryfikacja asks whether the applicant is a robot; its existing
second comment, „Weryfikacja zakończona. Wynik niejednoznaczny.”, is the chapter's verdict.
For Pralka the Asystent adds one line: the honest answer was available and was not provided for.
- Board: „Weryfikacja trwa 2 dni robocze. Dni robocze liczy jednostka.”
- Handover: „Tożsamość: niejednoznaczna. Przed dalszym rozpatrywaniem należy ustalić, czy
  zgłaszający istnieje. Przekazano (48213/3).”

### Chapter 3. Potwierdzenie istnienia (Planeta Trzecia, Domniemana)
A landing site drawn in dotted line: the planet itself is on the Kartograf's maps and nowhere
else. Everything comes in pairs, the applicant included: the Asystent notes a second applicant
of the same name, "wariant", filed under the same number. The Hipoteza holds that the applicant
exists to a majority; the character confirms the boss by standing in its outline, which is
also the Komisja's test for confirming the applicant. Existing comments stand.
- Board: „Istnienie potwierdza się osobiście. Osoby nieistniejące proszone są o cierpliwość.”
- After the boss: „Istnienie zgłaszającego potwierdzono w stopniu 0,87. Wariant zgłaszającego
  skreślono.” The ticket history entry of chapter 3 is later rewritten: the crossed-out
  applicant was the original (one of the Asystent's wrong notes, corrected in chapter 6).
- Handover: „Przekazano do jednostki rozpatrującej. Jednostka rozpatrująca ma zaległości (48213/4).”

### Chapter 4. Rozpatrywanie (Planeta Czwarta, Zaległa)
The town of the backlog: a miasteczko whose houses are filing cabinets. The consultant is in
from 8 to 16; outside those hours the bot answers, the Asystent included (during bot time the
page footnotes are the bot's a/b/c menu). The first mixed planet: devices carrying
notifications.
**Kolejka** (new boss): a queue of numbered slips joined like a paper snake, the head a ticket
dispenser. Fights by sending the slips (segments) at the player; a slip killed shortens the
queue, the head redraws the numbers. Phase change when the queue is down to one slip: the head
calls the player's number and the queue reforms behind it ("Numer wywołano. Zgłaszający nie
zgłosił się."). Weak to regulaminowy (a policy skips the queue).
- Spór 1: „Przed Tobą: 1 osoba. Szacowany czas: nieznany.” Replies: mechaniczny „Kolejkę można
  skrócić o jedną osobę od przodu.” · regulaminowy „Osoba ze zgłoszeniem w toku ma
  pierwszeństwo.” (right) · egzystencjalny „Osoby przede mną nie widzę.”
- Spór 2: „Twój numer został wywołany. Nie zgłosiłeś się.” Replies: mechaniczny „Numer trzyma
  automat. Automat ma obudowę.” · regulaminowy „Wywołanie bez zgłaszającego jest nieskuteczne.”
  · egzystencjalny „Zgłaszający był, lecz nie w stopniu wystarczającym.” (right)
- Board: „Kolejka jest obsługiwana w kolejności innej niż kolejność.”
- Handover: „Sprawę rozpatrzono. Decyzję wysłano. Przekazano do jednostki doręczającej (48213/5).”

### Chapter 5. Doręczenie decyzji (Planeta Piąta, Tymczasowa)
A village where after 17:00 time runs backwards, so the decision was delivered before it was
made. Notifications and generated things: the parcel was handed to a neighbour who exists to
a degree.
**Awizo** (new boss): the slip left when no one is home, a tall card with legs and a pickup
code. It keeps the parcel (the decision) in a paczkomat column drawn on the arena. It
teleports between three "placówka" points and summons Przypomnienia. A pickup code arrives as
an SMS footnote 6–12 s after the player taps the column (the Weryfikacja dwuetapowa mechanic,
reused); standing at the column with a live code opens it: phase change, the Awizo is pulled
to the column and stands still 4 s. Weak to mechaniczny (a slip tears).
- Spór 1: „Doręczono. Odbiorcy nie zastano.” Replies: mechaniczny „Zastać można to, co
  stoi. Stoję.” (right) · regulaminowy „Doręczenie bez odbiorcy nie wywołuje skutków.” ·
  egzystencjalny „Odbiorca był. Pytanie, czy jest.”
- Spór 2: „Przesyłka czeka 48 godzin. Godziny minęły wstecz.” Replies: mechaniczny „Czas
  liczy zegar. Zegar jest urządzeniem.” · regulaminowy „Termin liczony wstecz nie biegnie.”
  (right) · egzystencjalny „Czekanie nie wymaga przesyłki.”
- The decision, read out by the Asystent when the column opens: „Decyzja dotyczy numeru 48213.
  Numer dotyczył wówczas innej sprawy. Treść decyzji: patrz załącznik. Załącznika brak.”
- Handover: „Decyzję doręczono. Załącznik znajduje się w Komisji. Przekazano (48213/6).”

### Chapter 6. Zamknięcie sprawy (Planeta Szósta, Obowiązkowa)
The seat of the Komisja: a miasteczko of one building drawn as a form. Every victory is
charged. All three families, because every unit has sent a representative.
**Komisja** (new boss): three seats on a bench, each a figure assembled from one family's
parts: Przewodniczący (a printer with a gavel, Urządzenia), Sekretarz (a badge whose number
grows, Powiadomienia), Członek (drawn in dotted line, e=0.3, Wygenerowane, abstains). Each
seat has its family's resist and weakness, so the fight asks for all three damage types. The
Komisja votes every 15 s: the majority of living seats casts a stamp attack on the floor
(telegraphed outline). Phase change when the first seat is struck out: the remaining two
declare quorum.
- Spór 1: „Komisja obradowała. Sprawa jest złożona.” Replies: mechaniczny „Złożoną sprawę
  można rozłożyć.” · regulaminowy „Obrady bez protokołu nie są obradami.” (right) ·
  egzystencjalny „Komisja też jest złożona, w jednej trzeciej z kropek.”
- Spór 2: „Kworum zachowano. Większość Komisji nie istnieje w stopniu wystarczającym.”
  Replies: mechaniczny „Kworum liczy się od krzeseł. Krzesła stoją.” · regulaminowy
  „Głos nieistniejącego członka jest głosem wstrzymującym.” · egzystencjalny „Większość,
  która nie istnieje, głosuje jednomyślnie.” (right)
- Verdict form after the fight (a modal form, stamped): „Zgłoszenie nr 48213 zamknięto.
  Rozstrzygnięcia nie wydano. Zgłaszający pozostaje w stanie, w jakim się zgłosił. Sprawie
  nadano nowy numer: 48214.” The hero's profile line gains „(w toku)”. The Asystent's last
  note: „Przypis ostatni. Przypisów dalszych nie przewidziano.” followed by „Przepraszam za
  nieścisłość w przypisie ostatnim.”
- Afterwards the desk offers Zgłoszenia dodatkowe (random planets, 48214 onwards) and free
  travel to chapters 1–6 (PLAN §7). A certificate „Zaświadczenie o zakończeniu postępowania”
  goes to the notice board.

## 4. The roster screen as the frame (PLAN §7)
The first screen after the title is the **Kartoteka**: the Komisja's cabinet of applicants. Each
character is a **teczka** (a folder drawn with a tab): the hero's figure, the hero name, an
optional given name typed by the player ("Zgłaszający (opcjonalnie)"), level, the chapter the
file is at (`48213/3`) and the priority. „Załóż teczkę” creates a character: hero choice is the
current PROFIL UŻYTKOWNIKA screen, then the name field. Deleting a folder is „Zniszcz teczkę
(po upływie okresu przechowywania)” with a confirmation stamp. The shared stash is the
„Archiwum zakładowe”, a cabinet drawer at the base reachable from every folder.

## 5. Where every line lands (all existing channels; nothing new to render)
1. Ticket header at the desk: Dotyczy (per hero), Etap (chapter stage), the suffix in the number.
2. Base page: the notice board announcement, 3–4 idle notes of the Asystent, the paczkomat note
   (a delivery per chapter once slice 10 lands).
3. The Akceptuję screen: the fixed clause.
4. Page entry footnotes: one per page, 4–6 per chapter, plus the recurring "number arrived
   first" note once per chapter.
5. Boss: meet, phase, two Spór comments with three replies each.
6. Closing: the stamp on the ticket, the handover footnote, the history entry.
7. Chapter 6: the verdict form, the certificate, the profile suffix.
Rough count: about 110 strings in a new `story.json`, three boss blocks in `enemies.json`.
Zgłoszenia dodatkowe keep the current procedural texts; the campaign only pins values.

## 6. What this costs to build (goes into the slice order)
- A campaign table, pure data: chapter → planet seed/name parts, layout, clause, family mix,
  page count, boss id, text keys (`src/world/campaign.ts`). The run generator takes a chapter
  instead of a free seed when the ticket is a campaign ticket (slice 7).
- Three bosses: Kolejka (segments = summons with a leader, the pack system from PLAN §8),
  Awizo (teleport points + the SMS code mechanic from Weryfikacja dwuetapowa + a column
  object), Komisja (three assembled figures with a shared racja bar and a floor stamp attack).
  One builder slice each or two per slice; Komisja last.
- The roster screen (slice 6a) with the Kartoteka frame.
- The voice pass on `story.json`.
No new family in the six chapters. Later planets (full campaign 8–10) go between chapters as
inserted handovers (`48213/4a`); the candidate fourth family then is **Formularze** (a PDF
that cannot be edited, a required field, a signature line that walks) or **Opinie** (five
stars with legs, a one-star with a grudge). Decided when the first six are played.

## 7. Difficulty and pacing
Chapters 1–3 are the three families alone (today's runs). Chapter 4 introduces mixes and the
first new boss; chapters 5–6 add pages. The priority chosen at the desk scales as PLAN 3.2.
Expected first playthrough at Normalny: 60–80 minutes of runs. Free travel afterwards puts
item level at the character's level, so chapter 1 at level 30 drops level-30 gear.

## 8. Voice notes for the writer
The Asystent never says the Komisja is wrong. Units pass the file on because the regulamin
requires it, never from spite. The applicant's status is a matter of record, not of feeling.
Bosses speak like users in a comment section, the Komisja like minutes of a meeting. The
twist of chapter 5 is stated flatly once and never explained again.

## 9. Open questions for the player
1. Six planets with the Komisja as chapter 6 (my pick), or five planets and chapter 6 as a
   verdict form at the desk without a run?
2. The ending: no decision, new number, applicant unchanged (my pick, Lem), or the application
   granted as a wariant („uznano za osobę (wariant: pralka)”)?
3. The chapter 5 twist (the decision concerns the number, which meant another case at the
   time): keep, or deliver a decision on the applicant that says only "patrz załącznik"?
4. The three new bosses: Kolejka, Awizo, Komisja. Names and mechanics as sketched? The
   Komisja as three seats built from the three families' parts is the expensive one; a single
   figure (a bench with one stamp) is the cheap fallback.
5. Per-hero text limited to the subject line, or one more line per hero per chapter (five
   heroes × six chapters = thirty lines, each a small joke on the hero's status)?
6. The ticket number: `48213/3` handover suffix (my pick), plain 48213 on every planet, or
   letters (48213-C)?
7. Kartoteka: typed character names (phone keyboard) optional, as proposed, or none?
8. The "number arrives first" thread: keep as the one inexplicable thing, or drop it and let
   the chapters stand alone?
