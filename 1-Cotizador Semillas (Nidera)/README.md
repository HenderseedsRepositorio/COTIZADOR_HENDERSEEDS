# Henderseeds — Cotizador Nidera

## Arquitectura

```
┌─────────────────────────────┐
│   index.html (Frontend)     │  ← Vercel / Netlify (static)
│   - Cotizador completo      │
│   - Selector de vendedor    │
│   - Share vía WhatsApp      │
└─────────┬───────────────────┘
          │ fetch (GET/POST)
          ▼
┌─────────────────────────────┐
│  Google Apps Script (API)   │  ← Serverless, gratis
│  - GET ?action=getCatalogo  │
│  - POST {action:'registrar'}│
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│   Google Sheets             │
│   - Hoja "Catalogo"        │  ← Precios editables sin código
│   - Hoja "Cotizaciones"    │  ← Registro de cada cotización
└─────────────────────────────┘
```

## Paso 1: Crear la Google Sheet

1. Ir a [Google Sheets](https://sheets.google.com) → Nueva hoja de cálculo
2. Renombrar la hoja como **"Catalogo"** (la primera hoja)
3. Llenar con este formato:

| tipo    | id               | b1  | b2     | b3     |
|---------|------------------|-----|--------|--------|
| maiz    | NS7765 Viptera3  | 250 | 240    | 230.4  |
| maiz    | NS7621 Viptera3  | 245 | 235.2  | 225.792|
| maiz    | NS7624 Viptera3CL| 235 | 225.6  | 216.576|
| maiz    | NS7921 Viptera3CL| 240 | 230.4  | 221.184|
| maiz    | AX7761VT3P       | 240 | 230.4  | 221.184|
| maiz    | NS7818VIP3       | 200 | 192    | 184.32 |
| maiz    | NS7852 Viptera3  | 260 | 247    | 197.6  |
| maiz    | NS7925 Viptera3  | 245 | 232.75 | 186.2  |
| girasol | NS1113CL         | 375 | 356.25 |        |
| girasol | NS1227CLHO       | 385 | 365.75 |        |
| girasol | NS1115CL         | 315 | 299.25 |        |
| girasol | NS1117CL         | 345 | 327.75 | 262.2  |

4. Crear una segunda hoja llamada **"Cotizaciones"**
5. En la fila 1 poner estos encabezados:

| N° | Fecha | Vendedor | Cliente | CUIT | Híbridos | Neto USD | IVA USD | Total USD | Descuentos |

6. Copiar el **ID de la Sheet** de la URL:
   `https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit`

## Paso 2: Configurar Google Apps Script

1. Ir a [script.google.com](https://script.google.com) → Nuevo proyecto
2. Borrar todo el contenido de `Code.gs`
3. Pegar el contenido de `apps-script-code.js` (incluido en este proyecto)
4. Reemplazar `PEGAR_TU_SPREADSHEET_ID_AQUI` con el ID de tu Sheet
5. **Deploy:**
   - Click en "Implementar" → "Nueva implementación"
   - Tipo: **Aplicación web**
   - Ejecutar como: **Yo** (tu cuenta)
   - Quién tiene acceso: **Cualquier persona**
   - Click en "Implementar"
6. Copiar la **URL del deploy** (algo como `https://script.google.com/macros/s/XXXXX/exec`)

## Paso 3: Configurar el Frontend

1. Abrir `index.html`
2. Buscar la línea:
   ```javascript
   const APPS_SCRIPT_URL = '';
   ```
3. Pegar la URL del deploy:
   ```javascript
   const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/TU_ID/exec';
   ```

### Personalizar vendedores

Buscar en `index.html` los botones del selector de vendedor y cambiar los nombres:

```html
<button class="vendor-btn" onclick="selectVendor('Alvaro')">Alvaro</button>
<button class="vendor-btn" onclick="selectVendor('Nombre Socio 1')">Nombre Socio 1</button>
<button class="vendor-btn" onclick="selectVendor('Nombre Socio 2')">Nombre Socio 2</button>
```

## Paso 4: Deploy en Vercel (recomendado)

### Opción A: Vercel (más simple)

1. Instalar [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`
2. En la carpeta del proyecto: `vercel`
3. Seguir las instrucciones → ¡Listo!
4. La URL será algo como `https://henderseeds-cotizador.vercel.app`

### Opción B: Netlify

1. Ir a [app.netlify.com](https://app.netlify.com)
2. Arrastrar la carpeta `henderseeds-cotizador` al panel de Netlify
3. ¡Listo! URL automática tipo `https://xxx.netlify.app`

### Opción C: GitHub Pages (gratis, sin cuenta extra)

1. Crear repo en GitHub
2. Subir `index.html` al repo
3. Settings → Pages → Source: main branch → Save
4. URL: `https://usuario.github.io/nombre-repo`

## Cómo funciona

### Para el vendedor
1. Abre la URL compartida en su celular/PC
2. Selecciona su nombre (se recuerda para la próxima vez)
3. Carga cliente, híbridos, descuentos
4. Click "Vista previa" → se genera N° de cotización y se registra en Sheets
5. "Enviar imagen" → se abre el share nativo de WhatsApp/mail

### Para actualizar precios
1. Abrir la Google Sheet → Hoja "Catalogo"
2. Modificar los precios directamente
3. ¡Listo! La próxima vez que un vendedor abra el cotizador, carga los precios nuevos

### Para ver historial de cotizaciones
1. Abrir la Google Sheet → Hoja "Cotizaciones"
2. Ahí están todas las cotizaciones registradas con: N°, fecha, vendedor, cliente, detalle, totales

## Notas técnicas

- **Catálogo fallback**: Si no hay conexión a internet o la Sheet no responde, el cotizador usa un catálogo local hardcodeado. Siempre funciona.
- **N° de cotización**: Se genera secuencialmente desde la Sheet. Si no hay conexión, muestra "LOCAL" (sin registro).
- **Sin autenticación**: No hay login. Cada vendedor elige su nombre al entrar (se guarda en localStorage).
- **CORS**: Google Apps Script maneja CORS automáticamente con `doGet`/`doPost`.
