// Adcash Publisher Reporting API v2
// Docs: https://support.adcash.com/en/articles/424-publisher-reporting-api-v-2
//
//   POST https://adcash.myadcash.com/api/v2/auth/token   { api_token }
//        -> data.access_token (Bearer, valido 15 minutos)
//   GET  https://adcash.myadcash.com/api/v2/publishers/reports
//        ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&group_by=month
//        -> data.rows[].earnings (texto), meta.currency (la cuenta puede ir en EUR)
//
// A diferencia de los conectores antiguos, este LANZA un error si falta el
// token o la API falla. El reparto mensual no se puede rehacer una vez
// guardado, asi que es preferible detenerlo (y relanzarlo al arreglarlo) que
// repartir de menos en silencio.

import { convertirAUsd } from './fx';

const BASE = 'https://adcash.myadcash.com/api/v2';

const pad2 = (n: number) => n.toString().padStart(2, '0');
const fecha = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;

async function tokenDeAcceso(): Promise<string> {
  const apiToken = process.env.ADCASH_API_TOKEN;
  if (!apiToken) throw new Error('[Adcash] Falta ADCASH_API_TOKEN en el entorno del servidor.');
  const res = await fetch(`${BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ api_token: apiToken }),
  });
  if (!res.ok) throw new Error(`[Adcash] No se pudo autenticar (${res.status}).`);
  const json: any = await res.json();
  const token = json?.data?.access_token;
  if (!token) throw new Error('[Adcash] La autenticacion no devolvio access_token.');
  return token;
}

/**
 * Ingresos de Adcash (en USD) del mes indicado.
 * @param monthIndex 0-11, como Date.prototype.getMonth()
 */
export async function fetchAdcashRevenue(year: number, monthIndex: number): Promise<number> {
  const token = await tokenDeAcceso();
  const inicio = fecha(new Date(Date.UTC(year, monthIndex, 1)));
  const fin = fecha(new Date(Date.UTC(year, monthIndex + 1, 0)));

  let total = 0;
  let moneda = 'USD';
  const limit = 500;
  for (let offset = 0; offset < 50_000; offset += limit) {
    const url = `${BASE}/publishers/reports?start_date=${inicio}&end_date=${fin}&group_by=month&limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`[Adcash] El informe fallo (${res.status}).`);
    const json: any = await res.json();
    const filas: any[] = json?.data?.rows ?? [];
    moneda = json?.meta?.currency || moneda;
    for (const f of filas) {
      const v = Number.parseFloat(String(f?.earnings ?? '0'));
      if (Number.isFinite(v)) total += v;
    }
    const totalFilas = Number(json?.meta?.pagination?.total ?? filas.length);
    if (filas.length < limit || offset + limit >= totalFilas) break;
  }

  const usd = await convertirAUsd(total, moneda, new Date(Date.UTC(year, monthIndex + 1, 0)));
  console.log(`[Adcash] ${year}-${pad2(monthIndex + 1)}: ${total.toFixed(2)} ${moneda} = $${usd.toFixed(2)}`);
  return usd;
}
