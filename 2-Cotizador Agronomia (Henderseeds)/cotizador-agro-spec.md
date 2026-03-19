# Cotizador Agroinsumos — Henderseeds SRL

## Contexto
App web single-file (HTML/CSS/JS) para cotizar agroinsumos (todo lo que NO es híbridos Nidera). 
Mismo stack que el Cotizador Nidera V21: Google Sheets como DB + Google Apps Script como API + HTML estático deployado en Vercel/Netlify.

## Modelo de pricing

```
Costo (USD) × (1 + Margen%) = Precio Contado
Precio Contado × (1 + Financiación%) = Precio a plazo
```

- Cada producto tiene su **costo** y **margen %** individual (definidos en Sheets)
- Los **plazos de financiación** tienen % default en Sheets, pero el vendedor puede editarlos por cotización
- IVA: 10.5% para agroquímicos / 21% para otros (configurable por categoría en Sheets)

## Estructura Google Sheets

### Hoja "Catalogo"
| categoria | producto | unidad | costo_usd | margen_pct | iva_pct |
|-----------|----------|--------|-----------|------------|---------|
| Herbicidas | Glifosato 66% x 20L | bidon | 45.00 | 15 | 10.5 |
| Herbicidas | 2,4-D Amina x 20L | bidon | 38.00 | 18 | 10.5 |
| Fungicidas | Azoxistrobina x 5L | bidon | 120.00 | 12 | 10.5 |
| Coadyuvantes | Aceite Metilado x 20L | bidon | 22.00 | 20 | 10.5 |
| Pasturas | Alfalfa grupo 6 x 25kg | bolsa | 180.00 | 15 | 10.5 |
| Pasturas | Rye Grass Anual x 25kg | bolsa | 55.00 | 15 | 10.5 |
| Silo Bolsa | Silo bolsa 9 pies x 60m | rollo | 950.00 | 10 | 21 |
| Semillas | Trigo ACA 360 x 40kg | bolsa | 85.00 | 14 | 10.5 |

### Hoja "Financiacion"
| plazo | label | recargo_pct |
|-------|-------|-------------|
| contado | Contado | 0 |
| mayo2026 | Mayo 2026 | 2 |
| dic2026 | Diciembre 2026 | 6 |

### Hoja "Cotizaciones" (registro automático)
| N° | Fecha | Vendedor | Cliente | CUIT | Producto | Categoria | Cant | Unidad | Costo | Margen% | PrecioContado | Plazo | Recargo% | PrecioFinal | SubtotalSIVA | IVA% | SubtotalCIVA |

## Features del frontend

### Pantalla principal (tabs)
1. **Cotizar** — el formulario principal
2. **Lista de precios** — tabla con todos los productos y precios calculados
3. **Historial** — últimas cotizaciones registradas (reutilizar del V21)

### Tab "Cotizar"
- Selector de vendedor (Alvaro, Gonzalo, Juan Augusto) — se guarda en localStorage
- Campos: Cliente, CUIT (opcionales)
- Líneas de cotización:
  - Selector de categoría → filtra productos de esa categoría
  - Selector de producto (se autocompleta con datos de Sheets)
  - Cantidad (input numérico)
  - Precio contado se calcula automáticamente: costo × (1 + margen%)
  - Selector de plazo (Contado / Mayo / Dic) con recargo% editable
  - Precio final por línea
- Totales: Neto USD, IVA, Total
- Botón "Vista previa" → genera imagen tipo cotización formal
- Botones: Enviar imagen (WhatsApp share), Descargar PNG, Descargar PDF
- Al compartir/descargar → registra automáticamente en hoja "Cotizaciones"

### Tab "Lista de precios"
- Tabla agrupada por categoría
- Muestra: producto, unidad, precio contado, precio mayo, precio diciembre
- Toggles para mostrar/ocultar plazos
- Compartir como imagen (reutilizar captureAndShare del V21)

### Tab "Historial"
- Reutilizar el módulo Historial del V21 adaptado a las nuevas columnas

## Diseño visual
- Mantener el mismo sistema de diseño del Cotizador Nidera (DM Sans, Archivo Black, paleta navy/blue/green)
- Cambiar el acento verde Nidera (#89ba16) por un tono que diferencie este cotizador (sugerencia: naranja tierra #D97706 o verde oliva #65A30D)
- Logo: Henderseeds (mismo)
- Mobile-first, optimizado para celular

## Stack técnico
- Single HTML file (CSS + JS inline)
- html2canvas + jsPDF para captura
- Google Fonts: DM Sans, DM Mono, Archivo Black
- Apps Script como API REST
- Google Sheets como base de datos

## Apps Script endpoints necesarios
```
GET  ?action=getCatalogo      → {categorias: {Herbicidas: [...], ...}}
GET  ?action=getFinanciacion  → [{plazo, label, recargo_pct}, ...]
GET  ?action=getNextNumber    → {numero: N}
GET  ?action=getHistorial     → [[row], [row], ...]
POST {action:'registrar', ...} → {ok: true, numero: N}
```

## Notas
- Catálogo fallback hardcodeado por si no hay conexión
- N° de cotización secuencial desde Sheets
- Sin autenticación (igual que V21)
- Los vendedores son: Alvaro, Gonzalo, Juan Augusto
