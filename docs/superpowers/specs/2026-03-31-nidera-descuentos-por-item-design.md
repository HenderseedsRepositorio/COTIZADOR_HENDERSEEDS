# Nidera: Descuentos Zonal y Henderseeds por ítem

**Fecha:** 2026-03-31
**Archivo:** `cotizador-semillas.html`
**Scope:** Solo cotizador Nidera, solo descuentos %Z y %H por línea

## Problema

Actualmente los descuentos Zonal y Henderseeds se aplican de forma global por tipo de cultivo (maíz/girasol). En la práctica, a veces se necesita negociar descuentos diferentes por híbrido dentro de la misma cotización.

## Solución

Agregar dos columnas compactas **%Z** y **%H** con mini-steppers en cada fila de híbrido. Los valores son por ítem y priman sobre los globales cuando el usuario los modifica.

## Diseño UI

### Nuevas columnas en la grilla de híbridos

Layout actual: `[Híbrido | Banda | Cant. | P.Neto | ✕]`
Layout nuevo: `[Híbrido | %Z | %H | Banda | Cant. | P.Neto | ✕]`

Cada celda %Z y %H contiene un mini-stepper compacto:
- Botones −/+ con step de **0.5%**
- Valor numérico central (ej: `5.0`)
- Misma altura que el stepper de Banda (no agrandar la fila)
- Ancho compacto (~52-56px por columna)

### Valores default

Al agregar un nuevo híbrido:
- **%Z** = valor actual del stepper global Zonal para ese tipo (default: 5% maíz, 5% girasol)
- **%H** = valor actual del stepper global Henderseeds para ese tipo (default: 6% maíz, 6% girasol)

### Interacción global ↔ individual

- Al agregar un híbrido nuevo, se inicializa con los valores globales actuales
- Si el usuario modifica %Z o %H en una fila específica, ese valor **prima sobre el global** para esa línea
- Cada línea trackea si fue modificada individualmente (`l.dtoZCustom`, `l.dtoHCustom` boolean flags)
- Si el usuario cambia el global después:
  - Las líneas que NO fueron tocadas individualmente se actualizan al nuevo valor global
  - Las líneas que SÍ fueron tocadas individualmente mantienen su valor custom

## Cambios en el modelo de datos

### Objeto `lineas[i]`

Agregar campos:
```javascript
{
  // ... campos existentes (hibrido, tipo, banda, cant)
  dtoZ: 5,          // % descuento zonal para esta línea
  dtoH: 6,          // % descuento henderseeds para esta línea
  dtoZCustom: false, // true si el usuario modificó dtoZ manualmente
  dtoHCustom: false  // true si el usuario modificó dtoH manualmente
}
```

### Inicialización en `addLine()`

```javascript
dtoZ: esM ? +$('valZM').value : +$('valZG').value,
dtoH: esM ? +$('valPM').value : +$('valPG').value,
dtoZCustom: false,
dtoHCustom: false
```

## Cambios en el cálculo (`Calc.run`)

### Antes
```javascript
const valZM = +$('valZM').value, valZG = +$('valZG').value;
const valPM = +$('valPM').value, valPG = +$('valPG').value;
// ...
const valZ = esM ? valZM : valZG;
const valP = esM ? valPM : valPG;
const fZP = (1 - valZ/100) * (1 - valP/100);
```

### Después
```javascript
const valZM = +$('valZM').value, valZG = +$('valZG').value;
const valPM = +$('valPM').value, valPG = +$('valPG').value;
// ...
// Sincronizar líneas no-custom con el valor global actual
if (!l.dtoZCustom) l.dtoZ = esM ? valZM : valZG;
if (!l.dtoHCustom) l.dtoH = esM ? valPM : valPG;

const fZP = (1 - l.dtoZ/100) * (1 - l.dtoH/100);
```

## Cambios en `renderLines()`

Agregar dos celdas de stepper entre el nombre del híbrido y el selector de banda:

```javascript
// Mini-stepper %Z
<div class="row-dto">
  <button onclick="Calc.stepDto(${i},'dtoZ',-0.5)">−</button>
  <input type="number" value="${l.dtoZ}" step="0.5" min="0" max="20"
    onchange="Calc.updateDto(${i},'dtoZ',this.value)">
  <button onclick="Calc.stepDto(${i},'dtoZ',0.5)">+</button>
</div>

// Mini-stepper %H
<div class="row-dto">
  <button onclick="Calc.stepDto(${i},'dtoH',-0.5)">−</button>
  <input type="number" value="${l.dtoH}" step="0.5" min="0" max="20"
    onchange="Calc.updateDto(${i},'dtoH',this.value)">
  <button onclick="Calc.stepDto(${i},'dtoH',0.5)">+</button>
</div>
```

## Nuevas funciones en `Calc`

```javascript
stepDto(i, field, delta) {
  lineas[i][field] = Math.max(0, Math.min(20, +(lineas[i][field] + delta).toFixed(1)));
  lineas[i][field + 'Custom'] = true;
  this.renderLines();
},
updateDto(i, field, val) {
  lineas[i][field] = Math.max(0, Math.min(20, +val));
  lineas[i][field + 'Custom'] = true;
  this.run();
}
```

## Cambios CSS

Agregar estilo `.row-dto` para los mini-steppers:
- Grid del `.row-item`: actualizar `grid-template-columns` para incluir 2 columnas nuevas (~52px cada una)
- `.row-dto` button: misma apariencia que los botones del stepper de banda
- `.row-dto` input: width ~28px, text-align center, sin spinners nativos

Actualizar también `.row-new` (fila placeholder) para mantener alineación.

## Cambios en headers

Actualizar el header de la tabla de híbridos para incluir las columnas %Z y %H.

## Qué NO cambia

- Los steppers globales de Zonal/Henderseeds en "Descuentos y bonificaciones" siguen existiendo como valores default
- Pre-Campaña, Contado, Plan Crecer, Cross, Volumen siguen siendo globales
- El tab Precios mantiene sus steppers independientes (no afectado)
- La generación de PDF/imagen no necesita cambios (html2canvas captura el DOM tal cual)
- La tabla de verificación de descuentos por ítem ya muestra valores por línea

## Cambios en registro (Sheets)

Los valores dtoZ y dtoH por línea se deben incluir en el payload de `Sheets.register()` / `Sheets.saveQuote()` para que queden grabados en el historial.

## Alcance de archivos

Solo se modifica: `cotizador-semillas.html`
- CSS: nuevo `.row-dto`, actualizar grid-template-columns de `.row-item` y `.row-new`
- HTML: headers de tabla de híbridos
- JS: `Calc.addLine()`, `Calc.renderLines()`, `Calc.run()`, nuevos `Calc.stepDto()` y `Calc.updateDto()`
- JS: `Sheets.register()` / `Sheets.saveQuote()` payload
