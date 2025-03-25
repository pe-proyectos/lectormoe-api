const environment =
  process.env.PAYPAL_ENV === "live"
    ? {
        clientId: process.env.PAYPAL_CLIENT_ID,
        clientSecret: process.env.PAYPAL_CLIENT_SECRET,
        url: "https://api.paypal.com/v1",
      }
    : {
        clientId: process.env.PAYPAL_CLIENT_ID,
        clientSecret: process.env.PAYPAL_CLIENT_SECRET,
        url: "https://api-m.sandbox.paypal.com/v1",
      };

async function getAccessToken(): Promise<string> {
  const authString = `${environment.clientId}:${environment.clientSecret}`;
  const encodedAuth = btoa(authString);

  const response = await fetch(`${environment.url}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${encodedAuth}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("Error al obtener el token de acceso:", error);
    throw new Error("Failed to obtain PayPal access token.");
  }

  const data = await response.json();
  return data.access_token;
}

export async function createProduct(name: string, description: string) {
  const token = await getAccessToken();

  const response = await fetch(`${environment.url}/catalogs/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name,
      description,
      type: "SERVICE",
      category: "SOFTWARE",
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("Error al crear el producto:", error);
    throw new Error("Failed to create PayPal product.");
  }

  const product = await response.json();
  console.log("Producto creado:", product);
  return product;
}

export async function updateProduct(
  productId: string,
  name: string,
  description: string
) {
  const token = await getAccessToken();

  const response = await fetch(
    `${environment.url}/catalogs/products/${productId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify([
        {
          op: "replace",
          path: "/name",
          value: name,
        },
        {
          op: "replace",
          path: "/description",
          value: description,
        },
      ]),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error("Error al actualizar el producto:", error);
    throw new Error("Failed to update PayPal product.");
  }

  const updatedProduct = await response.json();
  console.log("Producto actualizado:", updatedProduct);
  return updatedProduct;
}

type CreatePlanParams = {
  productId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: "DAY" | "WEEK" | "MONTH" | "YEAR";
};

export async function createPlan(params: CreatePlanParams) {
  const token = await getAccessToken();

  const response = await fetch(`${environment.url}/billing/plans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      product_id: params.productId,
      name: params.name,
      description: params.description,
      billing_cycles: [
        {
          frequency: {
            interval_unit: params.interval,
            interval_count: 1,
          },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: {
              value: params.price.toFixed(2),
              currency_code: params.currency,
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: {
          value: "0",
          currency_code: params.currency,
        },
        setup_fee_failure_action: "CANCEL",
        payment_failure_threshold: 3,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("Error al crear el plan:", error);
    throw new Error("Failed to create PayPal plan.");
  }

  const plan = await response.json();
  console.log("Plan creado:", plan);
  return plan;
}

export async function updatePlan(
  planId: string,
  name: string,
  description: string
) {
  const token = await getAccessToken();

  const response = await fetch(`${environment.url}/billing/plans/${planId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify([
      {
        op: "replace",
        path: "/name",
        value: name,
      },
      {
        op: "replace",
        path: "/description",
        value: description,
      },
    ]),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("Error al actualizar el plan:", error);
    throw new Error("Failed to update PayPal plan.");
  }

  const updatedPlan = await response.json();
  console.log("Plan actualizado:", updatedPlan);
  return updatedPlan;
}

export async function getPlanById(planId: string) {
  const token = await getAccessToken();

  const response = await fetch(`${environment.url}/billing/plans/${planId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("Error al obtener el plan:", error);
    throw new Error("Failed to get PayPal plan.");
  }

  const plan = await response.json();
  console.log("Plan obtenido:", plan);
  return plan;
}

export async function getSubscriptionByPaypalId(paypalSubscriptionId: string) {
  const token = await getAccessToken();

  const response = await fetch(`${environment.url}/billing/subscriptions/${paypalSubscriptionId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("Error al obtener la suscripción:", error);
    throw new Error("Failed to get PayPal subscription.");
  }

  const subscription = await response.json();
  console.log("Suscripción obtenida:", subscription);
  return subscription;
}

export async function getTransactionsOfSubscription(paypalSubscriptionId: string) {
  const token = await getAccessToken();

  const startTime = new Date('2024-08-26').toISOString();
  const endTime = new Date().toISOString();

  const response = await fetch(
    `${environment.url}/billing/subscriptions/${paypalSubscriptionId}/transactions?start_time=${startTime}&end_time=${endTime}`,
    {
      method: "GET", 
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error("Error al obtener las transacciones:", error);
    throw new Error("Failed to get PayPal subscription transactions.");
  }

  const { transactions } = await response.json();
  console.log("Transacciones obtenidas:", transactions);
  return transactions;
}

export async function suspendSubscriptionByPaypalId(paypalSubscriptionId: string) {
  const token = await getAccessToken();

  const response = await fetch(`${environment.url}/billing/subscriptions/${paypalSubscriptionId}/suspend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("Error al suspender la suscripción:", error);
    throw new Error("Failed to suspend PayPal subscription.");
  }

  const updatedSubscription = await response.json();
  console.log("Suscripción actualizada:", updatedSubscription);
  return updatedSubscription;
}

export async function resumeSubscriptionByPaypalId(paypalSubscriptionId: string) {
  const token = await getAccessToken();

  const response = await fetch(`${environment.url}/billing/subscriptions/${paypalSubscriptionId}/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("Error al activar la suscripción:", error);
    throw new Error("Failed to resume PayPal subscription.");
  }

  const updatedSubscription = await response.json();
  console.log("Suscripción actualizada:", updatedSubscription);
  return updatedSubscription;
}
