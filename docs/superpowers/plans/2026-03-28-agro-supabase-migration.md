# Migración Cotizador Agro a Supabase — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar el cotizador de agroquímicos de Google Apps Script a Supabase, compartiendo tablas clientes/condiciones con Nidera, y sincronizando estados de cotización.

**Architecture:** Single-file HTML app (`cotizador-agronomia.html`). Reemplazar el objeto `Market` (fetch a Apps Script) por queries directas a Supabase via `@supabase/supabase-js@2`. Reescribir `Historial` para cargar/guardar/setEstado desde Supabase. Mantener `LocalBackup` para offline.

**Tech Stack:** Supabase JS SDK v2 (CDN), jsPDF, html2canvas — sin build tools, sin frameworks.

**Spec:** `docs/superpowers/specs/2026-03-28-agro-supabase-migration-design.md`

---

## Task 1: Crear tablas en Supabase

**Context:** La instancia Supabase ya existe (`xpzwopnsasvlppbvapdy.supabase.co`). Las tablas `clientes` y `condiciones` ya existen (usadas por Nidera). Hay que crear 3 tablas nuevas.

- [ ] **Step 1: Ejecutar SQL en Supabase Dashboard → SQL Editor**

Ir a https://supabase.com/dashboard → proyecto → SQL Editor. Ejecutar:

```sql
-- Catálogo de agroquímicos
CREATE TABLE catalogo_agro (
  id serial PRIMARY KEY,
  producto text NOT NULL,
  presentacion numeric,
  formulacion text,
  proveedor text,
  iva_pct numeric DEFAULT 21,
  costo_usd numeric DEFAULT 0,
  margen_pct numeric DEFAULT 0,
  precio_usd numeric DEFAULT 0,
  dosis_sug numeric,
  subtipo text NOT NULL,
  stock numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Cotizaciones de agroquímicos
CREATE TABLE cotizaciones_agro (
  numero serial PRIMARY KEY,
  fecha timestamptz DEFAULT now(),
  vendedor text,
  cliente text,
  establecimiento text,
  hectareas numeric DEFAULT 0,
  plazo text,
  recargo_pct numeric DEFAULT 0,
  tipo text DEFAULT 'cotizacion',
  estado text DEFAULT 'Pendiente',
  aplicaciones jsonb,
  items jsonb,
  created_at timestamptz DEFAULT now()
);

-- Financiación agro
CREATE TABLE financiacion_agro (
  id serial PRIMARY KEY,
  plazo text NOT NULL,
  label text NOT NULL,
  recargo_pct numeric DEFAULT 0
);

-- Datos iniciales financiación
INSERT INTO financiacion_agro (plazo, label, recargo_pct) VALUES
  ('contado', 'Contado', 0),
  ('mayo2026', 'Mayo 2026', 2),
  ('dic2026', 'Dic 2026', 6);

-- RLS: permitir acceso anónimo (mismo patrón que Nidera)
ALTER TABLE catalogo_agro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_catalogo_agro" ON catalogo_agro FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_catalogo_agro" ON catalogo_agro FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_catalogo_agro" ON catalogo_agro FOR UPDATE TO anon USING (true);

ALTER TABLE cotizaciones_agro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_cotizaciones_agro" ON cotizaciones_agro FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE financiacion_agro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_financiacion_agro" ON financiacion_agro FOR SELECT TO anon USING (true);
```

- [ ] **Step 2: Verificar tablas creadas**

En Supabase Dashboard → Table Editor, confirmar que aparecen `catalogo_agro`, `cotizaciones_agro`, `financiacion_agro`. La tabla `financiacion_agro` debe tener 3 filas (contado, mayo2026, dic2026).

- [ ] **Step 3: Cargar catálogo desde Google Sheets**

Exportar la hoja "Catalogo Agronomia" a CSV. En Supabase Dashboard → Table Editor → `catalogo_agro` → Import CSV. Mapear columnas: producto, presentacion, formulacion, proveedor, iva_pct, costo_usd, margen_pct, precio_usd, dosis_sug, subtipo, stock.

---

## Task 2: Agregar Supabase SDK y CONFIG

**Files:**
- Modify: `cotizador-agronomia.html` (líneas 7-8 para CDN, líneas 828-918 para CONFIG)

- [ ] **Step 1: Agregar CDN de Supabase en `<head>`**

Después de la línea del CDN de jsPDF (línea 8), agregar:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
```

- [ ] **Step 2: Reemplazar API_URL y fallbacks por CONFIG + Supabase client**

Reemplazar todo el bloque desde `/* ══ CATÁLOGO FALLBACK` (línea ~828) hasta `const API_URL = '...'` (línea ~918) inclusive por:

```javascript
/* ── Supabase Config ── */
const CONFIG = {
  SUPABASE_URL: 'https://xpzwopnsasvlppbvapdy.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwendvcG5zYXN2bHBwYnZhcGR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzOTk0NTMsImV4cCI6MjA4OTk3NTQ1M30.5o3QBrVRSOIYA8ynFnn11aTzNyuMEh1HjGCkCSTZxXY'
};
const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const SUBTIPO_MAP = {
  'HER': 'Herbicidas', 'INS': 'Insecticidas', 'FUN': 'Fungicidas',
  'CUR': 'Curasemillas', 'COA': 'Coadyuvantes', 'PAS': 'Pasturas',
  'SIL': 'Silo Bolsa', 'SEM': 'Semillas', 'FER': 'Fertilizantes'
};

function groupBySubtipo(rows) {
  const result = {};
  rows.forEach(r => {
    const cat = SUBTIPO_MAP[r.subtipo] || r.subtipo || 'Otros';
    if (!result[cat]) result[cat] = [];
    result[cat].push(r);
  });
  return result;
}
```

- [ ] **Step 3: Commit**

```bash
git add cotizador-agronomia.html
git commit -m "Agro: agregar Supabase SDK, CONFIG y groupBySubtipo"
```

---

## Task 3: Reescribir Market

**Files:**
- Modify: `cotizador-agronomia.html` — reemplazar el objeto `Market` completo

- [ ] **Step 1: Reemplazar Market completo**

Reemplazar todo desde `/* ── Market (conexión a Sheets) ── */` hasta el cierre `};` del objeto Market (incluyendo `setStatus`) por:

```javascript
/* ── Market (conexión a Supabase) ── */
const Market = {
  online: false,

  async init() {
    const hasCachedCat = localStorage.getItem('hs_agro_catalogo_cache');
    const totalCached = Object.values(catalogo).reduce((s, arr) => s + arr.length, 0);
    const cacheTs = parseInt(localStorage.getItem('hs_agro_catalogo_ts') || '0');
    const cacheStale = cacheTs > 0 && (Date.now() - cacheTs) > 4 * 60 * 60 * 1000;
    Market.setStatus(hasCachedCat ? true : null, hasCachedCat ? (cacheStale ? 'Cache viejo — ' : 'Cache — ') + totalCached + ' productos' : 'Conectando...');

    try {
      const [catRes, finRes, cliRes] = await Promise.all([
        sb.from('catalogo_agro').select(),
        sb.from('financiacion_agro').select(),
        sb.from('clientes').select('nombre,cuit')
      ]);

      if (catRes.data && catRes.data.length) {
        catalogo = groupBySubtipo(catRes.data);
        localStorage.setItem('hs_agro_catalogo_cache', JSON.stringify(catalogo));
        localStorage.setItem('hs_agro_catalogo_ts', Date.now().toString());
      }
      if (finRes.data && finRes.data.length) {
        financiacion = finRes.data;
        localStorage.setItem('hs_agro_financiacion_cache', JSON.stringify(financiacion));
      }
      if (cliRes.data) {
        clientes = cliRes.data;
        localStorage.setItem('hs_agro_clientes_cache', JSON.stringify(clientes));
      }

      const totalProds = Object.values(catalogo).reduce((s, arr) => s + arr.length, 0);
      Market.setStatus(true, 'Conectado — ' + totalProds + ' productos');
      App.renderLista(plazoActual);

      // Sync pending local backups
      const pending = LocalBackup.getPending();
      if (pending.length) {
        for (const cot of pending) {
          try {
            await sb.from('cotizaciones_agro').insert({
              vendedor: cot.vendedor, cliente: cot.cliente, items: cot.items
            });
            LocalBackup.markSynced(cot.localId);
          } catch(e) { break; }
        }
      }
    } catch(err) {
      console.error('Market.init error:', err);
      Market.setStatus(hasCachedCat ? true : false, hasCachedCat ? 'Sin conexión — usando cache' : 'Error — datos locales');
    }
  },

  async refresh() {
    Market.setStatus(null, 'Actualizando...');
    try {
      const [catRes, finRes, cliRes] = await Promise.all([
        sb.from('catalogo_agro').select(),
        sb.from('financiacion_agro').select(),
        sb.from('clientes').select('nombre,cuit')
      ]);
      if (catRes.data && catRes.data.length) {
        catalogo = groupBySubtipo(catRes.data);
        localStorage.setItem('hs_agro_catalogo_cache', JSON.stringify(catalogo));
        localStorage.setItem('hs_agro_catalogo_ts', Date.now().toString());
      }
      if (finRes.data && finRes.data.length) {
        financiacion = finRes.data;
        localStorage.setItem('hs_agro_financiacion_cache', JSON.stringify(financiacion));
      }
      if (cliRes.data) {
        clientes = cliRes.data;
        localStorage.setItem('hs_agro_clientes_cache', JSON.stringify(clientes));
      }
      const total = Object.values(catalogo).reduce((s, arr) => s + arr.length, 0);
      Market.setStatus(true, 'Actualizado — ' + total + ' productos');
      App.renderLista(plazoActual);
    } catch(e) {
      Market.setStatus(false, 'Error al actualizar');
    }
  },

  async registrarCotizacion(payload) {
    const { data, error } = await sb.from('cotizaciones_agro')
      .insert({
        vendedor: payload.vendedor,
        cliente: payload.cliente,
        establecimiento: payload.establecimiento,
        hectareas: payload.hectareas,
        plazo: payload.plazo,
        recargo_pct: payload.recargo_pct,
        tipo: payload.tipo,
        aplicaciones: payload.aplicaciones,
        items: payload.items
      })
      .select('numero')
      .single();
    if (error) throw error;
    return data.numero;
  },

  setStatus(online, text) {
    Market.online = online;
    const dot = $('status-dot');
    const txt = $('status-text');
    if (!dot || !txt) return;
    dot.classList.remove('on');
    if (online === true) dot.classList.add('on');
    if (online === null) dot.style.background = 'var(--accent)';
    else dot.style.background = '';
    txt.textContent = text;
  }
};
```

- [ ] **Step 2: Verificar que no quedan referencias a API_URL**

Buscar `API_URL` en el archivo. No debe haber ninguna referencia.

- [ ] **Step 3: Commit**

```bash
git add cotizador-agronomia.html
git commit -m "Agro: reescribir Market para Supabase"
```

---

## Task 4: Reescribir Historial

**Files:**
- Modify: `cotizador-agronomia.html` — reescribir las funciones `cargar`, `setEstado`, `eliminar` del objeto `Historial`

- [ ] **Step 1: Reemplazar Historial.cargar()**

Reemplazar la función `cargar()` actual (que usa `Market.fetch('getHistorialAgro')`) por:

```javascript
  async cargar() {
    if (Historial.items.length) Historial.render();
    try {
      const { data, error } = await sb.from('cotizaciones_agro')
        .select()
        .order('numero', { ascending: false })
        .limit(100);
      if (error) throw error;
      if (data) {
        Historial.items = data.map(q => ({
          numero: q.numero,
          fecha: q.fecha ? new Date(q.fecha).toLocaleDateString('es-AR') : '—',
          vendedor: q.vendedor,
          cliente: q.cliente,
          establecimiento: q.establecimiento,
          hectareas: q.hectareas,
          plazo: q.plazo,
          tipo: q.tipo,
          estado: q.estado || 'Pendiente',
          lineas: q.items || [],
          total: fmt((q.items || []).reduce((s, l) => s + (parseFloat(l.costoHa) || 0), 0)),
          totalHas: q.hectareas > 0
            ? fmt((q.items || []).reduce((s, l) => {
                const m = l.monto && l.monto !== '—' ? parseFloat(l.monto.replace(/\./g, '').replace(',', '.')) || 0 : 0;
                return s + m;
              }, 0))
            : null,
          aplicaciones: q.aplicaciones
        }));
        localStorage.setItem('hs_agro_historial_cache', JSON.stringify(Historial.items));
      }
    } catch(e) { console.error('Error cargando historial:', e); }
    Historial.render();
  },
```

- [ ] **Step 2: Reemplazar Historial.setEstado()**

Reemplazar la función `setEstado()` actual (que usa localStorage `hs_agro_quote_estados`) por:

```javascript
  async setEstado(numero, estado) {
    // Optimistic update
    const q = this.items.find(i => i.numero == numero);
    if (q) q.estado = estado;
    this.render();
    // Sync to Supabase
    try {
      await sb.from('cotizaciones_agro').update({ estado }).eq('numero', numero);
    } catch(e) { console.warn('Error actualizando estado:', e); }
  },
```

- [ ] **Step 3: Reemplazar Historial.eliminar()**

Reemplazar la función `eliminar()` actual (que usa `fetch(API_URL, ...)`) por:

```javascript
  async eliminar(idx) {
    const h = Historial.items[idx];
    if (!h) return;
    if (!confirm('¿Eliminar cotización #' + (h.numero || '') + '? Esta acción no se puede deshacer.')) return;
    try {
      const { error } = await sb.from('cotizaciones_agro').delete().eq('numero', h.numero);
      if (error) throw error;
      Historial.items.splice(idx, 1);
      localStorage.setItem('hs_agro_historial_cache', JSON.stringify(Historial.items));
      Historial.render();
      alert('Cotización eliminada.');
    } catch(e) { alert('Error: ' + e.message); }
  },
```

- [ ] **Step 4: Actualizar Historial.render() — usar estado de Supabase**

En `Historial.render()`, cambiar la línea que lee estados de localStorage:

```javascript
// ANTES:
const estados = JSON.parse(localStorage.getItem('hs_agro_quote_estados') || '{}');
```

```javascript
// DESPUÉS: (eliminar esta línea, ya no se necesita)
```

Y cambiar la línea que lee el estado por item:

```javascript
// ANTES:
const est = estados[h.numero] || 'Pendiente';
```

```javascript
// DESPUÉS:
const est = h.estado || 'Pendiente';
```

- [ ] **Step 5: Commit**

```bash
git add cotizador-agronomia.html
git commit -m "Agro: reescribir Historial para Supabase con estados sincronizados"
```

---

## Task 5: Reescribir Condiciones y _registrarYGuardar

**Files:**
- Modify: `cotizador-agronomia.html` — `Condiciones.load()`, `_registrarYGuardar()`, `addCliente()`

- [ ] **Step 1: Reemplazar Condiciones.load()**

Reemplazar la función `load()` del objeto Condiciones (que usa `Market.fetch('getCondiciones')`) por:

```javascript
  async load() {
    if (this.data) this.renderTable();
    try {
      const { data, error } = await sb.from('condiciones').select();
      if (data && data.length) {
        this.data = data;
        localStorage.setItem('hs_condiciones_cache', JSON.stringify(data));
        this.renderTable();
      } else if (!this.data) {
        $('condTable').innerHTML = '<p style="color:var(--text-mut);font-size:.75rem;">Sin condiciones disponibles</p>';
      }
    } catch(e) {
      if (!this.data) $('condTable').innerHTML = '<p style="color:var(--text-mut);font-size:.75rem;">Error al cargar condiciones</p>';
    }
  },
```

- [ ] **Step 2: Reemplazar _registrarYGuardar()**

Reemplazar la función `_registrarYGuardar()` completa por:

```javascript
  async _registrarYGuardar(modo) {
    const recargo = App.getRecargo();
    const items = aplicaciones.flatMap(a => {
      const has = a.hectareas || 0;
      return a.rows.map(r => {
        const precioP = r.precio * (1 + recargo);
        const costoHa = precioP * r.dosis;
        const vol = has > 0 ? r.dosis * has : null;
        const monto = has > 0 ? costoHa * has : null;
        return {
          producto: r.producto, cat: r.cat, dosis: r.dosis, unidad: r.unidad,
          precio: fmt(precioP), costoHa: fmt(costoHa),
          vol: vol ? fmt(vol) : '—', monto: monto ? fmt(monto) : '—',
          iva_pct: r.iva_pct, formulacion: r.formulacion || ''
        };
      });
    });

    const firstApp = aplicaciones[0] || { hectareas: 0, establecimiento: '' };

    // LocalBackup (offline fallback)
    const localId = 'agro_' + Date.now();
    LocalBackup.save({ localId, fecha: dateStr(), vendedor: vendor, cliente: $('cliente').value || '—', items, synced: false });

    // Supabase insert
    try {
      const numero = await Market.registrarCotizacion({
        vendedor: vendor,
        cliente: $('cliente').value || '—',
        establecimiento: firstApp.establecimiento,
        hectareas: firstApp.hectareas,
        plazo: plazoActual === 'financiacion' ? ($('fin-info').textContent || 'Financiación') : 'Contado',
        recargo_pct: Math.round(recargo * 10000) / 100,
        tipo: modo,
        aplicaciones: aplicaciones.map(a => ({
          id: a.id, establecimiento: a.establecimiento, hectareas: a.hectareas,
          rows: a.rows
        })),
        items
      });
      LocalBackup.markSynced(localId);
    } catch(e) { console.error('Error registrando:', e); }

    Historial.recargar();
  },
```

- [ ] **Step 3: Reemplazar addCliente()**

Buscar la función `addCliente()` en el objeto App y reemplazarla por:

```javascript
  async addCliente() {
    const nombre = $('cliente').value.trim();
    if (!nombre) return;
    clientes.push({ nombre, cuit: '' });
    localStorage.setItem('hs_agro_clientes_cache', JSON.stringify(clientes));
    App.selectCliente(nombre);
    try {
      await sb.from('clientes').insert({ nombre });
    } catch(e) { console.warn('Error agregando cliente:', e); }
  },
```

- [ ] **Step 4: Commit**

```bash
git add cotizador-agronomia.html
git commit -m "Agro: reescribir Condiciones, registro y addCliente para Supabase"
```

---

## Task 6: Limpieza final

**Files:**
- Modify: `cotizador-agronomia.html` — eliminar código muerto de Apps Script

- [ ] **Step 1: Eliminar CATALOGO_FALLBACK y FINANCIACION_FALLBACK**

Eliminar estas líneas (ya reemplazadas por CONFIG en Task 2):

```javascript
/* Catálogo vacío — SIEMPRE se carga desde Sheets. Sin fallback de precios. */
const CATALOGO_FALLBACK = {};

const FINANCIACION_FALLBACK = [
  { plazo: "contado", label: "Contado", recargo_pct: 0 },
  { plazo: "mayo2026", label: "Mayo 2026", recargo_pct: 2 },
  { plazo: "dic2026", label: "Dic 2026", recargo_pct: 6 }
];
```

- [ ] **Step 2: Actualizar referencias a fallbacks en estado inicial**

Cambiar:

```javascript
let catalogo = JSON.parse(localStorage.getItem('hs_agro_catalogo_cache') || 'null') || CATALOGO_FALLBACK;
let financiacion = JSON.parse(localStorage.getItem('hs_agro_financiacion_cache') || 'null') || FINANCIACION_FALLBACK;
```

Por:

```javascript
let catalogo = JSON.parse(localStorage.getItem('hs_agro_catalogo_cache') || 'null') || {};
let financiacion = JSON.parse(localStorage.getItem('hs_agro_financiacion_cache') || 'null') || [];
```

- [ ] **Step 3: Eliminar referencia a `hs_agro_quote_estados` en localStorage**

Buscar `hs_agro_quote_estados` en el archivo. Ya no debe existir (fue eliminado en Task 4). Verificar.

- [ ] **Step 4: Buscar y eliminar cualquier referencia restante a `API_URL`**

Buscar `API_URL` en todo el archivo. No debe existir ninguna.

- [ ] **Step 5: Commit**

```bash
git add cotizador-agronomia.html
git commit -m "Agro: eliminar código muerto de Apps Script y fallbacks"
```

---

## Task 7: Test manual completo

- [ ] **Step 1: Abrir la app y verificar catálogo**

Abrir `cotizador-agronomia.html` en el browser. El status debe mostrar "Conectado — N productos". El tab "Lista de Precios" debe mostrar productos agrupados por proveedor.

- [ ] **Step 2: Crear cotización**

Seleccionar cliente (autocompletado funciona), agregar productos desde dropdown, setear hectáreas y financiación. Verificar precios, totales, resumen consolidado.

- [ ] **Step 3: Compartir/Guardar cotización**

Click "Cotización" o "Guardar". Verificar que el PDF se genera correctamente. Verificar en Supabase Dashboard → Table Editor → `cotizaciones_agro` que la fila se insertó con todos los campos (items, aplicaciones, estado='Pendiente').

- [ ] **Step 4: Verificar historial**

Click "Ver Historial". La cotización recién creada debe aparecer. Verificar que se muestra numero, fecha, cliente, líneas de productos, total.

- [ ] **Step 5: Verificar estados sincronizados**

En el historial, cambiar el estado de la cotización a "Enviada". Verificar en Supabase Dashboard que `cotizaciones_agro.estado` cambió a 'Enviada'. Recargar la página — el estado debe persistir (ya viene de Supabase, no de localStorage).

- [ ] **Step 6: Verificar eliminación**

Crear una cotización de prueba, ir al historial, eliminarla. Verificar que desaparece del historial y de Supabase.

- [ ] **Step 7: Verificar condiciones**

Tab "Condiciones" debe cargar desde la tabla compartida `condiciones` (mismos datos que ve Nidera).

- [ ] **Step 8: Verificar agregar cliente**

Escribir un nombre nuevo en el campo cliente, click en "+ Agregar". Verificar en Supabase → `clientes` que el nombre aparece (compartido con Nidera).

- [ ] **Step 9: Verificar offline**

Desconectar internet (modo avión o DevTools → Network → Offline). La app debe cargar desde cache. Crear una cotización — se guarda en LocalBackup. Reconectar — verificar que se sincroniza.

- [ ] **Step 10: Push final**

```bash
git push
```
