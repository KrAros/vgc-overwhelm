# NCP VGC Damage Calculator — copia vendorizzata

Questi file **non sono nostri** e **non fanno parte dell'applicazione**.
Sono una copia di lavoro del calculator NCP, usata solo dai test per generare
i numeri attesi (l'"oracolo"). Nessun file di `src/` li importa, quindi non
entrano mai nel bundle: `npm run build` produce un `dist/` in cui non compare
una sola riga di questo codice. C'è un test che lo verifica
(`src/__tests__/igiene.test.js`).

## Provenienza

| | |
|---|---|
| Progetto | NCP VGC Damage Calculator |
| Repository | https://github.com/nerd-of-now/NCP-VGC-Damage-Calculator |
| Commit fissato | `7919130` — "End of turn additions" |
| Licenza | MIT (vedi `LICENSE` in questa cartella) |
| Copyright | 2013-2021 Honko, Tapin, Firestorm, Jake White (squirrelboyVGC), nerd-of-now, and other contributors |

Il commit è fissato di proposito. Se aggiorni questi file, l'oracolo cambia
sotto i piedi ai golden già raccolti: aggiorna il commit qui sopra e in
`scripts/vendorizza-ncp.sh`, rigenera con `npm run ncp:gen`, e guarda il diff
della fixture caso per caso.

Per rifare questa cartella da zero:

```bash
bash scripts/vendorizza-ncp.sh
```

## Perché proprio questi nove file

`damage_SV.js` contiene `GET_DAMAGE_SV`, la funzione di calcolo per Champions
(l'intestazione del file la nomina esplicitamente). Non tocca il DOM. Gli altri
otto sono le sue dipendenze:

| File | Contiene |
|---|---|
| `damage_SV.js` | `GET_DAMAGE_SV` — l'ingresso |
| `damage_MASTER.js` | le quattro catene `calcBPMods` / `calcAtMods` / `calcDefMods` / `calcFinalMods`, `chainMods`, `pokeRound` |
| `pokedex.js` | base stats, tipi, peso |
| `move_data.js` | potenza, tipo, categoria, flag delle mosse |
| `ability_data.js` | elenco abilità per generazione |
| `item_data.js` | elenco strumenti per generazione |
| `type_data.js` | tabella efficacia |
| `stat_data.js` | `CALC_STAT_CHAMP` / `CALC_HP_CHAMP` — le formule SP di Champions |
| `nature_data.js` | le 25 nature |

Il resto del repository NCP (jQuery, `ap_calc.js`, i setdex, i CSS) è interfaccia
e non serve. Le due sole cose che vivono in `ap_calc.js` e che ci servono davvero
— il costruttore `Side` e `setHasTypeFunc` — sono poche righe senza jQuery
dentro, e sono ridichiarate in `scripts/ncp/prelude.js` invece di trascinarsi
dietro 115 KB di codice d'interfaccia.

## Cosa NON è stato modificato

Niente. I file sono copiati byte per byte dal commit indicato. Tutti gli
adattamenti necessari per farli girare in Node vivono in `scripts/ncp/`, fuori
da questa cartella. È voluto: se un giorno vorrai aggiornare NCP, ti basterà
rilanciare lo script senza rileggere nessuna tua modifica.
