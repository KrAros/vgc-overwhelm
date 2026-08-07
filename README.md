# The Sixth Ember

Calcolatore di danno per **Pokémon Champions** — formato VGC doppi, livello 50,
sistema SP.

> *An Italian-language repository. The application itself ships in English and
> Italian; the code comments, docs and commit messages are Italian.*

Il motore è verificato contro il [NCP VGC Damage Calculator][ncp], eseguito
davvero come oracolo e non citato a memoria: 509 configurazioni della formula e
27 dello stato di partenza producono gli stessi numeri del riferimento.

[ncp]: https://github.com/nerd-of-now/NCP-VGC-Damage-Calculator

---

## Avvio

Serve **Node 20.19+, 22.13+ o 24+** — è l'intersezione di quello che chiedono
Vite 8 (`^20.19.0 || >=22.12.0`) ed ESLint 10 (`^20.19.0 || ^22.13.0 || >=24`).
Sviluppato e verificato su **Node 24.18.0 · npm 11.16.0**.

```bash
npm install
npm run dev        # server di sviluppo
npm run build      # bundle di produzione in dist/
npm run preview    # serve dist/ per controllarlo
```

Non c'è niente da configurare: nessuna variabile d'ambiente, nessun servizio
esterno, nessuna chiave. I dati di gioco sono file JSON nel repo.

---

## Cos'è

Un calcolatore pensato per i doppi, non un calcolatore per singoli adattato.
La differenza si vede nella schermata principale: invece di un risultato per
volta, mostra la **matrice** delle interazioni fra le due squadre — ogni
attaccante contro ogni difensore, nei due sensi, con il meteo, il campo, gli
schermi e le priorità già applicati.

- Formula di Champions con il sistema **SP** al posto degli EV
- Probabilità di KO cumulativa calcolata in programmazione dinamica, danno da
  fine turno incluso
- Import ed export in formato Showdown, link condivisibili che portano con sé
  squadre **e** campo
- Preset dal meta competitivo, set personalizzati, libreria di squadre in locale
- Interfaccia in italiano e inglese

Quello che il motore **non** modella porta un badge visibile nell'interfaccia:
114 abilità e 41 strumenti sono dichiarati non calcolati anziché essere
calcolati male in silenzio.

---

## La rete di sicurezza

```bash
npm run test:run        # la suite
npm run snapshot:diff   # deve essere a zero prima di ogni merge
npm run matrice:report
npm run ncp:report      # confronto con l'oracolo NCP
```

Numeri letti dall'esecuzione, non dichiarati a memoria:

| | Copre | Entra da |
|---|---|---|
| **1727 test** su 24 file<br><small>1726 verdi · 1 saltato</small> | — | — |
| **584 casi** di caratterizzazione formula | che il motore non cambi numeri per sbaglio | `calculateDamage` |
| **180 celle** di caratterizzazione matrice<br><small>5 scenari</small> | la logica di `DamageTable` | il componente |
| **509 golden** dal riferimento | la formula contro NCP | `GET_DAMAGE_SV` |
| **27 golden** di preparazione | Intimidate, abilità paradosso, Spada e Scudo, Download | `CALCULATE_ALL_MOVES_SV` |

**Il confine dell'oracolo è dichiarato di proposito.** «Verificato contro il
riferimento» è vero fino a dove l'harness entra, e i due ingressi coprono cose
diverse: la formula da sola non applica lo stato di partenza. Un caso con
Intimidate confrontato all'ingresso basso diverge *per costruzione*, e non è un
bug — è l'ingresso sbagliato. Per questo gli oracoli sono due.

Le fixture committate in `src/__tests__/fixtures/` sono la fotografia buona.
`ncp:gen`, `snapshot:gen` e `matrice:gen` le **riscrivono**: si lanciano
apposta, guardando il diff caso per caso, mai per far tornare verde una suite.
I comandi `*:report` invece non scrivono niente.

---

## Architettura

```
src/lib/rules.js         costanti di gioco — fonte unica
src/lib/stats.js         calcolo statistiche — fonte unica
src/lib/modifiers.js     pokeRound, chainMods, virgola fissa
src/calcEngine.js        la formula — quattro catene concatenate
src/lib/preparazione.js  stato di partenza prima del danno
src/lib/battleState.js   costruzione unica di attaccante, difensore, campo
src/lib/damage.js        KO, danno da fine turno, KO cumulativo in DP
src/lib/matrice.js       le 72 interazioni come funzione pura
src/utils/               ordine di velocità, import/export Showdown, sprite
src/components/          interfaccia — non calcola, consuma risultati
src/data/                dati di gioco in JSON
vendor/ncp/              il riferimento, vendorizzato e congelato
scripts/                 generatori di fixture e harness dell'oracolo
```

L'aritmetica sta in `src/lib/` e in `calcEngine.js`, ed è pura: nessun
componente calcola danno. `vendor/ncp/` non viene importato da una sola riga di
`src/`, quindi non entra mai nel bundle — c'è un test che lo verifica.

Bundle misurato sull'ultima build (`96 moduli, 712 ms`):

| chunk | grezzo | gzip |
|---|---|---|
| `dati` | 390,45 kB | 93,21 kB |
| `vendor` | 239,00 kB | 75,55 kB |
| `index` | 149,08 kB | 40,26 kB |
| `it` | 63,41 kB | 24,45 kB |
| runtime | 0,56 kB | 0,36 kB |

Un visitatore inglese scarica **209,38 kB** di JavaScript compresso — somma
fatta a mano, `it` escluso perché lo prende solo chi passa all'italiano.

---

## Contribuire

Le regole stanno in **[CONTRIBUTING.md](CONTRIBUTING.md)**, e non sono
decorative: questo repository ha una disciplina di verifica scritta in
[CLAUDE.md](CLAUDE.md) che nasce da dodici sessioni di risanamento e da una
lista di errori realmente commessi. Vale la pena leggerla prima di aprire una PR.

I lavori che servono di più e costano poco a chi arriva: preset del meta,
traduzioni, e le abilità che oggi portano il badge «non calcolata».

---

## Provenienza e contenuti di terzi

**Il riferimento.** `vendor/ncp/` contiene nove file del
[NCP VGC Damage Calculator][ncp], copiati byte per byte dal commit `7919130` e
lasciati intatti. Sono licenziati **MIT** — copyright 2013-2021 Honko, Tapin,
Firestorm, Jake White (squirrelboyVGC), nerd-of-now e altri contributori — e la
licenza originale è conservata in `vendor/ncp/LICENSE`. Servono solo ai test per
generare i numeri attesi: **non fanno parte dell'applicazione** e non sono
coperti dalla licenza di questo progetto.

**Gli sprite non sono nel repository.** Icone dei Pokémon e degli strumenti sono
caricate a runtime da `resource.pokemon-home.com` e `assets.pokemon-zone.com`;
tre icone di categoria da `i.pokebase.app`. Questo progetto non le ridistribuisce
e non ne rivendica alcun diritto.

**I dati di gioco** in `src/data/` — statistiche base, tipi, potenze, pesi — sono
fatti sul funzionamento di Champions, raccolti per l'interoperabilità. Nomi di
Pokémon, mosse, abilità e strumenti sono marchi dei rispettivi proprietari.

---

## Licenza

Il codice di questo progetto è distribuito sotto **GNU Affero General Public
License v3.0 o successiva**. Il testo integrale è in [LICENSE](LICENSE).

```
Copyright (C) 2026 KrAros

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
```

In pratica: puoi usarlo, studiarlo, modificarlo e ridistribuirlo. Se ne pubblichi
una versione modificata **come servizio in rete**, devi renderne disponibile il
sorgente agli utenti. L'eccezione dichiarata sopra vale per `vendor/ncp/`, che
resta MIT dei suoi autori.

---

Progetto amatoriale, non affiliato a Nintendo, Game Freak o The Pokémon Company.
Pokémon e tutti i nomi correlati sono marchi dei rispettivi proprietari.
