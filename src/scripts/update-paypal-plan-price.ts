import { updatePlanPricing } from "../util/paypal";

const PAYPAL_PLAN_ID = "P-1JX802074W800650FM6BM2UA";
const NEW_PRICE = 10;
const CURRENCY = "USD";

console.log(`Actualizando plan ${PAYPAL_PLAN_ID} a $${NEW_PRICE} ${CURRENCY} en PayPal...`);

const result = await updatePlanPricing(PAYPAL_PLAN_ID, NEW_PRICE, CURRENCY);
console.log("Éxito:", result);

process.exit(0);
