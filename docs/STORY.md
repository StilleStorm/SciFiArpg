# Storyline: the case file (proposal for the player, 2026-10-18; full campaign, Diablo length)

The campaign is one ticket, **Zgłoszenie nr 48213**, that the Komisja keeps passing to the next
competent unit. Every unit sits on another planet. **Five acts, sixteen chapters, sixteen
planets**, each with a base, a clause, a family mix, two or three quest steps (*czynności*) and
a boss; the sixteenth closes the case. Three new enemy families enter along the way, nine new
clauses, thirteen new bosses. Expected first playthrough at Normalny: 6–8 hours, Diablo's
length. This file proposes the whole thing and where every line of text lands. Accepted parts
move into DESIGN as §4.2; until then nothing here is built. Open questions are in §12. Polish
samples are first drafts for the voice editor. Chapters are built in order and the game is
playable after any number of them; there is no separate MVP sequence.

## 1. The premise
The character filed an application about their own status (the subject line is the only
per-hero text, §2). The Komisja received it, found it incomplete, and passed it on. Each planet
is the seat of the unit that now holds the file. Each unit has its own regulamin (the chapter's
clause), its own dominant phenomenon (the family) and a head of unit (the boss) whose Spór
comments are the unit's position on the case. The ticket number never changes; the suffix
counts the handovers (`48213/1` … `48213/16`). When the case closes nothing about the applicant
has changed, which the Komisja regards as a complete and correct outcome. The next ticket is
48214: the Zgłoszenia dodatkowe, as the code already numbers them (`TICKET_BASE + n`).

The one inexplicable thing (DESIGN §0): the number travels ahead of the applicant. On every
planet the Asystent finds that 48213 was registered there before the character arrived, and
the thread grows: by act II the number files its own forms and pays its own fee, in act III a
decision is addressed to it, in act IV the audit finds it in order and the archive holds a
folder of 48213 cards for it, in act V it is summoned to the hearing and attends. In the final
verdict the Komisja has been processing the number all along; the applicant was an attachment.

## 2. Per-hero subject lines (the only hero-specific story text)
Printed as "Dotyczy" on the ticket header and in the first footnote of chapter 1.
- Pralka Emancypowana: „Wniosek o uznanie za osobę. Załącznik: instrukcja obsługi.”
- Konsultant Infolinii: „Zgłoszenie opuszczenia kolejki bez wywołania numeru.”
- Pętlowiec: „Wniosek o ustalenie kolejności przybycia i wyjazdu.”
- Kartograf: „Wniosek o wpis planet do rejestru planet. Planety w załączeniu nie istnieją.”
- Naleśnik: „Wniosek o status planety karłowatej (odłożony). Prośba o informację o terminie.”
A new hero adds one line (`npm run new-hero` checklist, PLAN 8). Optionally one extra line per
hero per act (§12 Q6).

## 3. Quests: czynności (the Diablo quest layer)
Each chapter lists two or three *czynności* on the ticket header as checkboxes („Czynności:
☐ odebrać załącznik ☐ stawić się”); the Asystent ticks them with a stamp sound and a footnote.
A step that is done opens the next one; the boss page opens when all are ticked (until then the
last page's exit says „wymaga czynności”). Five primitives, pure data per chapter, reused by
every chapter and later by Zgłoszenia dodatkowe at random:
1. **Odbiór**: find a drawn object on a named page (a teczka, a parcel, a stamp) and tap it.
2. **Skreślenie**: kill a named elite (PLAN §8) the Asystent records by name.
3. **Stawiennictwo**: stand on a drawn spot for 3 s while enemies come (the zdarzenie timer).
4. **Doręczenie**: carry a picked-up object to a station on another page (the kiosk, a
   paczkomat, a counter); dying drops it where you fell.
5. **Oświadczenie**: answer one Spór-style comment in the margin outside a boss fight (a
   clerk at a counter asks; a wrong reply costs nothing but a footnote and a retry).
Side content: each act has one **załącznik** page (the optional branch from DESIGN §4) with a
side czynność and a guaranteed teczka; each chapter has one page zdarzenie (PLAN §8).

## 4. The acts
- **Akt I. Przyjęcie** (ch. 1–3). The three existing families alone, the three existing
  bosses. The unit receives the file, cannot tell who the applicant is, then cannot tell
  whether they exist. Today's runs are these three chapters.
- **Akt II. Uzupełnienie** (ch. 4–6). The file is completed: forms, attachments, the fee.
  **Formularze** enter in 4. Ends with the fee paid to the wrong account, which is the right
  account.
- **Akt III. Rozpatrywanie** (ch. 7–10). The file waits, is reviewed, consulted on, delivered.
  **Opinie** enter in 8. Ends with the delivered decision that has no content.
- **Akt IV. Instancje** (ch. 11–13). The appeal, the audit, the archive. **Aktualizacje** enter
  in 12. Ends with the file retrieved from the archive one card short.
- **Akt V. Komisja** (ch. 14–16). The case is reopened, heard and closed. Every family present.
  Ends with the verdict form and the new number.

## 5. The sixteen chapters
Planet names use the existing generator's ordinal + adjective, fixed per chapter, so campaign
planets look like every other ticket. Base layouts: the three existing plus two proposed
(**urząd**: a hall of counters; **archiwum**: shelves). Pages grow 4 → 8. Every existing clause
is used once; nine clauses are new (§7). Item level and enemy tier follow the chapter index;
the priority multiplies (PLAN 3.2). U = Urządzenia, P = Powiadomienia, W = Wygenerowane,
F = Formularze, O = Opinie, A = Aktualizacje; dominant first.

| # | Akt | Stage | Planet | Base | Clause | Families | Boss | Pages |
|---|---|---|---|---|---|---|---|---|
| 1 | I | Przyjęcie zgłoszenia | Pierwsza (Wstępna) | lądowisko | Ciasteczka | U | Prototyp | 4 |
| 2 | I | Weryfikacja tożsamości | Druga (Niepotwierdzona) | wioska | Weryfikacja dwuetapowa | P | Weryfikacja | 4 |
| 3 | I | Potwierdzenie istnienia | Trzecia (Domniemana) | lądowisko | Parzystość | W | Hipoteza | 5 |
| 4 | II | Uzupełnienie braków | Czwarta (Niekompletna) | wioska | Wymagana aktualizacja | F, U | Wniosek | 5 |
| 5 | II | Załączniki | Piąta (Zbędna) | lądowisko | Limit rozmiaru (new) | F, W | Załącznik | 5 |
| 6 | II | Opłata | Szósta (Obowiązkowa) | miasteczko | Opłata serwisowa | U, P, F | Płatność Nieudana | 6 |
| 7 | III | Rozpatrywanie | Siódma (Zaległa) | urząd | Godziny konsultanta | U, P, F | Kolejka | 6 |
| 8 | III | Opiniowanie | Ósma (Sporna) | wioska | Opinie zweryfikowane (new) | O, P | Średnia Ważona | 6 |
| 9 | III | Konsultacje społeczne | Dziewiąta (Uciążliwa) | miasteczko | Głosowanie (new) | O, W | Ankieta | 6 |
| 10 | III | Doręczenie decyzji | Dziesiąta (Tymczasowa) | lądowisko | Czas wsteczny | P, W, O | Awizo | 7 |
| 11 | IV | Odwołanie | Jedenasta (Zawieszona) | urząd | Grawitacja doradcza | F, O | Odmowa | 7 |
| 12 | IV | Kontrola | Dwunasta (Nieaktualna) | miasteczko | Kontrola wyrywkowa (new) | A, U, F | Audyt | 7 |
| 13 | IV | Archiwizacja | Trzynasta (Przedawniona) | archiwum | Nie przeszkadzać | W, all | Teczka Zbiorcza | 7 |
| 14 | V | Wznowienie postępowania | Czternasta (Ewentualna) | lądowisko | Stan poprzedni (new) | A, W, P | Precedens | 8 |
| 15 | V | Posiedzenie | Piętnasta (Wyznaczona) | urząd | Protokół (new) | all six | Protokolant | 8 |
| 16 | V | Zamknięcie sprawy | Szesnasta (Ostateczna) | urząd | Klauzula końcowa (new) | all six | Komisja | 8 |

New adjectives for the generator's list: Przedawniona, Wyznaczona, Ostateczna.

### Akt I. Przyjęcie

**1. Przyjęcie zgłoszenia** (Pierwsza, Wstępna). The landing office. The devices that run it
receive the ticket; the cookie banner is the first thing the applicant must accept. The
Prototyp is the intake machine: all the parts, including the ones removed from the series, so
it can receive every application and process none. Existing Spór comments stand.
Czynności: Odbiór (the ticket's own copy from a teczka on page 2) · Skreślenie (a named
elite, „Drukarka Sieciowa nr 1”) · Stawiennictwo (the counter spot on page 4).
Board: „Jednostka przyjmująca. Wnioski przyjmuje się w całości lub wcale.” Idle note: „Numer
48213 zarejestrowano na planecie przed przybyciem zgłaszającego. Zgłaszający nie wnosi
zastrzeżeń.” Handover: „Zgłoszenie przyjęto. Brak załącznika: potwierdzenie tożsamości.
Przekazano do jednostki weryfikującej (48213/2).” The first-run on-ramp footnotes live here.

**2. Weryfikacja tożsamości** (Druga, Niepotwierdzona). A village of notifications: pending,
last chance, account deleted. Every exit wants the two-step code. The Weryfikacja asks whether
the applicant is a robot; its existing second comment, „Weryfikacja zakończona. Wynik
niejednoznaczny.”, is the verdict. For Pralka one extra line: the honest answer was available
and not provided for.
Czynności: Oświadczenie (the clerk asks „Czy jest Pan/Pani robotem”; the right reply is the
hero's own type) · Doręczenie (carry the SMS code slip from page 2 to the counter on page 3) ·
Skreślenie („Ostatnia Szansa nr 3”).
Board: „Weryfikacja trwa 2 dni robocze. Dni robocze liczy jednostka.” Handover: „Tożsamość:
niejednoznaczna. Należy ustalić, czy zgłaszający istnieje. Przekazano (48213/3).”

**3. Potwierdzenie istnienia** (Trzecia, Domniemana). A landing site in dotted line: on the
Kartograf's maps and nowhere else. Everything in pairs, the applicant included: the Asystent
notes a second applicant of the same name, „wariant”, under the same number. The Hipoteza holds
that the applicant exists to a majority; standing in its outline confirms the boss and, the
Komisja holds, the applicant. Existing comments stand.
Czynności: Stawiennictwo (stand in your own outline drawn on page 2) · Skreślenie (the
wariant: a named Wygenerowany with the hero's silhouette, „Zgłaszający (wariant)”) · Odbiór
(the confirmation form from a teczka on page 4).
Board: „Istnienie potwierdza się osobiście. Osoby nieistniejące proszone są o cierpliwość.”
After the boss: „Istnienie zgłaszającego potwierdzono w stopniu 0,87. Wariant zgłaszającego
skreślono.” (Rewritten later: the struck one was the original; corrected in ch. 16.)
Handover: „Przekazano do jednostki uzupełniającej. Jednostka stwierdza braki (48213/4).”

### Akt II. Uzupełnienie

**4. Uzupełnienie braków** (Czwarta, Niekompletna). A village of forms; **Formularze** enter
(§6). The weapon needs an update before it counts as a valid attachment. Devices carry forms.
**Wniosek** (boss): the applicant's own application, page-sized. Three fields on the floor
(Podpis, Podstawa prawna, Oświadczenie); standing in one 2 s fills it and removes a third of
the shield; the boss wipes one filled field every 20 s („Sesja wygasła”). Phase change with all
three filled at once. Attacks: a paper-edge sweep, a staple that **blokuje**.
Spór 1: „Pole wymagane. Nie wypełniono.” → regulaminowy „Wymóg pola musi mieć podstawę. Pole
«podstawa» jest puste.” (wrong: „Pole wypełnia się naciskiem.” · „Puste pole też jest treścią.”)
Spór 2: „Sesja wygasła. Dane nie zostały zapisane.” → mechaniczny „Dane są na papierze. Papier
nie wygasa.” (wrong: „Wygaśnięcie sesji wymaga uprzedzenia.” · „Zapisane było to, co pamiętam.”)
Czynności: Odbiór (the update from the first elite, as the clause says) · Doręczenie (the
filled form to the kiosk) · Oświadczenie („Czy wniosek jest kompletny”).
Board: „Braki uzupełnia się na formularzu braków. Formularz braków jest niekompletny.” Idle:
„Numer 48213 złożył formularz samodzielnie. Formularz przyjęto.” Handover: „Braki uzupełniono.
Stwierdzono brak załączników. Przekazano (48213/5).”

**5. Załączniki** (Piąta, Zbędna). A landing field of parcels: the attachments are kept here,
each exists in proportion to how many people opened it. New clause **Limit rozmiaru**:
„Załącznik nie może przekraczać 2 MB.” The bag holds 6 slots on this planet; the seventh
pickup compresses a random bag item into a wariant (reversed at the base).
**Załącznik** (boss): a parcel too large to send, drawn as a crate with a progress bar that
never finishes. It splits into three smaller parcels at a third racja each (Parzystość's
pairing logic reused); each must be opened (killed) within 10 s of the others or it re-merges
at the sum. Phase change on the first split. Weak to mechaniczny (tape).
Spór 1: „Rozmiar pliku: za duży. Spróbuj ponownie.” → mechaniczny. Spór 2: „Załącznik
otwarto 0 razy. Istnieje w stopniu zerowym.” → egzystencjalny.
Czynności: Odbiór ×2 (two attachments from teczki on pages 2 and 4) · Skreślenie („Załącznik
Bez Nazwy”).
Board: „Załączniki przyjmujemy w formacie, którego nie obsługujemy.” Handover: „Załączniki
przyjęto. Przed rozpatrzeniem należy wnieść opłatę (48213/6).”

**6. Opłata** (Szósta, Obowiązkowa). The town of payments; every victory is charged. Devices
(card readers on legs), notifications about failed payments, forms (invoices).
**Płatność Nieudana** (boss): a card terminal with a receipt tongue. Every 10 s it charges the
player one gwiazdka (a receipt flies off); if the purse is empty it charges racja instead. It
„retries” by splitting its racja bar into three attempts; the phase change is the second
attempt. Weak to regulaminowy (a charge needs a basis).
Spór 1: „Płatność nieudana. Spróbuj ponownie. Środki zostały pobrane.” → regulaminowy.
Spór 2: „Opłata serwisowa od opłaty serwisowej. Zgodnie z regulaminem.” → egzystencjalny.
Czynności: Doręczenie (the fee slip to the bot kiosk during office hours) · Oświadczenie („Czy
akceptuje Pan/Pani opłatę za akceptację”) · Skreślenie („Czytnik Kart nr 0”).
Board: „Opłatę wnosi się na rachunek jednostki. Rachunek jest w załączniku.” Idle: „Numer
48213 wniósł opłatę. Zgłaszający nie musi.” Handover: „Opłatę wniesiono na rachunek
niewłaściwy, który okazał się właściwy. Przekazano do rozpatrzenia (48213/7).” End of Akt II.

### Akt III. Rozpatrywanie

**7. Rozpatrywanie** (Siódma, Zaległa). The office hall of the backlog (**urząd** layout:
counters, numbered chairs). The consultant is in from 8 to 16; outside those hours the bot
answers, the Asystent included (bot-time page footnotes are the a/b/c menu).
**Kolejka** (boss): numbered slips joined like a paper snake, the head a ticket dispenser.
Slips (segments) are sent at the player; a slip killed shortens the queue, the head redraws
the numbers. Phase change at one slip: the head calls the player's number and the queue
reforms behind it. Weak to regulaminowy.
Spór 1: „Przed Tobą: 1 osoba. Szacowany czas: nieznany.” → regulaminowy „Osoba ze zgłoszeniem
w toku ma pierwszeństwo.” (wrong: „Kolejkę można skrócić o jedną osobę od przodu.” · „Osoby
przede mną nie widzę.”) Spór 2: „Twój numer został wywołany. Nie zgłosiłeś się.” →
egzystencjalny „Zgłaszający był, lecz nie w stopniu wystarczającym.” (wrong: „Numer trzyma
automat. Automat ma obudowę.” · „Wywołanie bez zgłaszającego jest nieskuteczne.”)
Czynności: Odbiór (a queue number from the dispenser on page 1) · Stawiennictwo (the chair
with your number, page 3, during consultant hours only) · Skreślenie („Przypomnienie nr 48212”).
Board: „Kolejka jest obsługiwana w kolejności innej niż kolejność.” Handover: „Sprawę
rozpatrzono. Przed wydaniem decyzji sprawa podlega zaopiniowaniu (48213/8).”

**8. Opiniowanie** (Ósma, Sporna). A village of reviews; **Opinie** enter (§6). New clause
**Opinie zweryfikowane**: „Na tej planecie liczy się opinia większości.” Every enemy's racja
is multiplied by the share of its family alive on the page (a lone enemy at 50%, a full page at
100%); every kill lowers the rest. Drops show a rating: a 5-star drop is one tier higher, a
1-star drop is a wariant.
**Średnia Ważona** (boss): a hand-drawn „4,8” with a star, carried by small reviews. Its racja
is its average: it summons 5-star reviews that raise it; kills of them lower it; the 1-star
reviews it also summons heal it when they die (a bad review draws attention). Phase change
under 4,0: the number is redrawn, the star crossed, it attacks directly. Weak to egzystencjalny.
Spór 1: „4,8 na podstawie 213 opinii. Opinii nie weryfikowano.” → egzystencjalny „213 osób nie
było tu nigdy.” (wrong: „Średnią obniża się jednym uderzeniem w licznik.” · „Opinie
niezweryfikowane nie wchodzą do średniej.”) Spór 2: „Jedna gwiazdka. Nigdy więcej.” →
egzystencjalny „«Nigdy więcej» zakłada, że było.” (wrong: „Gwiazdka ma pięć ramion do
złamania.” · „Opinia bez zakupu podlega usunięciu.”)
Czynności: Skreślenie (the named 1-star, „Użytkownik Anonimowy (1/5)”) · Oświadczenie („Czy
poleca Pan/Pani siebie”) · Odbiór (your own review from a teczka: 3/5, „bez uwag”).
Board: „Opinie są moderowane. Moderacja ma opinię.” Handover: „Zaopiniowano: 4,8. Sprawę
kierujemy do konsultacji społecznych (48213/9).”

**9. Konsultacje społeczne** (Dziewiąta, Uciążliwa). A town where everything is put to a vote
and the voters mostly do not exist. New clause **Głosowanie**: „Każda decyzja podlega
głosowaniu.” Every 60 s a two-option poll appears as a margin form („Czy przeciwnicy mają być
szybsi: tak / nie”); the player's vote is one of three; the other two are cast by the page
(seeded). The winning option is the modifier for the next minute.
**Ankieta** (boss): a survey sheet with radio buttons for eyes. It asks a question every 12 s
and draws two answer squares on the floor; the square the player stands in when time runs out
is „the answer” and sets the boss's next attack (the other square explodes). Standing in neither
counts as „nie mam zdania” and heals the boss. Phase change after three answers. Weak to
mechaniczny (paper).
Spór 1: „Dziękujemy za udział w ankiecie. Odpowiedzi nie zapisano.” → mechaniczny. Spór 2:
„97% respondentów to boty. Wynik jest reprezentatywny.” → egzystencjalny.
Czynności: Stawiennictwo ×2 (two polling spots) · Doręczenie (the ballot to the paczkomat).
Board: „Konsultacje trwają do odwołania. Odwołania nie przewidziano.” Handover: „Konsultacje
zakończono. Decyzję wydano i skierowano do doręczenia (48213/10).”

**10. Doręczenie decyzji** (Dziesiąta, Tymczasowa). A delivery depot on a landing field where
after 17:00 time runs backwards, so the decision was delivered before it was made.
**Awizo** (boss): the slip left when no one is home, a tall card with legs and a pickup code.
It keeps the parcel (the decision) in a paczkomat column on the arena. It teleports between
three „placówka” points and summons Przypomnienia. A pickup code arrives as an SMS footnote
6–12 s after the player taps the column (the two-step mechanic reused); standing at the column
with a live code opens it: phase change, the Awizo is pulled to the column, still for 4 s.
Weak to mechaniczny.
Spór 1: „Doręczono. Odbiorcy nie zastano.” → mechaniczny „Zastać można to, co stoi. Stoję.”
(wrong: „Doręczenie bez odbiorcy nie wywołuje skutków.” · „Odbiorca był. Pytanie, czy jest.”)
Spór 2: „Przesyłka czeka 48 godzin. Godziny minęły wstecz.” → regulaminowy „Termin liczony
wstecz nie biegnie.” (wrong: „Czas liczy zegar. Zegar jest urządzeniem.” · „Czekanie nie wymaga
przesyłki.”)
The decision, read out when the column opens: „Decyzja dotyczy numeru 48213. Numer dotyczył
wówczas innej sprawy. Treść decyzji: patrz załącznik. Załącznika brak.”
Czynności: Odbiór (the awizo slip, page 1) · Doręczenie (the slip to the placówka on page 4,
before 17:00 on the clock) · Skreślenie („Sąsiad (domniemany)”).
Board: „Przesyłki wydaje się po okazaniu przesyłki.” Handover: „Decyzję doręczono. Od decyzji
przysługuje odwołanie (48213/11).” End of Akt III.

### Akt IV. Instancje

**11. Odwołanie** (Jedenasta, Zawieszona). The hall of the second instance, where gravity is
advisory: the appeal weighs as much as the decision, which is nothing. Forms and reviews.
**Odmowa** (boss): a rubber stamp with a handle, taller than the hero (the item „Pieczątka
serwisowa, wariant Odmowa” is its miniature). It slams: a telegraphed outline, then an ODMOWA
mark that stays as an obstacle dealing regulaminowy damage on touch; under the clause the hero
flies far from a slam. Phase change at half racja: it re-inks and its marks read ODMOWA
(WARIANT), which heal it when the player crosses them. Weak to regulaminowy.
Spór 1: „Odmawiam. Uzasadnienie w załączniku.” → regulaminowy „Odmowa bez uzasadnienia jest
brakiem decyzji.” (wrong: „Pieczątkę odwraca się rękojeścią do góry.” · „Odmowa istnieje tylko
wobec wniosku. Wniosku nie ma.”) Spór 2: „Od odmowy przysługuje odwołanie. Do mnie.” →
egzystencjalny „Odwołuję się więc do nikogo. Przyjęto.” (wrong: „Odwołanie składa się młotkiem
w obudowę.” · „Organ nie rozpatruje odwołań od siebie.”)
Czynności: Doręczenie (the appeal form to the counter on page 5) · Oświadczenie („Od czego
się Pan/Pani odwołuje”; right: egzystencjalny „Od braku treści.”) · Skreślenie („Formularz
Odwołania (wzór)”).
Board: „Odwołanie rozpatruje organ, który wydał decyzję, w innym pokoju.” Handover: „Odwołanie
oddalono. Sprawę skierowano do kontroli (48213/12).”

**12. Kontrola** (Dwunasta, Nieaktualna). The audit town; **Aktualizacje** enter (§6):
progress bars with legs, patch notes, the „Nowość!” badge, a restart prompt. New clause
**Kontrola wyrywkowa**: „Planeta podlega kontroli wyrywkowej.” On every page one random bag
item is „zajęty do kontroli” (greyed, unusable) until the page's elite falls, which returns it
with a stamp SKONTROLOWANO and, one time in six, as a wariant.
**Audyt** (boss): an inspector drawn as a clipboard with a magnifying glass, trailed by three
progress bars. It inspects: a cone that marks the player „w trakcie kontroli” (no pickups,
−30% damage, the Zawieszenie rule reused) until the player stands still 2 s; it installs
updates on its minions (tier up). Phase change at 99%: the bar stalls, the Audyt is stuck
„finalizing” for 6 s, defenceless, then furious. Weak to egzystencjalny (a bar at 99% is a
hypothesis).
Spór 1: „Pozostało: 1 minuta.” (for ten minutes) → egzystencjalny. Spór 2: „Kontrola nie
wykazała nieprawidłowości. Zalecenia w załączniku.” → regulaminowy.
Czynności: Odbiór (the audit protocol, page 2) · Stawiennictwo (the inspection spot, page 4) ·
Skreślenie („Aktualizacja 1.4 (Nowość)”).
Board: „Kontrola jest wyrywkowa. Wyrywa się losowo.” Idle: „Numer 48213 skontrolowano. Jest
w porządku. Zgłaszającego skontrolowano. Jest.” Handover: „Kontrolę zakończono. Sprawę
skierowano do archiwum (48213/13).”

**13. Archiwizacja** (Trzynasta, Przedawniona). The archive (**archiwum** layout: shelves,
ladders, a reading table). Quiet is required: skills make noise, auto-attacks do not.
Archived things exist to a degree, so the generated ones dominate, but every family has a
filed copy here. The applicant must get the file back before it is closed.
**Teczka Zbiorcza** (boss): a cabinet of drawers that has swallowed the file. Every 12 s a
drawer opens and releases a card: a reduced copy of one earlier boss attack (Prototyp's lunge,
Weryfikacja's grid, Kolejka's slip, Odmowa's slam) drawn on an index card. Phase change when
the player walks into the drawer that holds 48213 (the Asystent names it, wrongly once): the
file is pulled out, every drawer shakes open at once. Weak to egzystencjalny.
Spór 1: „Sprawę zarchiwizowano. Sprawy zarchiwizowane uważa się za zakończone.” →
regulaminowy „Archiwizacja nie kończy sprawy. Kończy miejsce na półce.” (wrong: „Szufladę
otwiera się siłą.” · „Zakończone jest to, czego nikt nie szuka.”) Spór 2: „Teczka zawiera
48213 kart. Karty nie są ponumerowane.” → egzystencjalny „Jedna z kart jest mną. Nie wiem,
która.” (wrong: „Karty mają rogi. Rogi się zaginają.” · „Teczka bez spisu nie jest teczką.”)
Czynności: Odbiór ×3 (three cards of the file from teczki on pages 2, 4, 6; the Asystent says
there are four) · Skreślenie („Egzemplarz Archiwalny”).
Board: „Archiwum czynne. Prosimy nie przeszkadzać sprawom.” Idle: „W archiwum odnaleziono
teczkę numeru 48213. Teczki zgłaszającego nie odnaleziono. Teczki są tą samą teczką.”
Handover: „Teczkę wydano, o jedną kartę za mało. Wznowiono postępowanie (48213/14).” End of
Akt IV.

### Akt V. Komisja

**14. Wznowienie postępowania** (Czternasta, Ewentualna). The case is reopened, so the
procedure starts again: a landing field like chapter 1, redrawn by someone who had only the
file to go by. New clause **Stan poprzedni**: „Postępowanie wznawia się od stanu poprzedniego.”
Each page spawns a copy of the hero as they were on the previous page (gear and skills then,
simplified AI: the Pętla copy reused) that fights the player; killing it drops one of its items.
**Precedens** (boss): a copy of the hero as they were at the end of chapter 1 (level, gear
and skills from the save's history, scaled to chapter 14 numbers), drawn with the stamp
PRECEDENS. It uses the hero's three first skills against them; its racja bar is labelled with
the player's name. Phase change at half: it switches to the player's current loadout (the
Komisja updated the file). Weak to the hero's own weakness type, if any, else none.
Spór 1: „Byłem tu pierwszy. Sprawa jest moja.” → egzystencjalny. Spór 2: „Mam Twój numer.
Ty masz załącznik.” → regulaminowy.
Czynności: Odbiór (the missing card, page 3, guarded by a copy) · Stawiennictwo (the spot
where the run began in chapter 1) · Oświadczenie („Czy podtrzymuje Pan/Pani wniosek”).
Board: „Postępowanie wznowione. Czynności dokonane uważa się za niedokonane.” Idle: „Numer
48213 wezwano na posiedzenie. Numer potwierdził obecność.” Handover: „Sprawę skierowano na
posiedzenie (48213/15).”

**15. Posiedzenie** (Piętnasta, Wyznaczona). The hearing hall. All six families sit in rows.
New clause **Protokół**: „Wszystko jest protokołowane.” Every player action adds a line to a
margin protocol; at 20 lines the protocol is read out: everything on the page freezes for 3 s,
the player included, the lines are stamped and the margin clears.
**Protokolant** (boss): a typewriter on legs with a roll of paper that grows across the floor
as the fight goes on; the paper strip is an obstacle that deals damage when it moves. It
records the player's last skill and plays it back as its own attack 3 s later (the hero's own
projectile or area, drawn in the Protokolant's ink). Phase change when the roll reaches the
far wall: it tears, the boss is briefly still, then types faster. Weak to mechaniczny (keys).
Spór 1: „Protokół oddaje przebieg wiernie. Przebieg oddaje protokół.” → egzystencjalny.
Spór 2: „Zgłaszający oświadczył, że nic nie oświadcza. Zaprotokołowano.” → regulaminowy.
Czynności: Stawiennictwo (the witness spot) · Oświadczenie ×2 (two questions from the
bench: „Czy zgłaszający jest załącznikiem”; „Czy numer jest obecny”).
Board: „Posiedzenie jest jawne. Jawność ogranicza się do protokołu.” Handover: „Posiedzenie
zamknięto. Sprawę przekazano Komisji do zamknięcia (48213/16).”

**16. Zamknięcie sprawy** (Szesnasta, Ostateczna). The seat of the Komisja, a hall drawn as a
form. New clause **Klauzula końcowa**: „W sprawach nieuregulowanych stosuje się wszystkie
pozostałe regulaminy.” Each page of this chapter runs one earlier campaign clause, in order,
printed in its header; the boss page runs none.
**Komisja** (boss): six seats on a bench, one figure per family assembled from that family's
parts: Przewodniczący (a printer with a gavel, U), Sekretarz (a badge whose number grows, P),
Członek (dotted line, e=0.3, abstains, W), Protokolant (a smaller one, F), Opiniodawca (a
one-star, O), Doradca (a progress bar at 99%, A). Each seat has its family's resist and
weakness. The Komisja votes every 15 s: the majority of living seats casts a stamp attack on
the floor (telegraphed outline). Phase change when the fourth seat is struck out: the two left
declare quorum. The longest fight in the game.
Spór 1: „Komisja obradowała. Sprawa jest złożona.” → regulaminowy „Obrady bez protokołu nie są
obradami.” (wrong: „Złożoną sprawę można rozłożyć.” · „Komisja też jest złożona, w jednej
szóstej z kropek.”) Spór 2: „Kworum zachowano. Większość Komisji nie istnieje w stopniu
wystarczającym.” → egzystencjalny „Większość, która nie istnieje, głosuje jednomyślnie.”
(wrong: „Kworum liczy się od krzeseł. Krzesła stoją.” · „Głos nieistniejącego członka jest
głosem wstrzymującym.”)
Czynności: Stawiennictwo (before the bench) · Doręczenie (the complete file to the
Przewodniczący's counter) · Oświadczenie („Czy zgłaszający ma coś do dodania”; the right
reply, any type: „Nie.”).
Verdict form after the fight (a modal, stamped): „Zgłoszenie nr 48213 zamknięto.
Rozstrzygnięcia nie wydano. Zgłaszający pozostaje w stanie, w jakim się zgłosił. Numer
pozostaje w Komisji. Sprawie nadano nowy numer: 48214.” The profile line gains „(w toku)”.
The Asystent's last note: „Przypis ostatni. Przypisów dalszych nie przewidziano.” then
„Przepraszam za nieścisłość w przypisie ostatnim.” Afterwards the desk offers Zgłoszenia
dodatkowe (random planets, 48214 onwards) and free travel to chapters 1–16 (PLAN §7). A
certificate „Zaświadczenie o zakończeniu postępowania” goes to the notice board.

## 6. The three new families (DESIGN §6 additions)
Each follows the existing pattern: assembled from drawn parts, one trait that is also a
mechanic, claims as bubbles, resist and weakness by type, a boss, a music flavour (§14).
- **Formularze** (forms; ch. 4). Bodies: an A4 sheet, a two-page spread, a locked PDF drawn
  with a padlock, a receipt roll; legs: paper clips, a staple, a ruler; heads: a stamp box, a
  checkbox, a signature line. Trait **pole obowiązkowe**: one empty field with a label; the
  label is the weakness (Podpis = mechaniczny, Podstawa prawna = regulaminowy, Oświadczenie =
  egzystencjalny) and the form cannot fall below 1 racja until it takes a hit of that type (the
  field is then drawn filled). Resist egzystencjalny. Claims: „Pole obowiązkowe”, „Nieprawidłowy
  format”, „Sesja wygasła”, „Załącznik przekracza 2 MB”. Elite *do podpisu*: the field changes
  type every 5 s. Sound: paper rustle, pen scratch.
- **Opinie** (reviews; ch. 8). Bodies: a row of 1–5 stars with legs, a thumbs-up, a
  „zweryfikowany zakup” badge, a bubble with three dots; legs: stick legs or a cursor arrow;
  heads: an avatar circle with initials. Trait **gwiazdki**: the rating is the tier; killing a
  5-star within 120 units of others lowers each by one star (redrawn, racja cut); the 1-star is
  the elite *z pretensją*: buffs reviews near it, and its death claim pulls a Powiadomienie.
  Resist regulaminowy. Weak egzystencjalny. Claims: „Polecam”, „Nie polecam”, „Pomocna dla
  3 osób”, „Zweryfikowany zakup”, „Nigdy więcej”. Sound: a plucked ding, a cursor click.
- **Aktualizacje** (updates; ch. 12). Bodies: a progress bar on legs, a patch-notes scroll, a
  „Nowość!” badge, a restart dialog with two buttons; legs: a spinner, a loading dots trail;
  heads: a percentage. Trait **postęp**: an Aktualizacja gets stronger the longer it lives
  (its bar fills over 20 s; at 100% it „installs” onto the nearest enemy: tier up, redrawn with
  a Nowość! badge) and is harmless while its bar is under 30%. Resist mechaniczny (software).
  Weak regulaminowy (an update needs consent). Claims: „Pozostało: 1 minuta”, „Nie wyłączaj
  urządzenia”, „Dostępna nowa wersja”, „Uruchom ponownie później”. Elite *krytyczna*: cannot
  be postponed, it installs on itself. Sound: a rising tick, a restart chime cut short.

## 7. New clauses (laws.ts additions; the nine existing are used once each)
Limit rozmiaru (ch. 5), Opinie zweryfikowane (8), Głosowanie (9), Kontrola wyrywkowa (12),
Stan poprzedni (14), Protokół (15), Klauzula końcowa (16), plus two for the Zgłoszenia
dodatkowe pool: **Tryb oszczędzania** („Planeta pracuje w trybie oszczędzania energii”: the
page is drawn only within 250 units of the hero, the rest is blank paper; enemies outside are
asleep) and **Zgoda marketingowa** („Wyrażasz zgodę na otrzymywanie ofert”: an advertisement
footnote every 45 s; the kiosk sells one discounted item per page). Every clause stays a real
modifier, as in DESIGN §4.

## 8. The roster screen as the frame (PLAN §7)
The first screen after the title is the **Kartoteka**: the Komisja's cabinet of applicants.
Each character is a **teczka** (a folder with a tab): the hero's figure, the hero name, an
optional given name typed by the player („Zgłaszający (opcjonalnie)”), level, the act and the
chapter the file is at (`Akt III · 48213/8`) and the priority. „Załóż teczkę” creates a
character: hero choice is the current PROFIL UŻYTKOWNIKA screen, then the name field. Deleting
is „Zniszcz teczkę (po upływie okresu przechowywania)” with a confirmation stamp. The shared
stash is the „Archiwum zakładowe”, a cabinet drawer at the base reachable from every folder.

## 9. Where every line lands (all existing channels; nothing new to render except the
czynności checklist on the ticket header)
1. Ticket header at the desk: Dotyczy (per hero), Akt and Etap, the suffix, the czynności.
2. Base page: the notice board announcement, 3–4 idle notes, the paczkomat note (a delivery per
   chapter once slice 10 lands).
3. The Akceptuję screen: the fixed clause.
4. Page entry footnotes: one per page, plus the czynność ticks, plus the number thread once
   per chapter (sixteen lines, one thread).
5. Boss: meet, phase, two Spór comments with three replies each.
6. Closing: the stamp on the ticket, the handover footnote, the history entry.
7. Chapter 16: the verdict form, the certificate, the profile suffix.
Rough count: about 400 strings in a new `story.json`, thirteen boss blocks and three family
blocks in `enemies.json`, nine clauses in `laws.json`, three adjectives in `screens.json`.
Zgłoszenia dodatkowe keep the current procedural texts and draw czynności at random.

## 10. What this costs to build (goes into the slice order)
- A campaign table, pure data: chapter → act, planet name parts, layout, clause, family mix,
  page count, boss id, czynności, text keys (`src/world/campaign.ts`); the run generator takes
  a chapter when the ticket is a campaign ticket (PLAN slice 7). Chapters 1–3 pinned first.
- The czynności system: five primitives, the checklist on the header, the gated exit. One
  slice; it also feeds Zgłoszenia dodatkowe.
- Three families, one slice each, in story order (4, 8, 12).
- Thirteen bosses, two per slice where they share a mechanic: Wniosek + Kolejka (floor fields,
  packs) · Załącznik + Płatność Nieudana (splitting bars) · Średnia Ważona + Ankieta (summons,
  floor squares) · Awizo + Odmowa (teleport points and the SMS code; floor marks) · Audyt +
  Teczka Zbiorcza (the inspection cone; replayed cards) · Precedens + Protokolant (the hero
  copy from the save; skill playback) · Komisja alone (six assembled figures, a shared bar).
- Nine clauses in `laws.ts`, two base layouts (urząd, archiwum).
- The roster screen (slice 6a) with the Kartoteka frame.
- The voice pass on `story.json` per act, five passes.
The game is playable at every step: the desk offers the chapters that exist and the Zgłoszenia
dodatkowe after the last built one.

## 11. Difficulty, pacing, voice
Akt I is today's three runs. Chapter 4 brings a family and the first new boss, chapter 6 the
first three-family mix, chapter 8 the second family, chapter 12 the third; pages grow 4 → 8.
Each act is about 90 minutes at Normalny; the whole case 6–8 hours, then free travel and the
Zgłoszenia dodatkowe at the character's level (max-level sets are farmed there, PLAN §7).
The Asystent never says the Komisja is wrong. Units pass the file on because the regulamin
requires it, never from spite. The applicant's status is a matter of record, not of feeling.
Bosses speak like users in a comment section, the Komisja like minutes of a meeting. The twist
of chapter 10 is stated flatly once and never explained again; the number thread is stated once
per chapter and resolved only in the verdict form.

## 12. Open questions for the player
1. Five acts, sixteen chapters as laid out, or a different count (twelve: drop Załączniki,
   Konsultacje, Kontrola, Wznowienie; twenty: a fourth planet in every act)?
2. The ending: no decision, new number, applicant unchanged (my pick, Lem), or the application
   granted as a wariant („uznano za osobę (wariant: pralka)”)?
3. The chapter 10 twist (the decision concerns the number, which meant another case at the
   time) and the number thread resolved in chapter 16: keep both, one, or neither?
4. The thirteen new bosses as sketched? The Komisja with six seats and Precedens (a copy from
   the save's history) are the expensive ones; three seats and a fixed-loadout copy are the
   cheaper fallbacks.
5. The three new families: Formularze, Opinie, Aktualizacje, or others (held back: Reklamy,
   Subskrypcje, Regulaminy)?
6. Czynności as proposed (two or three per chapter, gating the boss page), or lighter (one per
   chapter, never gating)?
7. Per-hero text limited to the subject line, or one more line per hero per act (five heroes ×
   five acts = twenty-five lines, each a small joke on the hero's status)?
8. The ticket number: `48213/8` handover suffix (my pick), plain 48213 on every planet, or
   letters (48213-H)?
9. Kartoteka: typed character names (phone keyboard) optional, as proposed, or none?
10. Two new base layouts (urząd, archiwum), or reuse the three?
