# Migración Cotizador Agroquímicos a Supabase

**Fecha:** 2026-03-28
**Estado:** Aprobado
**Archivo:** `cotizador-agronomia.html`

## Contexto

El cotizador de agroquímicos usa Google Apps Script + Google Sheets como backend. El cotizador Nidera ya migró a Supabase exitosamente. Esta migración:
- Unifica el backend con Nidera (misma instancia Supabase)
- Comparte tablas `clientes` y `condiciones` entre ambos cotizadores
- Sincroniza estados de cotización (Pendiente/Enviada/Venta cargada) a Supabase, resolviendo el problema de que solo vivían en localStorage
- Elimina Apps Script completamente (corte limpio, sin fallback dual)
- Arranca historial de cero (cotizaciones viejas quedan en Sheets como archivo)

## Instancia Supabase

Misma que Nidera:
- URL: `https://xpzwopnsasvlppbvapdy.supabase.co`
- Anon key: el mismo que `cotizador-semillas.html`
- Sin autenticación de usuarios (anon access)

## Esquema de base de datos

### Tablas compartidas (ya existen)

**`clientes`** — usada por Nidera y Agro
- `id` serial PK
- `nombre` text
- `cuit` text

**`condiciones`** — usada por Nidera y Agro
- `id` serial PK
- `moneda` text
- `detalle` text
- `tna` numeric
- `tea` numeric
- `plazo` integer (días)

### Tablas nuevas

**`catalogo_agro`**
```sql
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
  subtipo text NOT NULL,  -- HER/INS/FUN/CUR/COA/PAS/SIL/SEM/FER
  stock numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

Mapeo de subtipo a categoría se mantiene en frontend (SUBTIPO_MAP).

**`cotizaciones_agro`**
```sql
CREATE TABLE cotizaciones_agro (
  numero serial PRIMARY KEY,
  fecha timestamptz DEFAULT now(),
  vendedor text,
  cliente text,
  establecimiento text,
  hectareas numeric DEFAULT 0,
  plazo text,
  recargo_pct numeric DEFAULT 0,
  tipo text DEFAULT 'cotizacion',  -- 'cotizacion' | 'receta'
  estado text DEFAULT 'Pendiente', -- 'Pendiente' | 'Enviada' | 'Venta cargada'
  aplicaciones jsonb,  -- array completo [{id, establecimiento, hectareas, rows: [{producto, cat, precio, dosis, ...}]}]
  items jsonb,         -- flat array de líneas para render rápido en historial
  created_at timestamptz DEFAULT now()
);
```

El campo `aplicaciones` guarda la estructura multi-app completa. El campo `items` es una vista plana (producto, dosis, precio, costoHa, vol, monto) para renderizar historial sin tener que recalcular.

**`financiacion_agro`**
```sql
CREATE TABLE financiacion_agro (
  id serial PRIMARY KEY,
  plazo text NOT NULL,       -- key: 'contado', 'mayo2026', etc.
  label text NOT NULL,       -- display: 'Contado', 'Mayo 2026', etc.
  recargo_pct numeric DEFAULT 0
);
```

## Cambios en el frontend

### Eliminar

1. **`API_URL`** constant y toda referencia a `script.google.com`
2. **`Market.fetch(action)`** — basado en GET a Apps Script
3. **`Market.post(data)`** — basado en POST a Apps Script
4. **`CATALOGO_FALLBACK`** — datos hardcodeados de emergencia
5. **`FINANCIACION_FALLBACK`** — plazos hardcodeados

### Agregar

1. **CDN Supabase** en `<head>`:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
   ```
2. **CONFIG object** con `SUPABASE_URL` y `SUPABASE_ANON_KEY`
3. **`const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY)`**

### Reescribir: `Market`

```javascript
const Market = {
  online: false,

  async init() {
    // Show cached data immediately
    const hasCachedCat = localStorage.getItem('hs_agro_catalogo_cache');
    // ... status display ...

    try {
      const [catRes, finRes, cliRes, condRes] = await Promise.all([
        sb.from('catalogo_agro').select(),
        sb.from('financiacion_agro').select(),
        sb.from('clientes').select('nombre,cuit'),
        sb.from('condiciones').select()
      ]);

      if (catRes.data) {
        // Group by subtipo using SUBTIPO_MAP
        catalogo = groupBySubtipo(catRes.data);
        localStorage.setItem('hs_agro_catalogo_cache', JSON.stringify(catalogo));
        localStorage.setItem('hs_agro_catalogo_ts', Date.now().toString());
      }
      if (finRes.data) {
        financiacion = finRes.data;
        localStorage.setItem('hs_agro_financiacion_cache', JSON.stringify(financiacion));
      }
      if (cliRes.data) {
        clientes = cliRes.data;
        localStorage.setItem('hs_agro_clientes_cache', JSON.stringify(clientes));
      }
      if (condRes.data) {
        Condiciones.data = condRes.data;
        localStorage.setItem('hs_condiciones_cache', JSON.stringify(condRes.data));
      }

      Market.setStatus(true, 'Conectado — ' + totalProds + ' productos');
      // Sync pending local backups
      LocalBackup.syncPending();
    } catch(e) {
      Market.setStatus(hasCachedCat ? true : false, 'Sin conexión — usando cache');
    }
  },

  async refresh() {
    // Same as init but with "Actualizando..." status
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

  setStatus(online, text) { /* sin cambios */ }
};
```

### Reescribir: `Historial`

```javascript
Historial = {
  items: [],
  _cache: null,
  _lastFetch: 0,

  async cargar() {
    // 60s TTL como Nidera
    if (Date.now() - this._lastFetch < 60000 && this._cache) return;

    const { data, error } = await sb.from('cotizaciones_agro')
      .select()
      .order('numero', { ascending: false })
      .limit(100);

    if (data) {
      this._cache = data;
      this._lastFetch = Date.now();
      this.items = data.map(q => ({
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
        total: (q.items || []).reduce((s, l) => s + (parseFloat(l.costoHa) || 0), 0),
        totalHas: q.hectareas > 0
          ? (q.items || []).reduce((s, l) => s + (parseFloat(l.monto) || 0), 0)
          : null,
        aplicaciones: q.aplicaciones  // para modificar
      }));
      localStorage.setItem('hs_agro_historial_cache', JSON.stringify(this.items));
    }
    this.render();
  },

  async setEstado(numero, estado) {
    // Optimistic update
    const q = this.items.find(i => i.numero === numero);
    if (q) q.estado = estado;
    if (this._cache) {
      const c = this._cache.find(r => r.numero === numero);
      if (c) c.estado = estado;
    }
    this.render();
    // Sync to Supabase
    try {
      await sb.from('cotizaciones_agro').update({ estado }).eq('numero', numero);
    } catch(e) { console.warn('Error actualizando estado:', e); }
  },

  async eliminar(idx) {
    const h = this.items[idx];
    if (!h || !confirm('¿Eliminar cotización #' + (h.numero || '') + '?')) return;
    try {
      const { error } = await sb.from('cotizaciones_agro').delete().eq('numero', h.numero);
      if (error) throw error;
      this.items.splice(idx, 1);
      localStorage.setItem('hs_agro_historial_cache', JSON.stringify(this.items));
      this.render();
      alert('Cotización eliminada.');
    } catch(e) { alert('Error: ' + e.message); }
  },

  // render(), toggle(), exportar(), modificar(), compartir() — sin cambios
};
```

### Reescribir: `Condiciones`

```javascript
Condiciones = {
  data: JSON.parse(localStorage.getItem('hs_condiciones_cache') || 'null'),

  async load() {
    if (this.data) this.renderTable();
    try {
      const { data, error } = await sb.from('condiciones').select();
      if (data && data.length) {
        this.data = data;
        localStorage.setItem('hs_condiciones_cache', JSON.stringify(data));
        this.renderTable();
      }
    } catch(e) { /* fallback to cache */ }
  },

  // buildTableHTML(), renderTable(), share() — sin cambios
};
```

### Reescribir: `_registrarYGuardar`

```javascript
async _registrarYGuardar(modo) {
  const recargo = App.getRecargo();
  const items = aplicaciones.flatMap(a => a.rows.map(r => {
    const precioP = r.precio * (1 + recargo);
    const costoHa = precioP * r.dosis;
    const has = a.hectareas || 0;
    return {
      producto: r.producto, cat: r.cat, dosis: r.dosis, unidad: r.unidad,
      precio: fmt(precioP), costoHa: fmt(costoHa),
      vol: has > 0 ? fmt(r.dosis * has) : '—',
      monto: has > 0 ? fmt(costoHa * has) : '—',
      iva_pct: r.iva_pct
    };
  }));

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
      plazo: plazoActual === 'financiacion' ? $('fin-info').textContent : 'Contado',
      recargo_pct: recargo * 100,
      tipo: modo,
      aplicaciones: aplicaciones.map(a => ({
        establecimiento: a.establecimiento,
        hectareas: a.hectareas,
        rows: a.rows
      })),
      items
    });
    LocalBackup.markSynced(localId);
  } catch(e) { console.error(e); }

  Historial.recargar();
}
```

### Reescribir: `addCliente`

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
}
```

### Sin cambios

- Todo el HTML/CSS
- `App` object (renderAplicaciones, PDF, dropdowns, UX completa)
- `Calc` object
- Financiación custom (fecha + tasa mensual)
- `LocalBackup` (mantiene cola offline, sync en init)
- Logo preload, captureAndShare, debounce helpers

## Datos iniciales

Los datos de catálogo, financiación y clientes se cargan manualmente en Supabase:
- `catalogo_agro`: importar desde la hoja "Catalogo Agronomia" actual
- `financiacion_agro`: insertar las 3 filas (contado/mayo/dic)
- `clientes`: ya compartida, no necesita migración
- `condiciones`: ya compartida, no necesita migración

## Secuencia de implementación

1. Crear tablas en Supabase (SQL)
2. Cargar datos iniciales (catálogo + financiación)
3. Agregar CDN Supabase + CONFIG al HTML
4. Reescribir Market (eliminar Apps Script, usar sb.from)
5. Reescribir Historial (con setEstado sincronizado)
6. Reescribir Condiciones (tabla compartida)
7. Reescribir _registrarYGuardar y addCliente
8. Eliminar código muerto (API_URL, fallbacks, CATALOGO_FALLBACK)
9. Test completo: cargar catálogo, crear cotización, historial, estados, PDF, eliminar
