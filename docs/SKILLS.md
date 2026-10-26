# Skills proposal: categories, paragraphs, ultimates, passives per hero

Status: accepted roster (2026-10-18), built S19–S21. The tables below are the briefs the
builders worked from; **§6 (M4 review) lists where the code differs and rules which stands**.
Where §6 is silent the table holds; where they disagree, the code and the Polish skill text in
`src/i18n/pl/heroes/<id>.json` are the truth, and the voice editor keeps the text true to the
code, not to this file.

Conventions. Types: **mech**, **reg**, **egz** (mechaniczny, regulaminowy, egzystencjalny). Aim as
DESIGN §5.6 (kier. = kierunek, wsk. = wskazanie). "Lvl" is the unlock level (PLAN §2.5); today's
skills 4 and 5 keep their family permission at first rank. § 1 is the base (an existing skill: as
built, DESIGN §10); § 2 unlocks at lvl + 6, § 3 at lvl + 14; a paragraph names only what it
changes. Multipliers are of the weapon roll. Primitives from PLAN §2.6, NEW ones marked. Every
effect below is ink strokes, one marker per status, one stamp per ultimate.

---

## 1. Pralka Emancypowana

**Fantasy.** At level 30 she is a drum in the middle of the page: enemies are pulled in, washed,
verified, dropped locked; cooldowns chain like a wash programme and being hit is the engine.
Rule: *błąd programu*, every 10th hit on her fires an installed skill at random.

| Skill | Cat | Type · aim · lvl | § 1 (drawn as) | Primitives | § 2 | § 3 |
|---|---|---|---|---|---|---|
| Wirowanie | podst. | mech · auto · 1 | AoE around self, slight pull | aoe, pull | *z płukaniem*: reg; pulled **do weryfikacji** 1 s | *bębna*: push 40 instead, +25% |
| Płukanie | podst. | reg · auto · 3 | Splash r 70, 0.6×, cd 3; removes one status from her (water strokes) | aoe, status apply | egz; hit **zgłoszony** 2 s | cd 2, 0.4×; every third resets Wirowanie |
| Otwarcie bębna | ofens. | mech · kier. · 5 | Cone 150/35°, 1.3×, knockback 40, **do weryfikacji** 3 s | cone, push, status apply | *na wprost*: line 220, 1.6×, no push | *pełny załadunek*: reg; **zablokowany** 1 s, no push |
| Program 90° | ofens. | mech · auto · 9 | Zone r 90 under her 3 s, 0.4×/s, she is slowed 30% (steam strokes) | zone, buff | *60°*: 5 s, 0.25×/s, no slow | *gotowanie*: egz; leaving costs 0.8× |
| Wniosek o osobowość | ofens. | egz · auto · 11 | 6 s reading: 0.35×/s within 140, Wygenerowane e→0.5, +20 upór | zone, buff | *uzupełniony*: 4 s, 0.6×/s, no upór | *odwołanie*: reg; in the ring **wyciszony** |
| Pranie wstępne | obr. | reg · auto · 1 | Foam shield 5 s; touchers **do weryfikacji** | buff, status apply | *piana aktywna*: shield −30%, touchers take 0.5× | *prasowanie*: mech; push 60 when it ends |
| Tryb oszczędny | obr. | mech · auto · 3 | 4 s: −40% taken, −30% speed; hits on her count double for the rule (dotted frame) | buff | *nocny*: 6 s, −25%, no slow | *serwisowy*: reg; 2 s, immune to statuses |
| Odwirowanie | użyt. | mech · kier. · 1 | Dash dragging one enemy, drops it **zablokowany** | dash, pull, status apply | *zbiorowe*: three dragged, lock 0.7 s | *wyrzut*: reg; dragged thrown 120 at the end |
| Zmiana programu | użyt. | reg · auto · 7 | Resets the last skill's cooldown; next cast costs 10 racja (struck word on the HUD) | buff (NEW: cooldown reset) | the reset skill fires with its § 2 | free, but she is **wyciszony** 1 s |
| Odpompowanie | użyt. | reg · wsk. · 14 | Puddle r 100, 5 s: inside **do weryfikacji**, loot slides to the rim (hatched puddle) | zone, status apply | mech; r 60, slow 70% | *odpływ*: egz; pulls 20/s to centre |

**Ultimates.** *Pełny cykl* (mech, auto, 12): 5 s, every enemy within 200 pulled 80/s into the
drum, 0.6×/s, dropped **zablokowany** 2 s. Stamp CYKL ZAKOŃCZONY; the margin notes the programme
number. § 2 *delikatny*: 8 s, 0.3×/s, no lock, +3 racja/s. § 3 *intensywny*: reg; 3 s, 1.2×/s,
r 140. *Uznanie osobowości* (egz, auto, 24): 8 s as a person: immune to statuses, +30 upór,
0.8×/s within 160, Wygenerowane e→0.3. Stamp OSOBA on her form. § 2: 12 s, 0.4×/s, summons
+20%. § 3 *warunkowe*: reg; 4 s, 1.5×/s, she cannot move. *Reklamacja* (reg, auto, 36): every
enemy on the page **zgłoszony** 8 s and 1.0×; stamp REKLAMACJA PRZYJĘTA, a struck ticket number
over each. § 2: mech; the three nearest also **zablokowany** 2 s. § 3 *odrzucona*: egz; 2.0×,
only enemies whose claim she has not yet rebutted.

**Passives.** 1–6 as today: Dodatkowy cykl, Zawór bezpieczeństwa, Wyższe obroty, Filtr kłaczków,
Wirnik zapasowy, Pranie delikatne. 7 **Błąd programu** (the rule; always on, no slot): every 10th
hit on her fires a random installed skill. 8 Wersja 1.1: every 7th hit, with her current
paragraph. 9 Gwarancja: once per page, below 20% racja a foam shield 40 appears. 10 Bęben pełny:
each enemy pulled by Wirowanie adds +4% to her next ofensywna (max 24%).

**Loadouts.** *Pralnia*: Wirowanie § 2, Pranie wstępne § 2, Odwirowanie § 1 + Pełny cykl; 2, 4, 7,
9: stand, pull, verify, outlast. *Osoba*: Płukanie § 2, Wniosek o osobowość § 1, Tryb oszczędny
§ 1 + Uznanie osobowości; 3, 6, 7, 10: an egz aura tank for Urządzenia planets. *Serwis*: Otwarcie
bębna § 2, Zmiana programu § 2, Odwirowanie § 3 + Reklamacja; 1, 3, 8, 10: cooldown chaining,
bursts in lines, moves a lot.

**Synergies.** Mech claims (Urządzenia): Wirowanie, Otwarcie bębna. Reg (Powiadomienia): Płukanie,
Pranie wstępne. Egz (Wygenerowane): Wniosek o osobowość. Argument: being hit fires skills (rule
7), which rebut, which fill the meter; Pełny cykl drags a room into one rebuttal.

---

## 2. Konsultant Infolinii

**Fantasy.** At level 30 he never hits hard; the room is a queue he runs. Everything has a
number, a hold time and a department, and enemies wait or attack each other more than they reach
him. Rule: *dostęp do systemu*, he knows every device's defect and trials items twice as fast.

| Skill | Cat | Type · aim · lvl | § 1 (drawn as) | Primitives | § 2 | § 3 |
|---|---|---|---|---|---|---|
| Zgłoszenie przyjęte | podst. | reg · auto · 1 | A ticket 0.8×, bounces once to an enemy within 90 (second dotted arc), cd 3 | projectile | *zbiorcze*: three tickets in a 20° fan, 0.5× | *pilne*: egz; no bounce, 1.3× |
| Formularz kontaktowy | podst. | reg · wsk. · 3 | Form r 60, 3 s: slow 30%, 0.3×/s (ruled rectangle) | zone, status apply | mech; first enemy in **zablokowany** 1 s | *pole obowiązkowe*: none may leave 1.5 s |
| Przekierowuję | ofens. | egz · kier. · 1 | Cone; hit **zgłoszony**, attack each other 3 s | cone, status apply | *do działu*: reg; line 220 | *bez końca*: 5 s, no **zgłoszony** |
| Numer sprawy | ofens. | reg · wsk. · 5 | Stamped number: +35% taken 6 s, 0.5×, reassigned on death ×3 | hitscan, status apply | *zbiorczy*: three nearest, 4 s, no handover | *pilny*: egz; +60%, 3 s |
| Rozłączenie | ofens. | mech · kier. · 7 | Line 220: first enemy thrown 180, **zablokowany** 2 s, 1.0×; below 25% it dies | line, push, status apply | *masowe*: cone 120/30°, throw 100, no execute | *formalne*: reg; no throw, execute below 35% |
| Muzyka w słuchawce | obr. | reg · auto · 1 | 4 s: within 120 **do weryfikacji**, he takes −30% (a stave circling him) | buff, status apply | *na żywo*: egz; r 180, −15% | *cisza*: 2 s, within 120 **wyciszony** |
| Przerwa techniczna | obr. | mech · kier. · 3 | Steps back 120; a chair decoy holds **przeczytane** within 100 for 2 s | teleport, decoy, status apply | *dłuższa*: decoy 4 s, step 80 | *z winy klienta*: reg; the chair deals 0.6× when struck |
| Proszę czekać | użyt. | reg · wsk. · 1 | Target **zablokowany** 1.5 s (hourglass) | hitscan, status apply | *łączę*: two targets, 1 s | *czas wydłużony*: egz; 3 s, cd +4 |
| Czy mogę jeszcze w czymś pomóc | użyt. | reg · auto · 9 | +crit; each kill drops 1 gwiazdka | buff | *dodatkowa*: egz; crits apply **zgłoszony** | *płatna*: crit doubled, no gwiazdki |
| Oddzwonimy | użyt. | reg · wsk. · 14 | A phone rings after 3 s: enemies within 110 run to it (**przeczytane**), then 1.2× (phone, ring of ink) | summon (static), status apply, aoe | *w ciągu 24 h*: rings after 1 s, r 80 | *z innego numeru*: mech; throws the nearest 120 |

**Ultimates.** *Przekazanie do działu* (reg, auto, 12): every enemy on the page attacks the
nearest other enemy 5 s and takes 0.8×. Stamp PRZEKAZANO; each bubble redrawn with "dział". § 2:
egz; 3 s, 1.5×. § 3: 8 s, no damage, every death drops a gwiazdka. *Koniec kolejki* (mech, auto,
24): every enemy carrying his status is pulled into a line before him and disconnected one by
one over 2 s, 1.6×, thrown 160. Stamp ROZŁĄCZONO over the HUD. § 2 *odwrotna*: furthest first,
2.2×. § 3: reg; no throw, **zablokowany** 3 s. *Ankieta* (egz, wsk., 36): survey form r 160;
inside **zablokowany** 2 s while they rate the call, then 2.0×; deaths inside drop gwiazdki ×2.
Stamp OCENIONO on the form. § 2: r 100, 3.0×. § 3 *obowiązkowa*: reg; enemies pulled onto it first.

**Passives.** 1–6 as today: Skrypt rozmowy, Kolejka priorytetowa, W celu poprawy jakości, Muzyka
oczekiwania, Ankieta satysfakcji, Eskalacja do przełożonego. 7 **Dostęp do systemu** (rule, always
on): trials twice as fast, defects visible at once. 8 Numerek: enemies he gives a status to are
numbered; kills in order give +3% crit per step (max 15%). 9 Połączenie nagrywane: an enemy killed
while **zablokowany** leaves its bubble on the floor 3 s; the next enemy to step on it takes the
claim. 10 Wstrzymanie opłat: each Czy mogę jeszcze w czymś pomóc lowers kiosk prices 10% this run
(max 30%).

**Loadouts.** *Infolinia*: Zgłoszenie przyjęte § 1, Proszę czekać § 2, Muzyka w słuchawce § 1 +
Przekazanie do działu; 2, 4, 7, 8: stun, slow, let them wait. *Windykacja*: Numer sprawy § 2,
Rozłączenie § 1, Przerwa techniczna § 3 + Koniec kolejki; 1, 3, 6, 9: single-target removal,
kites with the chair. *Sprzedaż*: Formularz § 3, Czy mogę jeszcze w czymś pomóc § 1, Oddzwonimy
§ 1 + Ankieta; 5, 7, 8, 10: crits and gwiazdki.

**Synergies.** Reg claims are home: nearly everything rebuts Powiadomienia. Mech: Rozłączenie,
Formularz § 2, Oddzwonimy § 3. Egz: Przekierowuję, Zgłoszenie pilne, Numer pilny. Argument: Numer
sprawy makes a rebuttal ×2.7, so the meter fills fastest on numbered targets; Przekazanie rebuts
a page of Powiadomienia in one stamp.

---

## 3. Pętlowiec

**Fantasy.** At level 30 the page has four of him, each with an opinion, and time is something he
files rather than obeys: he arrives before leaving, repeats what has not been said, withdraws the
last six seconds when the argument goes badly. Rule: *pętla po śmierci*, on the death outcome
Pętla the copy left behind is friendly 10 s.

| Skill | Cat | Type · aim · lvl | § 1 (drawn as) | Primitives | § 2 | § 3 |
|---|---|---|---|---|---|---|
| Uwaga na marginesie | podst. | egz · auto · 1 | A remark 0.9×, cd 3; every copy throws one at its own target (text-line projectiles) | projectile | *zbiorcza*: reg; all copies aim at his target | *nie na temat*: mech; 1.4×, copies do not repeat |
| Powtórzenie | podst. | egz · kier. · 5 | A remark as a line 180, 0.7×; each copy draws the same line from itself | line | *dosłowne*: reg; hit **wyciszony** 1 s | *w zapisie*: lines stay 2 s, 0.2×/s |
| Spór | ofens. | egz · auto · 1 | AoE around each copy | aoe | *formalny*: reg; also **zgłoszony** 3 s | *zasadniczy*: mech; around him only, 2.0× |
| Odłożony start | ofens. | mech · wsk. · 7 | Capsule lands 0.8 s later: 2.0× in 90, knockback 60, **przeczytane** 2 s | zone (delayed), aoe, push, status apply | *natychmiastowy*: 0.2 s, 1.4×, no push | *wieloetapowy*: egz; on him and each copy, 1.0× |
| Paradoks | ofens. | egz · wsk. · 11 | Clock-face zone r 110, 4 s: every hit inside echoes 0.5 s later at 0.5× | zone, status apply (NEW: echo) | *dziadka*: mech; echo 0.8×, r 70 | *urzędowy*: reg; inside **do weryfikacji** |
| Pętla | obr. | mech · auto · 1 | Back to where he was 3 s ago, racja restored | teleport, heal | *dłuższa*: 5 s ago, cd +4 | *z zapisem*: reg; a decoy 2 s where he left |
| Opóźnienie | obr. | reg · auto · 3 | 3 s: damage taken is logged and applied 3 s later at half (bracket on the racja line) | buff (NEW: deferred damage) | *bezterminowe*: 2 s, a quarter, cd +5 | *z winy nadawcy*: egz; the deferred damage goes to the nearest enemy |
| Przybycie przed wyjazdem | użyt. | reg · auto · 1 | A copy 8 s (max 2), auto-attacks, disagrees in footnotes | summon | *wcześniejsze*: 5 s, two at once | *z bagażem*: mech; arrives with a capsule hit 0.6× |
| Już to było | użyt. | egz · auto · 9 | Recasts the last skill with its aim; copies too | buff (recast) | *dwukrotnie*: the last two, copies do not | *już mówiłem*: reg; cd 10, uses the other paragraph |
| Zamiana miejsc | użyt. | mech · auto · 14 | Swaps places with the nearest copy; enemies at his old spot **przeczytane** toward the copy 2 s (crossed dotted arrows) | teleport, status apply | *z przeciwnikiem*: egz; swaps with the target enemy | *planowa*: reg; the copy's duration refreshes |

**Ultimates.** *Zebranie wszystkich pętli* (reg, auto, 12): four copies 6 s over the max, each
casting Spór on arrival. Stamp OBECNI with an attendance list of five ticks. § 2: six copies, 3 s.
§ 3: egz; two copies with his full racja and skills. *Cofnięcie zgłoszenia* (mech, auto, 24): the
last 6 s are withdrawn: he and every enemy return to where they were, his racja to then, the
dead stay crossed out, the rest take 1.5×. Stamp WYCOFANO; the footnote slip retracts its last
line. § 2: 10 s, no damage. § 3 *częściowe*: egz; only he returns, every enemy **zablokowany** 2 s.
*Przedwczesny powrót* (egz, auto, 36): the capsule falls on him and on every copy at once, 2.5× in
100 each, Wygenerowane inside e→0.3. Stamp PRZYBYŁ PRZED WYJAZDEM. § 2: mech; knockback 90. § 3:
three capsules over 1.5 s on him only, 1.5× each.

**Passives.** 1–6 as today: Nadgodziny, Pamięć mięśniowa, Niezgodność wersji, Skrócony cykl, Zapas
tlenu, Dodatkowa pętla. 7 **Pętla po śmierci** (rule, always on): the death copy is friendly 10 s;
in a run a copy that outlives him by 2 s files a footnote of disagreement. 8 Sprzeczność: a copy's
hit of a type other than his last hit deals +15%. 9 Dziennik pokładowy: the third identical cast
in a row is free. 10 Zapasowa kapsuła: Pętla restores the copies' racja too.

**Loadouts.** *Załoga*: Uwaga § 1, Przybycie § 2, Spór § 1 + Zebranie wszystkich pętli; 1, 6, 7,
8: a crowd of remarks. *Chronologia*: Powtórzenie § 3, Opóźnienie § 3, Pętla § 3 + Cofnięcie
zgłoszenia; 4, 5, 9, 10: time as a resource, solo. *Lądowanie*: Odłożony start § 1, Paradoks § 1,
Już to było § 1 + Przedwczesny powrót; 2, 3, 6, 8: burst at a point, repeated.

**Synergies.** Egz claims: Spór, Uwaga. Reg: Przybycie, Spór § 2, Uwaga zbiorcza. Mech: Odłożony
start, Spór § 3, Przybycie § 3. Argument: copies' rebuttals count as his, so four copies with Uwaga
fill the meter faster than any hero; Paradoks doubles each.

---

## 4. Kartograf Planet Nieistniejących

**Fantasy.** At level 30 the page is a survey sheet: ruled lines cross it, every enemy carries a
measurement and most are wrong by design; he fights at the longest range with a border and a
benchmark between him and the room. Rule: *mapa z góry*, the page is revealed on entry; the
navigation insists the planet exists.

| Skill | Cat | Type · aim · lvl | § 1 (drawn as) | Primitives | § 2 | § 3 |
|---|---|---|---|---|---|---|
| Triangulacja | podst. | mech · kier. · 1 | Line piercing all, +20% per enemy passed | line | *zwrotna*: reg; returns, hits twice at 0.6× | *rozwarta*: egz; two lines at ±15° |
| Pomiar | podst. | reg · auto · 3 | Measured hitscan 0.9×, cd 2.5; third on the same enemy stamps **zgłoszony** 3 s (ruled line with ticks) | hitscan, status apply | *przybliżony*: mech; the two nearest, no mark | *kontrolowany*: egz; 1.4× on **zgłoszony** |
| Skala 1:1 | ofens. | reg · auto · 5 | 5 s: auto range +60%, autos pierce, crossed **do weryfikacji** 1.5 s | buff, status apply | *1:2*: 8 s, +30% range, no pierce | *2:1*: mech; 3 s, autos ×1.5, range −20% |
| Legenda | ofens. | egz · wsk. · 7 | Box r 130, 4 s: wrongly named, **przeczytane** toward him, 0.35×/s | zone, status apply | *skrócona*: r 80, 0.7×/s, 2 s | *urzędowa*: reg; named are **wyciszony** |
| Przekrój | ofens. | mech · kier. · 11 | Five survey lines fan 40°, reach 220, 0.5× each (a fan of rulings) | cone (five hitscans) | *poprzeczny*: one thick line, 2.0×, reach 160 | *warstwowy*: egz; lines stay 1.5 s, slow 40% |
| Korekta | obr. | reg · wsk. · 1 | Blink to the point; "błąd pomiaru" decoy with **przeczytane** | teleport, decoy, status apply | *z erratą*: mech; decoy deals 0.8× on expiry | *podwójna*: two blinks within 2 s, decoys 1 s |
| Granica | obr. | mech · kier. · 3 | Ruled border 160 across the direction, 4 s: crossers pushed 60, **do weryfikacji** 1 s | line (static), push, status apply | *sporna*: egz; no push, crossers take 0.8× | *państwowa*: reg; 6 s, 100 long, crossers **zablokowany** 1 s |
| Teren nieistniejący | użyt. | egz · wsk. · 1 | Marked area: **do weryfikacji**, Wygenerowane e→0.3 | zone, status apply | *sporny*: reg; inside +15% taken | *zalewowy*: mech; pulls 30/s to centre |
| Punkt odniesienia | użyt. | reg · wsk. · 9 | Benchmark (small triangle) 20 s; Korekta can blink to it from anywhere; autos from within 60 of it pierce | zone (anchor), buff | *niwelacyjny*: two benchmarks, 12 s | *sporny*: egz; every 4 s enemies within 90 **przeczytane** toward it 1 s |
| Róża wiatrów | użyt. | egz · auto · 14 | Enemies within 140 pushed 90 to the nearest cardinal direction, **do weryfikacji** 1 s (compass rose under him) | push, status apply | *czterech*: mech; 0.9× to the pushed | *odwrotna*: reg; pulls instead, no status |

**Ultimates.** *Mapa ostateczna* (reg, auto, 12): 6 s at scale 1:1, every enemy on the page
measured and **zgłoszony** 6 s, his auto fires twice, every line pierces. Stamp ZATWIERDZONO DO
DRUKU; the page edges get a border and a scale bar. § 2: 10 s, single auto. § 3: mech; 4 s, autos
×2.0. *Skreślenie z mapy* (egz, wsk., 24): a ruled rectangle 200×140; Wygenerowane below e 0.5
are crossed out at once, the rest take 2.5× and e→0.3. Stamp NIE ISTNIEJE over the rectangle.
§ 2: reg; no execute, 3.5×. § 3: the rectangle stays 5 s as Teren § 1. *Pomiar kontrolny* (mech,
wsk., 36): three Triangulacje through the point at 120°, 1.8× each, a crit where they cross.
Stamp POMIAR ZGODNY at the crossing. § 2: six lines at 60°, 1.0×. § 3: reg; the crossing is a
benchmark 20 s.

**Passives.** 1–6 as today: Dokładniejsza skala, Poprawka na krzywiznę, Szybki pomiar, Buty
terenowe, Znaki w terenie, Odczyt niezależny. 7 **Mapa z góry** (rule, always on): the page is
revealed on entry; the first enemy of each family per page gets a wrong name in a footnote,
corrected on its death. 8 Odległość w linii prostej: +1% damage per 10 units to the target (max
20%). 9 Błąd pomiaru: decoys last 2 s longer and deal 0.5× mech when struck. 10 Trzeci punkt: the
third hit of a line on the same enemy is a rebuttal whatever the claim.

**Loadouts.** *Pomiar*: Triangulacja § 1, Pomiar § 3, Korekta § 1 + Pomiar kontrolny; 2, 6, 8, 10:
lines, distance, crits. *Granica*: Przekrój § 1, Granica § 3, Punkt odniesienia § 1 + Mapa
ostateczna; 1, 3, 5, 9: holds a position behind a border. *Nieistnienie*: Legenda § 3, Teren § 1,
Róża wiatrów § 1 + Skreślenie z mapy; 4, 5, 7, 8: existence play, keeps moving.

**Synergies.** Mech claims: Triangulacja, Przekrój. Reg: Pomiar, Skala 1:1, Granica § 3. Egz:
Legenda, Teren, Róża wiatrów. Argument: a piercing line rebuts several claims per cast (each
counts); Trzeci punkt turns long-range focus into guaranteed meter.

---

## 5. Naleśnik

**Fantasy.** At level 30 it is the fastest thing on the page and the heaviest: it rolls through
rooms, enemies fall onto it, moons circle it and a small flag declares a legal fact the Komisja
has not confirmed. Rule: *równowaga hydrostatyczna*, flat above 90% racja (projectiles skim off),
round below a third (upór, no knockback).

| Skill | Cat | Type · aim · lvl | § 1 (drawn as) | Primitives | § 2 | § 3 |
|---|---|---|---|---|---|---|
| Orbita | podst. | mech · kier. · 1 | Rolls the line, bounces off obstacles; first enemy hit is a satellite 3 s | dash, line, status apply | *eliptyczna*: egz; two more bounces, no satellite | *stacjonarna*: reg; satellite 6 s, takes 0.3×/s |
| Krawędź | podst. | mech · auto · 3 | Short roll 80 at the target on its edge, 0.8×, cd 3; from behind a crit (short arc) | dash, aoe | *złożona*: reg; hits all on the path, 0.6× | *ostra*: egz; 1.2×, it is slowed 30% for 1 s |
| Pływy | ofens. | mech · auto · 5 | Ring to 160 over 0.4 s, push 70, 1.2×; loot pulled in | aoe (ring), push, pull | *przypływ*: egz; pulls 70 instead, 0.8× | *syzygijne*: reg; two rings 0.5 s apart, 0.7× |
| Upadek na powierzchnię | ofens. | mech · wsk. · 9 | Hops, lands flat at the point (range 140): 1.6× in r 100, push 50, round 2 s (dotted arc, ink slap) | teleport (hop), aoe, push, buff | *kontrolowany*: reg; r 60, 2.4×, no push | *z wysokości*: egz; crater zone 3 s, 0.3×/s |
| Pierścień | ofens. | reg · auto · 11 | Debris ring at 90–120 for 4 s: 0.6× per crossing, **do weryfikacji** 1 s (dotted ring, pebbles) | zone (ring), status apply | *wewnętrzny*: 50–80, 0.9×, 3 s | *planetarny*: egz; 6 s, Wygenerowane crossing e→0.5 |
| Wniosek o status | obr. | reg · wsk. · 1 | Flag r 120, 8 s: entering **zablokowany** 1 s + reg damage; +4 racja/s inside | zone, status apply, heal | *uzupełniony*: r 80, 12 s, +7 racja/s | *przyspieszony*: egz; the flag moves with it, 5 s |
| Zaokrąglenie | obr. | mech · auto · 3 | Round on demand 3 s: +20 upór, no knockback, −35% taken, −20% speed (rounder figure) | buff | *w górę*: 5 s, −20%, no slow | *w dół*: reg; flat instead: projectiles skim 100%, melee +20% |
| Grawitacja własna | użyt. | egz · auto · 1 | 2 s: all within 180 fall toward it, loot too; at the rim egz damage, **do weryfikacji** | pull, aoe, status apply | *silniejsza*: mech; 1 s, 1.5× at the rim | *urzędowa*: reg; at the rim **zablokowany** 1 s |
| Księżyc | użyt. | egz · kier. · 7 | Pebble moon at 90 for 8 s, 0.5× per pass, +10 upór | summon (orbiting) | *zewnętrzny*: orbit 140, 0.35×, 12 s | *regulaminowy*: reg; passed **do weryfikacji** 1 s |
| Zmiana orbity | użyt. | reg · wsk. · 14 | Rolls to the point on a curve 200 (through enemies, not walls); crossed **do weryfikacji** 2 s (dotted arc) | dash (curved), status apply | *na wniosek*: mech; 0.7× to the crossed | *o 180°*: egz; lands with a Pływy ring r 80 |

**Ultimates.** *Decyzja Komisji* (reg, auto, 12): stamp PLANETA KARŁOWATA on its form; 8 s a
Wniosek zone r 200 moves with it, entering **zablokowany** 1.5 s and 1.0×, +6 racja/s, it is
round. § 2 *odmowna*: egz; 4 s, 2.0×, the Asystent notes the rejection and a new application.
§ 3 *warunkowa*: mech; 12 s, no lock, satellites and moons ×2. *Zderzenie* (mech, kier., 24):
rolls 600 in the direction through enemies, stopped by walls, 3.0× to all on the path, a crater
zone 4 s with **do weryfikacji**. Stamp UDERZENIE at the end point. § 2: egz; the path is a Teren
zone. § 3: reg; reach 300, 4.0×. *Pełnia* (egz, auto, 36): three moons 8 s, orbits widening
90→160, 0.7× per pass, +30 upór. Stamp PEŁNIA; the orbits drawn as a small diagram in the margin.
§ 2: mech; moons knock back 40. § 3: reg; two moons, 14 s.

**Passives.** 1–6 as today: Krótszy okres obiegu, Większa masa, Poszerzona strefa wpływów,
Przypływ, Przedłużone rozpatrywanie, Ponaglenie. 7 **Równowaga hydrostatyczna** (rule, always on):
flat above 90% racja (−30% projectile damage), round below a third (5 s, +20 upór, no knockback);
the Asystent notes the reconsideration. 8 Pory: a projectile that skims off returns 0.3× mech to
its sender. 9 Masa krytyczna: each enemy pulled by Grawitacja adds +3% to the next ofensywna (max
30%). 10 Satelita stały: the Orbita satellite stays until it dies, taking 0.2×/s.

**Loadouts.** *Toczenie*: Orbita § 1, Krawędź § 2, Zaokrąglenie § 1 + Zderzenie; 2, 6, 7, 10: a
roller, hits from the move. *Studnia*: Grawitacja § 2, Pływy § 1, Wniosek § 1 + Decyzja Komisji;
3, 4, 7, 9: pulls, pushes, heals in its zone. *Układ*: Księżyc § 3, Pierścień § 3, Upadek § 1 +
Pełnia; 1, 5, 8, 9: orbiting bodies do the work, it stays flat.

**Synergies.** Mech claims: Orbita, Krawędź, Pływy, Upadek. Reg: Wniosek, Pierścień, Zmiana
orbity. Egz: Grawitacja, Księżyc, then Pływy for the kill (Wygenerowane are weak to mech).
Argument: Grawitacja gathers a mixed room so one Pływy rebuts every mech claim at once; Pełnia's
moons tick a rebuttal on every pass.

---

## Cross-hero rules

So that a sixth hero is data plus a figure, every hero has:
- **Counts**: 2 podstawowa, 2–3 ofensywna, 2 obronna, 2–3 użytkowa (10–11 skills), 3 ultimates
  at 12/24/36, 10 passives of which number 7 is the rule, always on, outside the four slots.
- **Types**: one skill of each type by lvl 7, so any claim can be rebutted before the first
  ultimate; the three ultimates are of three types, the first the auto's; § 2 or § 3 of every
  skill changes type once, so three pads can always cover three types.
- **Aim**: one skill per aim mode at least; the cheapest podstawowa is *auto*, so a tap always
  does something sensible with one thumb.
- **One obronna that works alone** (no target, no position) by lvl 3, and **one mobility** by
  lvl 3 (Odwirowanie, Przerwa techniczna, Pętla, Korekta, Orbita).
- **The auto's role**: the rebuttal of the home family and the meter's slow fill.
- **Paragraph grammar**: § 1 base; § 2 reshapes (shape, aim, count, duration); § 3 retypes or
  adds a status with a cost; a paragraph patches at most four fields.
- **Drawn**: one ink shape per primitive, one marker per status, one stamp per ultimate, one
  footnote where the name claims something.
- **Ultimate shape**: at most 8 s, one stamp, one page reaction (margin note, border, retracted
  footnote), radius at most 220 or the hero's own path; page-wide only through a status.

## Open questions for the player

Answered in PLAN §7 (2026-10-18): 1 always on and free; 2 the three new primitives stay; 3 one
page-wide ultimate per hero, through a status; 4 the permission gates the first rank only.
Question 5 (Zderzenie's 600) is decided by play in S21. Kept for the record.

1. The rule passive (number 7): always on and free, or one of the four slots so a player can
   switch Pralka's błąd programu off?
2. Three skills need NEW primitives (cooldown reset, deferred damage, echo): keep them, or drop
   Zmiana programu, Opóźnienie and Paradoks to stay inside the library?
3. Page-wide ultimates through a status (Reklamacja, Przekazanie do działu, Mapa ostateczna):
   acceptable, or should every ultimate have a radius?
4. Should § 3 of the fourth and fifth skills also need the family permission, or is the first
   rank's gate enough?
5. Zderzenie rolls 600 in one direction: acceptable on the phone, or wskazanie with a shorter
   path?

---

## 6. Ratified at the M4 review (2026-10-26): where the build differs from the tables

The five heroes shipped at ten skills, three ultimates and ten passives each (S19–S21). The
builders deviated from the tables where the engine or the phone asked for it; each deviation
was weighed against the Diablo benchmark and the cross-hero rules and is **ratified as built**
unless marked otherwise. Nobody re-syncs the tables above; this section is the errata.

### 6.1 Rules that explain most deviations (apply to every hero)
- **The only slow is do weryfikacji (50%).** Every "slow 30% / 40% / 70%" in the tables reads as
  the status *do weryfikacji* (one marker per status, DESIGN §5.3). No second slow status exists
  and none is added. (Formularz, Przekrój § 3, Krawędź § 3, Odpompowanie § 2.)
- **Ultimates are not aimed.** The stamp pad is one tap (PLAN §2.1); an ultimate marked *wsk.* or
  *kier.* places itself at the heart of the biggest crowd within its reach, or the way the hero
  faces when nobody is near (Ankieta, Skreślenie z mapy, Pomiar kontrolny, Zderzenie). Diablo 3's
  stamp-like ultimates are self-cast for the same reason; the aimed variant is the skill, not the
  ultimate.
- **Ultimate record 8 s** (`MAX_ULT_S`, DESIGN §10.2) wins over a longer table value (Uznanie
  osobowości § 2 is 8 s, not 12). A **summon left by an ultimate may outlive its record**
  (Pełnia § 3's two moons for 14 s): the ultimate is over, the moons are ordinary summons, as a
  Diablo 3 summon outlives the cast that made it.
- **A paragraph patches at most four fields and § 2 or § 3 carries a price** in the patch
  vocabulary (racja, cooldown, self-status): where a table cell listed more or priced nothing, the
  builder dropped the extra field (Granica § 3 stays 160 long) or added a cooldown price (Zmiana
  programu § 3).
- **Cooldowns where the table gave none** are the builder's (Pierścień 16, Upadek 12, Zmiana
  orbity 18, Pomiar 3 not 2.5). They move only through `npm run balance` (PLAN §8).
- **Specialization columns are a partition** of the ten skills (the Karta chart needs every
  skill in exactly one column); the overlapping sample loadouts above are what the columns are
  named after, not their contents. Capstones unchanged (S4).
- **The first five skills of every hero keep their S2 paragraphs** (names and numbers in the
  i18n files), which already differed from the tables before M4 (DESIGN §10.2 "decided 2026-10-19
  to match the built data"). Not re-synced; the Karta and the update form print the built text.
- **Paragraph descriptions are capped at 120 characters** (`paragraphs.test.ts`). A paragraph
  that needs more words needs fewer fields, not a longer line.
- **Rank-7 passive is the rule**, always on, never offered, printed on the Karta with its stamp
  (PLAN §7). Passives 8–10 are ordinary update-form entries; the four slots at 10/20/30/40 were struck
  (player, 2026-10-26, DESIGN §10.2).

### 6.2 Per-hero errata (kept as built)
- **Pralka**: Uznanie osobowości § 2 8 s, no summon bonus; Zmiana programu § 1 costs 10 racja at
  the cast, § 3 pays with a longer cooldown instead of being free; Tryb oszczędny counts hits
  double for Błąd programu as the table says.
- **Konsultant**: Formularz slows by *do weryfikacji*; Koniec kolejki pulls carriers of his
  status within **r 220** (the page-wide slot is Przekazanie do działu; one page-wide per hero),
  fewer than three carriers are topped up with the nearest, bosses never pulled; Ankieta placed
  by cluster; Przerwa techniczna on a tap steps away from the nearest enemy; Wstrzymanie opłat
  cuts the kiosk fee (base and in-run) up to 30% for the run.
- **Pętlowiec**: Opóźnienie hands the blow back inside the hit (never fatal: the payment floors
  at 1 racja), window and delay scale with duration; Zamiana miejsc with no copy does nothing and
  costs no cooldown (§ 2 swaps with the nearest non-boss enemy within 260); Cofnięcie zgłoszenia
  rewinds within the page only, never moves a boss, never lowers racja; Powtórzenie and Uwaga are
  not copy-castable (a copy would multiply its own lines); the copy's disagreement footnote fires
  2 s after his death (passive 7, text left unpromised on purpose).
- **Kartograf**: Pomiar cd 3; Przekrój § 3 lines stay 1.5 s with *do weryfikacji*; Granica § 3
  160 long; Punkt odniesienia: a **drag toward** the benchmark (within 25°) blinks Korekta to it
  from anywhere (a tap on it would be clamped to Korekta's reach); Skreślenie z mapy and Pomiar
  kontrolny placed by cluster, the latter three **rays** of 200 from the point, not full lines;
  Mapa z góry's wrong names are footnotes with a correction on death; Trzeci punkt counts the
  hits of Pomiar, Przekrój and Pomiar kontrolny only. **Open, not ratified**: SKILLS says "a line
  hit", and Triangulacja is his podstawowa line, so the *Pomiar* loadout (Triangulacja + Pomiar +
  Pomiar kontrolny, passive 10) loses a third of its hits; wire Triangulacja in S28 (one hook on
  its projectile path; the auto laser stays out, it is not a skill).
- **Naleśnik**: Krawędź § 3 slows by *do weryfikacji* 1 s; Zaokrąglenie's "−35% taken" is
  **+35 resist on all three types** (§ 2 +20; § 3 *w dół* −20 on all types while flat) because
  the engine has no flat damage-taken multiplier outside the shield; while flat a skimmed shot
  still **costs 1 racja** and is answered by Pory; Upadek is an instant hop; Zderzenie rolls
  toward the biggest crowd within 300 (else the way he faces), its stamp WPŁYNĘŁO lands beside
  him at the cast until S28 moves it to the end of the roll (player, 2026-10-26); Pełnia draws no
  margin diagram (the outer dotted ring stands for it); a Księżyc cast during Pełnia replaces one
  of its moons (same summon variant, `max: 1`); PEŁNIA stays a bare-noun stamp (player).

### 6.3 Naming settled here (voice applies at the next Voice: yes slice, S21a)
- Kartograf's **auto laser is "odczyt"** in every skill text (Skala, Mapa ostateczna, Punkt
  odniesienia, the laser footnote); **"Pomiar" is only the skill** (and Pomiar kontrolny). The
  S20 text uses "pomiar" for both and a player cannot tell which one pierces.
- Pad labels may be the button's word, not a noun ("Oszczędnie" is the programme button on the
  drum); skill names stay nouns (DESIGN §12.1).
- Damage *taken* is always "przyjmuje o N% mniej/więcej obrażeń"; damage *dealt* is "N uderzenia"
  (a multiplier of the weapon roll) or "obrażenia większe o N%" (DESIGN §12.1).
