# Vocabulario de los mazos de letras

Por que los mazos en espanol se reconstruyeron, y con que criterio, para que la
proxima persona que anada una palabra no vuelva a meter las mismas.

## El problema

Los mazos se habian llenado por patron: cualquier palabra que encajara con la letra,
las silabas y la posicion. Nadie comprobo que la palabra significara algo para un nino,
ni que ARASAAC tuviera un pictograma para ella. Auditando las 694 palabras en espanol
contra el API en vivo salieron tres fallos distintos:

- **78 palabras sin pictograma.** Daban 404, asi que la tarjeta mostraba "?" siempre.
  Todas eran relleno fonetico: `ama`, `ata`, `echa`, `sabe`, `hago`, `mira`, `lelo`,
  `nono`, `pillo`, `chupa`.
- **10 palabras con un pictograma que un nino no debe ver.** El propio ARASAAC las
  etiqueta: `pipa` y `cenicero` son `smoking`/`drugs`, `vino` es `alcoholism`,
  `caza` resuelve al avion de guerra, `espada` es `weapon`, y `guerra`, `tanque`,
  `vago`, `glotón` y `ladrón` en la misma linea.
- **Silabas y edad pegadas.** La banda se habia asignado por longitud de palabra, no
  por dificultad del concepto, asi que toda palabra larga acabo en la banda 9.
  `ambulancia` y `aguacate` estaban ahi, y un nino de cuatro anos sabe las dos.
  La banda 3 veia 493 palabras de dos silabas, cuatro de tres y ninguna de cuatro.

## Reglas para anadir una palabra

1. **Comprobar que existe.** `npm run audit:decks -- es`. Una palabra sin pictograma
   no entra: el nino solo veria "?".
2. **La banda es el concepto, nunca la longitud.** `ambulancia` tiene cuatro silabas
   y es banda 3. `nefrologo` tiene cuatro y no entra en ningun mazo.
3. **La ortografia espanola no es `includes()`.** `c` ante a/o/u suena /k/ y va al
   mazo `k`; `c` ante e/i va al `z-c`; `ch` tiene mazo propio. Igual con `g`:
   ga/go/gu/gue/gui van al mazo `g`, ge/gi van al `j-g`. Y la `r` inicial o `rr`
   es el mazo `rr`, la `r` simple entre vocales es `r-suave`.
4. **Espanol de Espana.** ARASAAC lista variantes americanas como claves extra del
   mismo pictograma (`autobus`/`colectivo`/`micro`, `camiseta`/`remera`,
   `abuela`/`yaya`). La primera clave es la peninsular.
5. **Sin plurales ni pares macho y hembra.** `grapa` o `grapas`, no las dos.
   `enfermero` o `enfermera`, no las dos: ocupan sitio y ensenan lo mismo.

## Un detalle del catalogo

`GET /api/pictograms/all/es` devuelve los 13.827 pictogramas de una vez, con
`keywords`, `categories`, `tags` y, lo mas util, `meaning`, la definicion de
diccionario. Es lo unico que distingue `bota` 5401, "odre pequeno de vino", de
`bota` 8299, "calzado que resguarda el pie". Dos etiquetas identicas, dos dibujos
distintos: el texto no basta, hay que mirar el pictograma.

## El ingles es otro problema

El vocabulario ingles estaba bien: de 521 palabras solo tres no tenian pictograma
(`pan`, `ladder`, `desk`) y ninguna era inapropiada. Lo que fallaba era el techo de
silabas: el maximo era 3 y no habia **ni una** palabra de cuatro.

Dos cosas se hacen a mano en ingles, y no por pereza:

- **El recuento de silabas.** `syllabify()` no divide ingles a proposito, porque haria
  falta un diccionario y una division mal hecha, dicha en voz alta, le ensena al nino
  algo falso. Cada palabra nueva trae su recuento escrito a mano.
- **El mazo al que va cada palabra.** Los `_comment` de los ficheros ingleses piden
  cosas que no se deducen de la ortografia: "short a only, as in cat", "hard c only",
  "no silent k", "only the s sound, not z". Emparejar por letra meteria `cake` en el
  mazo de la a corta. Las palabras nuevas se asignaron por el sonido inicial, que es
  el unico inequivoco, y el script solo comprueba que la letra este en la palabra.

Ortografia britanica, que es la que usa ARASAAC: `pyjamas`, no `pajamas`. El nino no
lee, asi que la etiqueta es cosmetica, pero el pictograma solo aparece con la britanica.
