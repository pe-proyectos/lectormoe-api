/**
 * PayPal Webhook Signature Verification
 *
 * This module verifies that webhook events actually come from PayPal
 * to prevent unauthorized access and subscription manipulation.
 */

import crypto from 'crypto';

interface WebhookVerificationHeaders {
    'paypal-transmission-id': string;
    'paypal-transmission-time': string;
    'paypal-transmission-sig': string;
    'paypal-cert-url': string;
    'paypal-auth-algo': string;
}

/**
 * Verify PayPal webhook signature
 *
 * @param headers - Request headers from PayPal webhook
 * @param body - Raw webhook body
 * @param webhookId - Your PayPal webhook ID from environment
 * @returns true if signature is valid
 */
export async function verifyPayPalWebhookSignature(
    headers: WebhookVerificationHeaders,
    body: any,
    webhookId: string
): Promise<boolean> {
    try {
        const {
            'paypal-transmission-id': transmissionId,
            'paypal-transmission-time': transmissionTime,
            'paypal-transmission-sig': transmissionSig,
            'paypal-cert-url': certUrl,
            'paypal-auth-algo': authAlgo,
        } = headers;

        // Validate required headers
        if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
            console.error('Missing required PayPal webhook headers');
            return false;
        }

        // Validate cert URL is from PayPal
        if (!certUrl.startsWith('https://api.paypal.com/') && !certUrl.startsWith('https://api.sandbox.paypal.com/')) {
            console.error('Invalid PayPal cert URL:', certUrl);
            return false;
        }

        // Fetch the certificate from PayPal
        const certResponse = await fetch(certUrl);
        if (!certResponse.ok) {
            console.error('Failed to fetch PayPal certificate');
            return false;
        }
        const certPem = await certResponse.text();

        // Create the expected signature string
        const expectedSig = `${transmissionId}|${transmissionTime}|${webhookId}|${crc32(JSON.stringify(body))}`;

        // Verify the signature
        const verifier = crypto.createVerify(authAlgo);
        verifier.update(expectedSig);

        const isValid = verifier.verify(certPem, transmissionSig, 'base64');

        if (!isValid) {
            console.error('PayPal webhook signature verification failed');
            console.error('Expected signature string:', expectedSig);
        }

        return isValid;
    } catch (error) {
        console.error('Error verifying PayPal webhook signature:', error);
        return false;
    }
}

/**
 * Calculate CRC32 checksum (required by PayPal)
 */
function crc32(str: string): number {
    const table = makeCRCTable();
    let crc = 0 ^ (-1);

    for (let i = 0; i < str.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ str.charCodeAt(i)) & 0xFF];
    }

    return (crc ^ (-1)) >>> 0;
}

function makeCRCTable(): number[] {
    let c: number;
    const crcTable: number[] = [];

    for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) {
            c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        crcTable[n] = c;
    }

    return crcTable;
}
