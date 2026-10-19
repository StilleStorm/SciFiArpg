# Items proposal: bases, affixes, sets, legendary paragraphs, drops, economy

Status: PROPOSAL for discussion with the player (2026-10-18). Companion to `docs/PLAN.md` §3.3
and `docs/SKILLS.md`; when accepted, §2–§9 move into DESIGN §7 and §9.2 and §10 becomes builder
briefs. Everything below must be drawable in ink at phone size and nameable in the clerk's
register. Stat names as in `src/items/types.ts`: *siła argumentu* (dmgMin–dmgMax), *pewność
siebie* (pewnosc), *racja*, *upór*, *trafienie* (crit), *odporność* ×3 (mech, reg, egz),
*zasięg*, *tempo* (cooldownMul). Today: 19 bases, 17 affixes, 8 unwanted features, 6 uniques.

## 1. Item fantasy

1. A good drop is a plate with a number and a drawing, and the first thing you read is what
   other people said about it: "4,7 (88 opinii zweryfikowanych)". You believe it a little.
2. You equip it and the trial begins; ten kills later the Asystent corrects the register, usually
   by a little, sometimes with "Opinie nie znalazły potwierdzenia w użytkowaniu."
3. Then you read whether it gets along with what you already wear: two items that like each
   other sign a joint footnote; two that do not need an adapter, and the adapter has a price.
4. The five slots have roles. **Broń** decides the damage type, range and tempo and so which
   family you rebut easily. **Nakrycie głowy** is pewność and crit (the head decides). **Odzież**
   is racja and upór (the body endures). **Przyrząd** is the odd stat: a second small damage
   source, trial speed, gwiazdki, tempo. **Dokument** is odporność and the paper tags: it is the
   slot that argues with the planet's regulamin.
5. "Much, but not too many": 40 bases, ~32 affixes, 6 sets, 16 uniques. Variety comes from
   the register (names, reviews, footnotes), not from a thousand stat lines.

## 2. Bases: 40, eight per slot

Marked **(exists)** where already in `bases.ts`. Weapon ranges: melee ≤ 70, medium 90–130, long
≥ 150. Damage types cover 3 mech / 3 reg / 2 egz. Stats are level-1 zwykły; prices in gwiazdki.

### 2.1 Broń

| Base | Gender | Type · range · tempo | Register line | Drawing |
|---|---|---|---|---|
| pieczątka **(exists)** | f | reg · 70 · 1.1 | Stempel kauczukowy z rękojeścią. | handle, rubber block, ink pad line |
| odkurzacz **(exists)** | m | mech · 56 · 1.3 | Odkurzacz ręczny, bezprzewodowy, z końcówką szczelinową. | body, nozzle, three suction strokes |
| kabel **(exists)** | m | mech · 96 · 0.9 | Kabel (różny). Końcówki nie ustalono. | loop, two unlike plugs |
| czytnik **(exists)** | m | reg · 160 · 0.85 | Czytnik kodów, pistoletowy. | pistol grip, hatched window, dotted beam |
| wskaźnik **(exists)** | m | egz · 200 · 1.0 | Wskaźnik laserowy, zasięg deklarowany. | pen, dotted line to a small point |
| zszywacz | m | mech · 140 · 1.0 | Zszywacz biurowy, wyrzutowy. Zszywki w komplecie. | hinged wedge, two flying staples |
| segregator | m | reg · 110 · 1.2 | Segregator dźwigniowy, format A4, zawartość nieznana. | spine with two rings, label window |
| lupa | f | egz · 60 · 0.8 | Lupa biurowa, powiększenie nieuzasadnione. | ring on a handle, a magnified dotted beetle |

Egz gets two bases (melee and long) because today it has only the long one; a medium egz
weapon (*ankieta*, a thrown survey form) is the first candidate when the pool grows.

### 2.2 Nakrycie głowy

| Base | Gender | Stats | Register line | Drawing |
|---|---|---|---|---|
| kask **(exists)** | m | upór 8, racja 4 | Kask kurierski, z otworami. | dome, strap, three holes |
| słuchawki **(exists)** | pl | res egz 6, pewność 4 | Słuchawki nauszne, redukcja. | arc, two cups |
| czapka **(exists)** | f | racja 8, crit 1 | Czapka z daszkiem, promocyjna. | cap, hatched logo patch |
| okulary ochronne | pl | pewność 6, res mech 4 | Okulary ochronne, zgodne z normą. Normy nie podano. | two squares, side shields |
| daszek | m | crit 3, pewność 2 | Daszek przeciwsłoneczny, bez korony. | half-ring, flat brim |
| opaska | f | pewność 8 | Opaska na głowę z lampką czołową. Lampka nie świeci. | band, small circle at front |
| kaptur | m | res egz 8, racja 4 | Kaptur odpinany, odpięty. | hood outline, a loose thread |
| czepek | m | upór 4, res reg 6 | Czepek foliowy, jednorazowy, użyty wielokrotnie. | gathered circle, crinkle strokes |

### 2.3 Odzież

| Base | Gender | Stats | Register line | Drawing |
|---|---|---|---|---|
| kamizelka **(exists)** | f | upór 6, racja 12 | Kamizelka odblaskowa. | vest, two hatched stripes |
| fartuch **(exists)** | m | res mech 6, upór 6, racja 6 | Fartuch roboczy z kieszenią. | apron, one pocket |
| rękawiczki **(exists)** | pl | pewność 6, crit 2, upór 3 | Rękawiczki, para niekompletna. | two gloves, one with a hole |
| płaszcz | m | racja 16, res egz 4 | Płaszcz służbowy, dwurzędowy. | long coat, two rows of dots |
| koszulka | f | crit 2, racja 8, pewność 4 | Koszulka promocyjna, rozmiar uniwersalny. | tee with a hatched slogan box |
| kombinezon | m | upór 10, racja 10 | Kombinezon serwisowy z identyfikatorem. | one-piece, a chest badge |
| szelki | pl | upór 4, racja 6, res reg 4 | Szelki regulowane. Nieuregulowane. | two straps, four clips |
| marynarka | f | pewność 8, res reg 6 | Marynarka konsultanta, jeden guzik. | jacket, lapels, one button |

### 2.4 Przyrząd

| Base | Gender | Stats | Register line | Drawing |
|---|---|---|---|---|
| ładowarka **(exists)** | f | racja 10, crit 1 | Ładowarka sieciowa. | plug, cable, brick |
| dongle **(exists)** | m | pewność 10, res reg 4 | Dongle. Przeznaczenia nie ustalono. | small stick, one port |
| karta **(exists)** | f | crit 3, pewność 4 | Karta lojalnościowa. | card, nine stamp squares, two stamped |
| urządzenie **(exists)** | n | dmg 1–3, upór 4 | Urządzenie. | rectangle, a lens, a blinking dot |
| powerbank | m | racja 6, upór 6 | Powerbank, pojemność deklarowana. | box, four bar strokes, three filled |
| pilot | m | tempo −5%, pewność 4 | Pilot uniwersalny. Nie pasuje do niczego. | slab, grid of buttons |
| liczydło | n | gwiazdki +15%, pewność 4 | Liczydło. Nie wymaga aktualizacji. | frame, rows of beads |
| zegarek | m | trial speed +30%, crit 1 | Zegarek z krokomierzem. Kroki liczy cudze. | round face, one hand, a strap |

### 2.5 Dokument

| Base | Gender | Stats | Register line | Drawing |
|---|---|---|---|---|
| regulamin **(exists)** | m | res reg 10, upór 4 | Regulamin. Zaakceptowany. | stapled sheets, dense ruling |
| certyfikat **(exists)** | m | res egz 8, pewność 4 | Certyfikat. Wystawca nieznany. | sheet, a rosette, a signature |
| zrzut ekranu **(exists)** | m | res egz 10, crit 1 | Zrzut ekranu. Dowód. | framed rectangle, a cursor |
| zaświadczenie **(exists)** | n | res mech 6, racja 6 | Zaświadczenie o czymś. | sheet, a stamp circle |
| faktura | f | gwiazdki +10%, res reg 6 | Faktura VAT, termin płatności minął. | sheet, a totals box |
| paragon | m | crit 2, res mech 6 | Paragon, termograficzny, blaknie. | narrow strip, fading dots |
| polisa | f | racja 10, res mech 6 | Polisa. Wyłączenia na stronie 14. | sheet, umbrella glyph |
| upoważnienie | n | pewność 6, res reg 8 | Upoważnienie do czynności. Czynności nie wskazano. | sheet, a blank line, a signature |

Slot roles hold: nakrycie carries pewność/crit, odzież racja/upór, przyrząd odd stats, dokument
resists. Three new base stats appear (*tempo*, *gwiazdki*, *trial speed*) and are already
affix-able in §3, so `StatBlock` grows by three fields.

## 3. Affixes: a pool, not a list

### 3.1 Name grammar

`{noun} {adj₁} {adj₂} {phrase}, model «Model»`, with every part optional:

- Adjectives agree with the noun (`{m,f,n,pl}`) and follow it. **Two at most**, lower grade
  first ("pieczątka używana markowa").
- Phrase affixes (*w wersji darmowej*, *w wersji próbnej*, the unwanted features) go after the
  adjectives. **One phrase at most**, the unwanted feature not counted; it is appended last.
- The **model slot** holds the third random affix: every adjectival affix has a model token (a
  noun in «…»); a phrase affix never goes there. With three affixes the highest grade takes
  the slot, because the model name is what the register prints large: "segregator używany
  zweryfikowany, model «Marka»".
- A set piece puts the set name in the model slot; a unique has a hand-written name.

### 3.2 Families, tiers, magnitude

Each affix belongs to one **family** (one stat, or a fixed pair) and has a **grade** (1 any
tier, 2 from nietypowy, 3 from rzadki: as today). Its magnitude is the base effect times a
**tier I–V** multiplier, the tier tied to item level (§5):

| Tier | I | II | III | IV | V |
|---|---|---|---|---|---|
| Item level | 1–8 | 9–16 | 17–24 | 25–32 | 33–40 |
| Multiplier | ×1.0 | ×1.5 | ×2.0 | ×2.75 | ×3.5 |
| Register | – | (II) | (III) | (IV) | (V) printed after the model |

Roll: tier = band of the item level (70%) or one below (30%); never above. The tier roman
numeral is a tiny register mark, not part of the spoken name.

### 3.3 The pool (32)

Base effect at tier I. Slots: W = broń, N = nakrycie, O = odzież, P = przyrząd, D = dokument.
**New** marks additions; six **absurd** affixes carry a mechanic beyond the stat.

| Family | Affix | g | Base effect | Slots | Model | Note |
|---|---|---|---|---|---|---|
| siła | poleasingowy | 1 | dmg +1/+2 | W P | «Leasing» | |
| siła | **służbowy** | 2 | dmg +1/+3 | W | «Służba» | new |
| siła | nieuchronny | 2 | dmgMax +4 | W P | «Nieuchronność» | |
| siła | markowy | 3 | dmg +3/+5 | W P | «Marka» | |
| pewność | zweryfikowany | 1 | pewność +10 | all | «Weryfikacja» | |
| pewność | ewentualny | 2 | pewność +16 | all | «Ewentualność» | **absurd**: the stat is re-rolled on each page entry between 50% and 150%; the card shows "ok." before the number |
| pewność | oryginalny | 3 | pewność +12, upór +8 | all | «Oryginał» | |
| racja | odnowiony | 1 | racja +8 | all | «Renowacja» | |
| racja | **zapasowy** | 2 | racja +10, upór +3 | N O D | «Zapas» | new |
| racja | fabrycznie nowy | 3 | racja +22 | all | «Fabryka» | |
| upór | gwarancyjny | 1 | upór +6 | all | «Gwarancja» | |
| upór | **przemysłowy** | 2 | upór +10 | N O | «Przemysł» | new |
| upór | certyfikowany | 3 | upór +12, racja +10 | all | «Certyfikat» | |
| trafienie | **kolekcjonerski** | 2 | crit +4 | P D | «Kolekcja» | new |
| trafienie | sponsorowany | 2 | crit +3 | all | «Sponsor» | **absurd**: once per page an advertisement footnote (one line, flat), no other cost; the only way to meet the ad texts before a free version |
| trafienie | limitowany | 3 | crit +6 | all | «Edycja limitowana» | |
| odp. mech | używany | 1 | res mech +6 | all | «Drugi obieg» | |
| odp. mech | wzmocniony | 2 | res mech +6, racja +6 | all | «Wzmocnienie» | |
| odp. mech | **antywstrząsowy** | 3 | res mech +14 | N O | «Amortyzacja» | new |
| odp. reg | **podpisany** | 1 | res reg +5 | D | «Podpis» | new |
| odp. reg | zgodny z regulaminem | 2 | res reg +9 | all | «Regulamin» | |
| odp. reg | **zatwierdzony** | 3 | res reg +14, pewność +4 | D N | «Zatwierdzenie» | new |
| odp. egz | domniemany | 2 | res egz +9 | all | «Domniemanie» | **absurd**: the item is drawn in dotted line and has e = 0.8: one hit in five on the wearer ignores it entirely (its stats are not there) |
| odp. egz | **udokumentowany** | 3 | res egz +14 | D N | «Dokumentacja» | new |
| zasięg | **dalekosiężny** | 2 | range +15% | W | «Zasięg» | new |
| tempo | **serwisowy** | 1 | tempo −6% | W P | «Serwis» | new; "pieczątka serwisowa" at last |
| gwiazdki | **oceniany** | 1 | gwiazdki +12% | P D | «Ocena» | new |
| próba | **testowany** | 1 | trial −30% kills | all | «Test» | new |
| absurd | **w wersji próbnej** | 2 | +20% to every stat on the item | all | – | phrase; new; **absurd**: lasts two pages from first equip, then expires to zwykły numbers with the footnote "Okres próbny dobiegł końca." |
| absurd | **rzekomy** | 2 | pewność +12, crit +2 | all | «Pogłoska» | new; **absurd**: the trial never completes; the register keeps the claim forever and the Asystent adds "(wg relacji)"; the actual is honest ±10% |
| absurd | **wycofany z obiegu** | 3 | dmg +2/+4 or res +8 (by slot) | all | – | adjectival but phrase-position; new; **absurd**: cannot be sold, reclaimed or binned, only dropped; the Sklep refuses it by footnote |
| rare | w wersji darmowej | 3 | dmg +2/+4, pewność +14, crit +3 | all | – | phrase; weight 0, the rare channel (§6.4); −40% and ads after the trial, as built |

The eight **unwanted features** stay as they are (asystent głosowy, powiadomienia, ciasteczka,
konto obowiązkowe, inteligentny, chmura, spersonalizowany, tryb ciemny): one is added by the
*Wymagana aktualizacja* clause, never rolled, never counted, footnote "Nowość!".

### 3.4 Roll rules

| Tier | Affixes | Grades allowed | Likes/dislikes | Trial kills |
|---|---|---|---|---|
| zwykły | 0–1 (40% none) | 1 | – | 5 |
| nietypowy | 1–2 | 1–2 | – | 10 |
| rzadki | 2–3 | 1–3 (at least one g2+) | one each | 15 |
| zestaw | 2 fixed + 1 random g1–2 | – | the set's like, fixed | 12 |
| unikatowy | hand-written | – | hand-written | none |

Exclusions: one affix per family per item; the three resist families together at most two;
one absurd affix per item; *w wersji darmowej* replaces one rolled affix and is never rolled
by weight (§6.4); *rzekomy* and *testowany* exclude each other; *w wersji próbnej* never on
zestaw. Slot gates are in the table; a family absent from a slot means that slot never argues
about it (no range on a hat). The weight of a g3 affix halves on zwykły-tier bases bought in the
Sklep, so shop stock reads plainer than drops.

## 4. Tiers and quality

Tiers: **zwykły, nietypowy, rzadki, zestaw, unikatowy**. Zestaw sits between rzadki and
unikatowy: fixed base, fixed like tag, two fixed affixes, one random, reviews as any item.

### 4.1 Sets (zestawy)

Built on the existing compatibility likes: each set owns one tag; its pieces like that tag, so
a set piece also signs the small zestaw footnote with any rzadki that likes the same tag. The
named bonus needs two or three pieces of the same set. Bonuses change a skill or a paragraph,
as PLAN §3.3 asks; cross-hero where one sentence covers all five.

| Set | Tag | Pieces (base) | 2 pieces | 3 pieces |
|---|---|---|---|---|
| «Obieg dokumentów» | papier | segregator, fartuch, upoważnienie | res reg +12, pewność +8 | every rebuttal of a regulaminowy claim also stamps **zgłoszony** 2 s (cross-hero) |
| «Ostatnia mila» | metal | kask, kamizelka, powerbank | upór +10, speed +8% | the lvl 3 mobility gets more: Odwirowanie drags +1, Przerwa techniczna steps 160, Pętla returns to 4 s ago, Korekta's decoy +2 s, Orbita +1 bounce |
| «Serwis» | porządek | zszywacz, rękawiczki, pilot | tempo −8% | a crit on the podstawowa resets its cooldown (once per 2 s; cross-hero) |
| «Infolinia» | hałas | słuchawki, koszulka, zegarek | crit +4, res egz +6 | one skill per hero: Wirowanie pull +50%; Muzyka w słuchawce r 180; Uwaga na marginesie copies +1 remark; Pomiar cd 2; Księżyc +1 moon |
| «Domniemanie» | wątpliwość | lupa, okulary ochronne, certyfikat | res egz +10, Wygenerowane hit e −0.1 | the first egzystencjalny hit on each enemy per page applies **do weryfikacji** 1 s (cross-hero) |
| «Awaria» | chaos | kabel, kaptur, paragon | dmg +2/+4; every stat of the set re-rolls ±15% on page entry | the hero's rule passive doubles: Błąd programu every 5th hit; trials ×3; the death copy friendly 20 s; the wrong name also slows the misnamed 20%; Naleśnik flat above 80% and round below half |

Joint footnotes (the register voice, one per set, printed when the second piece is equipped):
«Obieg»: "Dokumenty krążą zgodnie z procedurą. Procedura krąży z dokumentami." «Ostatnia
mila»: "Przesyłka doręczona. Odbiorca w drodze." «Serwis»: "Usterkę usunięto. Usterki nie
stwierdzono." «Infolinia»: "Rozmowa jest nagrywana. Nagranie zostało rozłączone." «Domniemanie»:
"Zestaw istnieje według 87% użytkowników. Pozostali nie zostali zapytani." «Awaria»: "Zestaw
działa. Przyczyny nie ustalono."

### 4.2 Legendary paragraphs (uniques)

Keep the six existing uniques (Pieczątka «Odmowa», Kabel (różny), egzemplarz jedyny, Regulamin,
wersja ostateczna (3), Kask Ostatniej Mili, Słuchawki z redukcją rzeczywistości, Zaświadczenie
o istnieniu) with stats only; they predate paragraphs and stay as the "plain" uniques, a third
of the pool. Ten new uniques each carry **one paragraph of one skill** of one hero, active while
equipped and usable without unlocking that paragraph (the skill itself must be unlocked; on a
different hero the item is stats only with the footnote "Paragraf nie dotyczy zgłaszającego").
The paragraph is printed on the card as a § with a red underline. Stats are hand-written,
roughly rzadki budget plus 20%.

| Unique | Base | Hero · skill · § | Story (register) |
|---|---|---|---|
| Pilot «Program 95°» | pilot | Pralka · Program 90° · § 3 *gotowanie* | Pilot do pralki, której nie wyprodukowano. Przycisk 95° działa; pozostałe przyciski komentują. Instrukcja zaleca nie opuszczać pomieszczenia. |
| Kombinezon «Pralnia Zakładowa» | kombinezon | Pralka · Pełny cykl · § 2 *delikatny* | Egzemplarz z zakładu, który zamknięto za cykl. Identyfikator wskazuje numer, nie osobę. Delikatność jest wymogiem BHP. |
| Zegarek «Szacowany czas oczekiwania» | zegarek | Konsultant · Proszę czekać · § 3 *czas wydłużony* | Zegarek wskazuje czas oczekiwania zamiast godziny. Czas oczekiwania rośnie. Zegarek jest punktualny. |
| Daszek «Dział windykacji» | daszek | Konsultant · Rozłączenie · § 3 *formalne* | Daszek z działu, do którego się nie dzwoni; on dzwoni. Rozłączenie następuje bez podniesienia głosu. Korony nie przewidziano. |
| Faktura «Wystawiona przed wykonaniem usługi» | faktura | Pętlowiec · Opóźnienie · § 3 *z winy nadawcy* | Faktura obejmuje usługę, która jeszcze nie nastąpiła. Termin płatności minął wczoraj. Odsetki nalicza się nadawcy. |
| Szelki «Zapasowe» | szelki | Pętlowiec · Przybycie przed wyjazdem · § 2 *wcześniejsze* | Szelki dla dwóch osób naraz, obu tych samych. Jedna para klamer jest z przyszłego tygodnia. Reklamacji nie uwzględniono, bo jeszcze nie wpłynęła. |
| Wskaźnik «Granica państwowa» | wskaźnik | Kartograf · Granica · § 3 *państwowa* | Wskaźnik wyznacza granicę państwa, którego nie wpisano do rejestru. Granica jest strzeżona. Państwo nie. |
| Polisa «Od błędu pomiaru» | polisa | Kartograf · Korekta · § 2 *z erratą* | Polisa obejmuje błędy pomiaru i ich skutki. Wyłączenia obejmują pomiary. Errata jest załącznikiem i wybucha. |
| Liczydło «Masa planety» | liczydło | Naleśnik · Grawitacja własna · § 2 *silniejsza* | Liczydło liczy masę ciała, które je nosi. Wynik rośnie z każdym użyciem. Koraliki nie dają się odsunąć. |
| Czepek «Atmosfera szczątkowa» | czepek | Naleśnik · Zaokrąglenie · § 3 *w dół* | Czepek foliowy utrzymuje atmosferę o grubości jednej warstwy. Pociski ślizgają się po niej zgodnie z fizyką. Fizyka nie została poinformowana. |

Rule for the next ten (one per hero per planet later): a unique's paragraph is always an
existing § 2 or § 3 from SKILLS.md, never a fourth variant, so a unique never adds behaviour
the paragraph system does not already own.

## 5. Item level and scaling

### 5.1 Item level

`ilvl = 5·(planet − 1) + 1 + page offset (0–2, boss +2) + priority bonus`, capped at 40.
Priority bonus: Niski −2, Normalny 0, Wysoki +3, Krytyczny +6. So planet 1 Normalny drops
ilvl 1–5, planet 5 Krytyczny up to 32, planet 8 Krytyczny reaches 40. Zgłoszenia dodatkowe
(post-campaign) use a chosen planet index. The Sklep stocks the planet's band at page offset 1.

### 5.2 Budgets

All stats scale as today: `×(1 + 0.06·(ilvl − 1))` on the base stats; affixes add their tiered
effect. Tier multiplies the base stats before affixes:

| Tier | Base ×  | Affix sum (tier I, typical) | Effective budget vs zwykły |
|---|---|---|---|
| zwykły | 1.00 | 0–8 | 1.0 |
| nietypowy | 1.10 | 10–22 | ~1.6 |
| rzadki | 1.20 | 24–40 + tags | ~2.4 |
| zestaw | 1.20 | 2 fixed + 1 random + set bonus | ~2.6 (+ bonus) |
| unikatowy | hand-written | – | ~2.9 |

Uniques are the ceiling but not by much: a rzadki with the right families beats a wrong unique.

### 5.3 Reviews against budgets

Reviews are claims; trials reveal the truth. Keep 80 / 15 / 5: honest (±10%), **opinie kupione**
(worse), **niedoceniony** (better). The budget above is the **actual**. A liar's claim is the
actual inflated by a magnitude that grows with tier, because more opinions buy a bigger lie:

| Tier | Opinie kupione (claim over actual) | Niedoceniony (actual over claim) | Opinions printed |
|---|---|---|---|
| zwykły | +15% | +10% | 3–40 |
| nietypowy | +25% | +15% | 40–200 |
| rzadki | +35% | +20% | 200–900 |
| zestaw | +25% | +15% | 100–400 |
| unikatowy | no reviews | – | "Opinie nie były weryfikowane." |

The lie is one multiplier on every stat line, so the card still reads as one item. The register
prints "4,9" for liars and "3,6" for undervalued ones: a hint, never a proof. Reklamacja (§7.3)
prints its new line honest; the kiosk cannot lie about what it just did.

## 6. Drops

### 6.1 By family and rank

Per kill: chance of an item, then tier weights (%). Priority shifts weights one column to the
right on Wysoki (10% of rolls) and Krytyczny (25%); Niski shifts left (20%).

| Family | Rank | Item chance | zw / nt / rz / zestaw / un | Slot skew | Tag skew |
|---|---|---|---|---|---|
| any | common | 12% | 75 / 22 / 3 / 0 / 0 | by family | by family |
| any | elite | 100% ×1 | 35 / 45 / 17 / 2 / 1 | by family | by family |
| any | page boss (Prototyp, Weryfikacja, Hipoteza) | ×3 | one rzadki guaranteed; others 20 / 50 / 25 / 4 / 1 | – | – |
| Urządzenia | – | – | – | przyrząd, broń mech | metal, hałas |
| Powiadomienia | – | – | – | dokument, nakrycie | papier, chaos |
| Wygenerowane | – | – | – | odzież, broń egz | wątpliwość, porządek |

Slot skew: 40% of the family's two slots, 60% any. Tag skew: a rzadki from that family likes
one of its two tags 70% of the time, so the dominant family makes its set tag easier to
complete there. Pętla copies drop one of your own items, as built.

### 6.2 The Komisja's bosses

A planet boss (one per planet, PLAN §3.4) drops 3 items plus 25–35 gwiazdki: **one rzadki
guaranteed, 35% a zestaw piece of the planet's set** (a planet hosts at most one set, §12.6, so
sets are farmable by replaying a ticket; a planet without a set rolls that 35% as a rzadki),
**12% a unique**; Krytyczny doubles both. The final ticket's
boss drops one unique guaranteed, from those not yet archived. Winning the Spór adds one tier
to the best drop ("Komisja przychyliła się").

### 6.3 Permission cards

Permissions (DESIGN §8) are cards in the bag with no slot. An elite of the family drops its
card 20% if not owned, a page boss of the family 100%, a planet boss the dominant family's
100%. Cards never go through przesyłka.

### 6.4 Przesyłka: the rare channel

Every zestaw piece and unique from a common or elite enemy arrives as a **delivery notice**
(awizo), max one per page; a rzadki 30% of the time. Boss drops never do (the Komisja hands
over in person). *W wersji darmowej* appears only through przesyłka: 10% of delivered rzadki,
which is where its weight 0 gets its channel. The code arrives as an SMS footnote 6–12 s later
as built; an awizo not collected before the page turns goes to the base paczkomat (§8).

### 6.5 Gwiazdki

| Source | Amount | Chance |
|---|---|---|
| common kill | 1–2 | 60% |
| elite | 5–8 | 100% |
| page boss | 12–18 | 100% |
| planet boss | 25–35 | 100% |
| Konsultant's Czy mogę jeszcze w czymś pomóc | 1 per kill | by skill |

Priority multiplier on all amounts: Niski ×0.8, Normalny ×1, Wysoki ×1.3, Krytyczny ×1.6.

## 7. Economy

### 7.1 Sklep stock

Per planet the Sklep (base, and in-run during office hours) stocks **6 plates**: 3 zwykły or
nietypowy of the planet's band (different slots), 1 rzadki, 1 **oferta** (10% a zestaw piece of
the planet's set, else a rzadki with a g3 affix), 1 **adapter**. Stock re-rolls on planet change
and after the store "updates" (three reports). Price: `price₁ × (1 + 0.1·ilvl) × tier`, tier
zwykły ×1, nietypowy ×2.5, rzadki ×6, zestaw ×10; uniques are never sold. Prices exclude the
**opłata serwisowa** (+20% at checkout), as built. The vendor lies about 1 in 6; after three
"Zgłoś problem" the rate becomes 1 in 4 or 1 in 10 at random, announced as "Poprawki błędów i
usprawnienia."

### 7.2 Buying

Selling: the Sklep buys at 20% of list, never a wycofany z obiegu item. Adapter: 15 × tier of the
newer item; permanent for that pair. Buying out a free version: 3 × the item's list price;
removes the ads and restores the actual to claim −10% ("Wersja premium. Funkcje przywrócono w
zakresie podstawowym.").

### 7.3 Reklamacja (the star sink)

At the kiosk (base or office hours) one affix of one item is re-rolled: same grade, any family
the slot allows, exclusions as §3.4, tier re-rolled in the band. No choice, one result; the old
line is struck through on the card and the new one typed under it. **Once per item per
planet.** Cost: `10 × tier × (1 + 0.5 × times reclaimed on this item)`, tier as in §7.1, so a
rzadki costs 60, then 90, then 120 across three planets. Uniques and the fixed lines of set
pieces cannot be reclaimed; a set piece's random line can. The Asystent reacts in a footnote:
first time "Reklamacja uwzględniona. Wady nie stwierdzono."; on a lying item "Reklamację
uwzględniono w całości. Opinie pozostają w mocy."; on the third reclaim of one item "Przedmiot
był reklamowany trzykrotnie. Zgłaszającego odnotowano." Each reclaim adds one printed opinion.

### 7.4 Sinks and sources (per planet, Normalny, rough)

| Sources | ≈ gwiazdki | Sinks | ≈ gwiazdki |
|---|---|---|---|
| 60 common kills | 55 | one Reklamacja on a rzadki | 60–120 |
| 6 elites | 40 | one nietypowy from the Sklep (with fee) | 30–60 |
| 4 page bosses | 60 | one adapter | 15–90 |
| planet boss | 30 | buying out a free version | 100–200 |
| bin returns (§8.3) | 15 | paczkomat pickup at base | 15 |
| **total** | **~200** | one of the above per planet plus small change | **~200** |

A player who reclaims every planet buys nothing; one who shops never reclaims. Both are fine.
Krytyczny priority gives ×1.6 and the prices do not move, which is the reward for difficulty.

## 8. Inventory and stash

- **Bag**: 20 slots in a run as today (*Załączniki*). Cards (permissions, awizo) take slots.
- **Archiwum**: a card-index drawer at the base desk, **40 slots, shared across heroes**,
  because uniques with another hero's paragraph are worth keeping and a per-hero stash would
  make them junk; the card footnotes which hero the paragraph concerns. Grows to 60 with a
  zaświadczenie later. Drawn as a drawer with tabs.
- **Compare**: the two-column table with red deltas as built, against the equipped item of the
  slot; a set piece adds the line "Elementy zestawu: 1 z 3".
- **Sort** (one button, cycles): slot, tier, ilvl (default); ilvl; newest. Equipped first;
  set pieces together.
- **Junk**: in a run **Upuść** leaves the item on the page, drawn, retrievable. At base or in
  the bag **Odrzuć do kosza** removes it for 10% of list in gwiazdki, no fee; rzadki and up ask
  once on a one-line form. Wycofany z obiegu can only be dropped. A binned unique is noted:
  "Egzemplarz zniszczono. Komisja nie zgłosiła sprzeciwu."
- **Przesyłka cards**: an awizo is a card plate with the paczkomat's page number and a hatched
  barcode; collected in-run it becomes the item in place. Uncollected at run end it goes to the
  base paczkomat (a column by the desk), pickup 15 gwiazdki; after two runs uncollected it is
  "zwrócona do nadawcy" and the Asystent regrets it.

## 9. Drawing system

Each base keeps its one ink drawing. Tier and a few affixes add **marks**: small separate
groups drawn over the base at a fixed corner, the same path data at two scales, so a plate
reads on the ground (tiny) and on the card (large). No gradients, no glow, red only where listed.

| Reads as | Mark | Where | Ink |
|---|---|---|---|
| nietypowy | a small round stamp mark with a tick | top-right corner | black |
| rzadki | one thread tied around the drawing, a knot and two loose ends | around | black (ruled S8: DESIGN §3 keeps red for stamps, strikes, Racja, corrections) |
| zestaw | a paperclip on the top edge | top-left | black |
| unikatowy | a wax seal: a filled black circle with a hatched impress and a short ribbon | bottom-right | black, a single red dot in the centre |
| zwykły | none | – | – |

Affix marks (at most one per item on the ground, all on the card; priority: absurd first, then
the rare):

| Affix | Mark |
|---|---|
| domniemany | the whole base drawing redrawn in dotted stroke |
| ewentualny | a small "ok." in Space Mono beside the number |
| sponsorowany | a tiny strip labelled REKLAMA glued across the drawing's corner |
| w wersji próbnej | a calendar tab with two days crossed, one left |
| rzekomy | a footnote marker ¹ drawn beside the plate, pointing at nothing |
| wycofany z obiegu | a diagonal strike through the plate's number, not the drawing |
| w wersji darmowej | the REKLAMA strip plus a small padlock |
| unwanted feature | a tiny flag tag "Nowość" on the top edge |

The tier mark is never omitted; the affix mark only where the plate is large (card, Sklep,
Archiwum). Paperclip and thread never meet, since a set piece is not rzadki. Night edition
inverts as the rest.

## 10. Slices (in order, each one builder brief)

Superseded by docs/PRODUCTION.md: (a) + (b) + (d) shipped as S8, (c) as S9 (przesyłka left as a
SEAM), (e) is S17, (f) is S18 (the Archiwum part shipped in S6). Kept for the record.

1. **(a) Affix pool, tiers, roll rules, names.** `affixes.ts` gains family, tier, model token,
   absurd mechanics; `generate.ts` the band and exclusions; `grammar.ts` the model slot and the
   two-adjective rule; i18n forms for 15 new affixes; tests on names and exclusions. Unblocks
   everything.
2. **(b) Bases to 40 with drawings.** `bases.ts`, `itemDrawings.ts`, i18n nouns and register
   lines; three new StatBlock fields (tempo, gwiazdki, trial speed) wired in. Shots of all 40.
3. **(c) Item level, drops, Sklep stock.** ilvl formula (planet index and priority from PLAN
   slice 6, or a stub), drop tables, przesyłka as the rare channel, gwiazdki, stock and prices.
   Tests on the weights.
4. **(d) Drawing marks.** Tier and affix marks on ground plates and cards; shots. Placed here
   so sets and uniques land already drawable.
5. **(e) Sets and legendary paragraphs.** Needs the paragraph system (PLAN slice 2) and (c).
   `sets.ts`, 6 sets with footnotes and bonuses, 10 uniques with paragraph references, the
   "Paragraf nie dotyczy zgłaszającego" rule; a test that every bonus patches an existing id.
6. **(f) Reklamacja, Archiwum, sinks.** The kiosk form with the cost curve and the per-planet
   lock, the Archiwum drawer, Odrzuć do kosza, awizo cards and the base paczkomat, buying out
   free versions; save schema bump; smoke test.

Each slice ends with `npm run check`, shots of the touched screens and a voice pass on new keys.

## 11. Open questions for the player

1. Sets farmable by replaying a planet (each planet hosts one set, my pick) or spread across
   all planets so a set completes only late in the campaign?
2. A unique's paragraph: active only if the skill is unlocked (my pick), or does the item also
   lend the skill itself until it is unlocked, as a "użyczenie"?
3. Archiwum shared across heroes (my pick, because of cross-hero uniques) or per hero, with a
   smaller shared drawer for uniques only?
4. Reklamacja with no choice (one result, struck and retyped) or Diablo-style two results to
   pick from at a higher price?
5. Lie magnitude growing with tier (rzadki liars at +35%) or flat 20% everywhere, simpler to
   read on the card?

## 12. Decisions (player, 2026-10-18)
1. **Sets:** one set per planet; replaying a planet farms it.
2. **Uniques, Diablo 2 style:** a unique gives +1 or +2 ranks to its skill; ranks from items may
   exceed the cap; wearing it unlocks that skill even with no own ranks; it also carries the
   paragraph. "Użyczenie" is therefore the rule, not the exception.
3. **Archiwum:** one shared Archiwum across characters (transfers), plus each character's own
   bag and personal archive. Depends on the character roster (below).
4. **Reklamacja:** one result, struck and retyped. No pick of two.
5. **Lies grow with tier:** +15 / +25 / +35% overclaim for zwykły / nietypowy / rzadki.

Added at the M2 plan review (story agent; the player may overrule at the M3 playtest):
6. **Six sets, nine planets:** the first planet of each act hosts no set (1, 4, 7); the rest host
   one each: 2 «Obieg dokumentów», 3 «Serwis», 5 «Ostatnia mila» (the shopping-app planet), 6
   «Infolinia», 8 «Domniemanie», 9 «Awaria». S17 sets the `hostedSet` column accordingly (the S7
   data has planets 1, 5, 7 empty; planet 4 moves to 5).
7. **Items as side-ticket rewards** are never handed over at the board: the Komisja sends them,
   so the reward is an awizo at the base paczkomat (§6.4, §8), built in S18. Until then side
   tickets pay stars, permission cards and potwierdzenia (STORY §5).
8. **Red is not a tier mark** (ruled at the S8 gate): the rzadki thread is black; the wax seal's
   red dot stays because a seal impress is a stamp (§9 already updated).
