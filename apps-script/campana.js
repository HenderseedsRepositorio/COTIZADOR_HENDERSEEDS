/**
 * ═══════════════════════════════════════════════════════════
 * HENDERSEEDS — Apps Script (backend Seguimiento de Lotes)
 *
 * SETUP:
 * 1. Abrí tu Google Sheet (el mismo del cotizador)
 * 2. Extensiones → Apps Script
 * 3. Creá un archivo nuevo: Campana.gs y pegá este código
 * 4. Agregá los cases nuevos al doGet/doPost existente:
 *
 *    En doGet, dentro del switch(action):
 *      case 'loadCampana':
 *        result = loadCampana(e.parameter.productor);
 *        break;
 *
 *    En doPost, agregar:
 *      } else if (data.action === 'saveCampana') {
 *        result = saveCampana(data);
 *
 * 5. Re-deploy (nueva versión)
 * ═══════════════════════════════════════════════════════════
 *
 * Cada productor tiene su propia hoja: "Camp_NombreProductor"
 * La data se guarda en bloques para evitar el límite de 50k por celda:
 *   Fila 1: Headers
 *   Fila 2: metadata (campana, aplicadores, updatedAt)
 *   Fila 3+: lotes (uno por fila)
 *   Después: ordenes (una por fila)
 */

/* ═══════════════════════════════════════
   LOAD CAMPANA
   Lee la hoja del productor y devuelve su data
   ═══════════════════════════════════════ */
function loadCampana(productor) {
  if (!productor) return { ok: false, error: 'Falta nombre de productor' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'Camp_' + productor.substring(0, 30).replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _-]/g, '');
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    // Productor nuevo, no tiene datos todavía
    return { ok: true, data: null, isNew: true };
  }

  try {
    const allData = sheet.getDataRange().getValues();
    if (allData.length < 2) return { ok: true, data: null, isNew: true };

    // Fila 2: metadata
    const meta = JSON.parse(allData[1][0] || '{}');

    // Lotes: filas donde col B = "LOTE"
    const lotes = [];
    const ordenes = [];

    for (let i = 2; i < allData.length; i++) {
      const tipo = allData[i][0];
      const json = allData[i][1];
      if (!json) continue;
      try {
        const parsed = JSON.parse(json);
        if (tipo === 'LOTE') lotes.push(parsed);
        else if (tipo === 'ORDEN') ordenes.push(parsed);
      } catch(e) { /* skip bad rows */ }
    }

    return {
      ok: true,
      data: {
        lotes: lotes,
        ordenes: ordenes,
        aplicadores: meta.aplicadores || [],
        campana: meta.campana || '2025/26',
        tiposLabor: meta.tiposLabor || []
      }
    };
  } catch(err) {
    return { ok: false, error: err.message };
  }
}

/* ═══════════════════════════════════════
   SAVE CAMPANA
   Guarda/sobreescribe la hoja del productor
   ═══════════════════════════════════════ */
function saveCampana(payload) {
  if (!payload.productor) return { ok: false, error: 'Falta nombre de productor' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'Camp_' + payload.productor.substring(0, 30).replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ _-]/g, '');
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const campData = payload.data;
  if (!campData) return { ok: false, error: 'Sin datos' };

  // Limpiar hoja
  sheet.clear();

  // Fila 1: headers
  sheet.appendRow(['tipo', 'json', 'updatedAt']);

  // Fila 2: metadata
  const meta = {
    campana: campData.campana || '2025/26',
    aplicadores: campData.aplicadores || [],
    tiposLabor: campData.tiposLabor || []
  };
  sheet.appendRow(['META', JSON.stringify(meta), new Date().toISOString()]);

  // Lotes (una fila por lote)
  (campData.lotes || []).forEach(function(l) {
    sheet.appendRow(['LOTE', JSON.stringify(l), '']);
  });

  // Ordenes (una fila por orden)
  (campData.ordenes || []).forEach(function(o) {
    sheet.appendRow(['ORDEN', JSON.stringify(o), '']);
  });

  return { ok: true, updatedAt: new Date().toISOString(), sheetName: sheetName };
}

/* ═══════════════════════════════════════
   LIST PRODUCTORES
   Devuelve la lista de productores que tienen hoja
   ═══════════════════════════════════════ */
function listProductores() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const productores = [];

  sheets.forEach(function(s) {
    const name = s.getName();
    if (name.startsWith('Camp_')) {
      productores.push(name.substring(5));
    }
  });

  return { ok: true, productores: productores };
}
