// Monetag Publisher API v5
//   POST https://api.monetag.com/v5/pub/statistics
//        Authorization: Bearer <MONETAG_API_TOKEN>
//        { date_from, date_to, group_by: ['date_time'], page, page_size <= 500 }
//        -> result[].money
// El token de la API de Monetag es de solo lectura (no puede gastar ni retirar).
//
// Como el de Adcash, LANZA un error si falta el token o la API falla: el
// reparto mensual no se puede rehacer una vez guardado.

const BASE = 'https://api.monetag.com/v5';
const pad2 = (n: number) => n.toString().padStart(2, '0');
const fecha = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;

/** Ingresos de Monetag (USD) del mes indicado. `monthIndex` es 0-11. */
export async function fetchMonetagRevenue(year: number, monthIndex: number): Promise<number> {
  const token = process.env.MONETAG_API_TOKEN;
  if (!token) throw new Error('[Monetag] Falta MONETAG_API_TOKEN en el entorno del servidor.');
  const desde = fecha(new Date(Date.UTC(year, monthIndex, 1)));
  const hasta = fecha(new Date(Date.UTC(year, monthIndex + 1, 0)));

  let total = 0;
  let filas = 0;
  for (let page = 1; page <= 50; page++) {
    const res = await fetch(`${BASE}/pub/statistics`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ date_from: desde, date_to: hasta, group_by: ['date_time'], page, page_size: 500 }),
    });
    if (!res.ok) throw new Error(`[Monetag] Las estadisticas fallaron (${res.status}).`);
    const json: any = await res.json();
    const lote: any[] = json?.result ?? [];
    for (const r of lote) {
      const v = Number.parseFloat(String(r?.money ?? '0'));
      if (Number.isFinite(v)) total += v;
    }
    filas += lote.length;
    if (lote.length < 500) break;
  }
  console.log(`[Monetag] ${year}-${pad2(monthIndex + 1)}: $${total.toFixed(2)} (${filas} filas)`);
  return total;
}
