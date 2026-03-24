# Manual — App Seguimiento de Campaña

## Acceso
- **URL:** cotizadoreshenderseeds.vercel.app/campana.html
- Seleccioná tu usuario (JAM, Ginar, DM y AG, Fabio y Tomas)
- Tus datos se guardan automáticamente en la nube

---

## Pestañas

### 1. LOTES
Tabla resumen de todos tus lotes con info de **Fina** y **Gruesa** para la campaña seleccionada.

| Columna | Qué muestra |
|---------|-------------|
| Lote | Nombre del lote (EP1, SC2, etc.) |
| Estab. | Establecimiento al que pertenece |
| Ha | Hectáreas del lote |
| Fina | Cultivo + Variedad + Densidad + Rinde + Precio |
| Gruesa | Cultivo + Variedad + Densidad + Rinde + Precio |

**Acciones:**
- ✏️ **Lápiz azul** (al lado de Has) → editar nombre, hectáreas, establecimiento del lote
- ✏️ **Lápiz ámbar** (después de USD) → editar plan de Fina o Gruesa (cultivo, variedad, densidad, rinde, precio)
- 🗑 **Tacho** (muy chico, al lado del lápiz azul) → eliminar lote

**Cambiar campaña:** Usá el selector de arriba (ej: 2025/26 → 2026/27). Al cambiar, toda la app muestra datos de esa campaña.

---

### 2. PLANOS
Mapa visual de tus campos con los lotes como rectángulos coloreados.

**Colores:**
- 🟡 Amarillo = Maíz
- 🟣 Violeta = Girasol
- 🟢 Verde = Soja
- 🟠 Naranja = Trigo
- ⬜ Blanco = Sin asignar

**Cómo usar:**
1. **Mover** un establecimiento: arrastrá desde el nombre
2. **Redimensionar**: arrastrá desde las esquinas (aparecen al pasar el mouse)
3. **Planificar**: tocá un lote → se abre el formulario con Cultivo, Variedad, Densidad, Rinde, Precio, Fecha siembra
4. **Guardar todo**: botón central entre GRUESA y FINA → guarda posiciones + datos en la nube

**Dos secciones:**
- Arriba: **GRUESA** (Maíz, Soja, Girasol)
- Abajo: **FINA** (Trigo, Cebada, Barbecho)

Los cambios de posición en GRUESA se replican automáticamente en FINA (son los mismos campos físicos).

---

### 3. NUEVA OT (Orden de Trabajo)
Formulario para crear una nueva orden de aplicación.

**Pasos:**
1. Elegí **fecha** y **aplicador**
2. En cada aplicación, seleccioná **lotes** y **hectáreas**
3. Buscá y agregá **productos** (se autocompletan desde el catálogo)
4. Ajustá **precio** y **dosis** por producto
5. Opcionalmente: costo de labor, notas, estado

**Botones al final:**
- 💾 **Guardar Orden** → guarda sin compartir
- 🔗 **Compartir** → envía por WhatsApp

**Tip:** Podés agregar múltiples aplicaciones en la misma orden con "+ Agregar Aplicación".

---

### 4. ORDENES
Lista de todas las órdenes de la campaña seleccionada.

**Filtros:**
- Por **estado**: Todas, Pendientes, En curso, Completadas
- Por **lote**: filtrar órdenes que incluyen un lote específico
- Por **fecha**: rango desde/hasta
- **Búsqueda**: por aplicador, producto, lote

**Acciones por orden:**
- ✏️ Editar → carga la orden en el formulario
- 🔗 Compartir → envía por WhatsApp
- 📋 Duplicar → crea una copia
- 🗑 Eliminar

**Precios editables:** Si un producto tiene precio $0 (borde rojo), podés editarlo directamente en la tabla sin entrar a editar la orden.

---

### 5. ANALISIS
Dashboard con métricas de la campaña seleccionada.

**KPIs:** Costo/ha, Inversión total, Hectáreas, Productos usados

**Gráficos:**
- Análisis por lote (costo/ha comparativo)
- Desglose por categoría (Herbicidas, Fungicidas, etc.)
- Inversión por tipo de labor
- Timeline mensual
- Tabla de productos utilizados
- Historial de aplicaciones

**Filtros:** Por lote y por estado. Al filtrar por un lote, se muestra el detalle + acumulado.

---

## Datos importantes

### Guardado automático
- Los cambios se guardan en tu dispositivo al instante
- Se sincronizan a Google Sheets cada 3 segundos automáticamente
- El indicador de estado (arriba) muestra:
  - 🟢 Verde = Sincronizado
  - 🟠 Naranja = Guardando...
  - ⚫ Gris = Datos locales (sin conexión)

### Cambiar de usuario
- Tocá tu nombre arriba a la izquierda → volvés a la pantalla de selección

### Backup
- En la pestaña **Lotes** tenés botones para descargar backup (JSON) y restaurar

### Links útiles (pantalla de login)
- 📊 Futuros (Matba Rofex)
- 🌾 Pizarra (BCR)
- 💵 Dólar (Ámbito)
- 🌤️ Clima Henderson (yr.no)
