import { app } from "./app";

const server = app.listen(Number.parseInt(process.env.PORT as string));

console.info(
	`🦊 Elysia is running at ${server.server?.hostname}:${server.server?.port}`,
);

// Suscripcion Capibara: crea en PayPal y en la base de datos los planes que
// falten. Corre en el servidor porque es quien tiene las credenciales de
// PayPal. Es idempotente (identifica cada plan por su slug): si ya existen no
// hace nada, y si una ejecucion anterior fallo a mitad, completa lo que falte.
// No bloquea el arranque: si PayPal no responde, se reintenta en el siguiente.
import("./services/capibara-bootstrap")
	.then(({ asegurarPlanesCapibara }) => asegurarPlanesCapibara())
	.then((r) => {
		if (r.creados.length > 0) console.info(`[capibara] planes creados en PayPal: ${r.creados.join(", ")}`);
		else console.info(`[capibara] planes ya existentes: ${r.existian.length}`);
	})
	.catch((e) => console.error("[capibara] no se pudieron crear los planes:", e?.message || e));
