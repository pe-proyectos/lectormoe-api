// Conversion a dolares con el tipo de cambio oficial del BCE (Frankfurter,
// gratuito y sin clave). Se usa el tipo del ultimo dia del mes del reparto.
// Si falla, LANZA: repartir con un tipo inventado seria peor que no repartir.

export async function convertirAUsd(importe: number, moneda: string, dia: Date): Promise<number> {
  const m = (moneda || 'USD').toUpperCase();
  if (m === 'USD' || importe === 0) return importe;
  const d = dia.toISOString().slice(0, 10);
  const res = await fetch(`https://api.frankfurter.dev/v1/${d}?from=${m}&to=USD`);
  if (!res.ok) throw new Error(`[fx] No se pudo obtener el tipo ${m}->USD del ${d} (${res.status}).`);
  const json: any = await res.json();
  const tasa = Number(json?.rates?.USD);
  if (!(tasa > 0)) throw new Error(`[fx] Tipo ${m}->USD invalido para ${d}.`);
  return importe * tasa;
}
