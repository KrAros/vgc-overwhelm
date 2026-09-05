# The Sixth Ember

Calcolatore di danno per **Pokémon Champions** — formato VGC doppi, livello 50,
sistema SP.

> *An Italian-language repository. The application itself ships in English and
> Italian; the code comments, docs and commit messages are Italian.*

Il motore è verificato contro il [NCP VGC Damage Calculator][ncp], eseguito
davvero come oracolo e non citato a memoria: 519 configurazioni della formula e
35 dello stato di partenza producono gli stessi numeri del riferimento.

[ncp]: https://github.com/nerd-of-now/NCP-VGC-Damage-Calculator

---

## Dove vive

Il sito sta su **https://kraros.github.io/vgc-overwhelm/**, pubblicato
automaticamente a ogni push su `modern` — ma **solo se lint, suite completa e
`snapshot:diff` passano**. Il workflow è in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): se la verifica
fallisce, online resta la versione di prima.

Il percorso `/vgc-overwhelm/` è dichiarato come `base` in `vite.config.js` e
vale anche in sviluppo, così l'indirizzo locale ha la stessa forma di quello
pubblicato.

---

## Avvio

Serve **Node 20.19+, 22.13+ o 24+** — è l'intersezione di quello che chiedono
Vite 8 (`^20.19.0 || >=22.12.0`) ed ESLint 10 (`^20.19.0 || ^22.13.0 || >=24`).
Sviluppato e verificato su **Node 24.18.0 · npm 11.16.0**.

```bash
npm install
npm run dev        # server di sviluppo, su /vgc-overwhelm/
npm run dev -- --host   # anche dagli altri dispositivi della rete locale
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
109 abilità e 40 strumenti sono dichiarati non calcolati anziché essere
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
| **1876 test** su 30 file<br><small>1875 verdi · 1 saltato</small> | — | — |
| **586 casi** di caratterizzazione formula | che il motore non cambi numeri per sbaglio | `calculateDamage` |
| **180 celle** di caratterizzazione matrice<br><small>5 scenari</small> | la logica di `DamageTable` | il componente |
| **519 golden** dal riferimento | la formula contro NCP | `GET_DAMAGE_SV` |
| **35 golden** di preparazione | Intimidate dai due lati, abilità paradosso, Spada e Scudo, Download | `CALCULATE_ALL_MOVES_SV` |

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

Bundle misurato sull'ultima build (`100 moduli`):

| chunk | grezzo | gzip |
|---|---|---|
| `dati` | 344,03 kB | 89,78 kB |
| `vendor` | 239,01 kB | 74,69 kB |
| `index` | 150,76 kB | 40,38 kB |
| `it` | 64,73 kB | 24,54 kB |
| runtime | 0,57 kB | 0,36 kB |

Un visitatore inglese scarica **205,21 kB** di JavaScript compresso, `it`
escluso perché lo prende solo chi passa all'italiano. La somma non è più fatta
a mano: la stampa `npm run bundle:report`, e `npm run bundle:check` fallisce
sopra i 210 kB.

<small>**Il metodo, che prima mancava.** Questa tabella ha dichiarato a lungo
211,86 kB — cioè un numero già sopra la soglia della sessione E — e il README
si difendeva osservando che `gzip -c` dava 206,54 sugli stessi file, quindi che
«un criterio numerico senza il metodo di misura non ha un verdetto».

L'osservazione era giusta e la difesa no. Rimisurato: sforavano **tutti** i
metodi — 212,56 kB con gzip predefinito, 213,79 secondo la riga che stampa
Vite. Il verdetto era lo stesso da qualunque parte lo si guardasse; mancava
solo qualcuno che lo pronunciasse.

Adesso il metodo è scritto in `scripts/misura-bundle.mjs`: si pesano i file JS
che `dist/index.html` fa scaricare subito — modulo d'ingresso più i
`modulepreload` — con `zlib.gzipSync` a livello predefinito, sommati, kB da
1000 byte. Gli altri strumenti restano entro un kB da questo numero, e il
margine sotto la soglia è quasi cinque: il verdetto non cambia con lo
strumento.

Il calo da 212,56 a 205,21 viene dalla potatura dei campi che `src/` non legge
(`scripts/potatura-dati.mjs`), non da codice tolto.</small>

---

## Contribuire

Le regole stanno in **[CONTRIBUTING.md](CONTRIBUTING.md)**, e non sono
decorative: questo repository ha una disciplina di verifica nata da dodici
sessioni di risanamento e da una lista di errori realmente commessi. Vale la
pena leggerla prima di aprire una PR.

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
