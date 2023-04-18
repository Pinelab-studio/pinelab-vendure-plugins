import crypto from 'crypto';

/**
 * Create signature to test incoming webhook
 */
export function createSignature(body: any, apiKey: string): string {
    // Create webhook secret from apiKey
    const webhookSecret = crypto
        .createHash('shake256', { outputLength: 10 })
        .update(apiKey)
        .digest('hex');
    // Create signature from webhook secret
    return crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(body))
        .digest('base64');
}