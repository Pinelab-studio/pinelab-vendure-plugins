import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { Body, Controller, Get, Headers, Res } from '@nestjs/common';
import { Response } from 'express';
// import './dev-server';

interface CommonResult {
  cardType: string; // e.g. Visa
  maskedCard: string;
  maskedCvv2: string;
  expiryMonth: number;
  expiryYear: number;
  last4: string;
}

export interface NonceCardResult extends CommonResult {
  nonce: string;
  surcharge: { type: 'percent' | 'amount'; value: number } | null;
  binType: 'C' | 'D' | null;
  maskedCard: string;
  maskedCvv2: string;

  last4: string;
}

export interface DataResult extends CommonResult {
  avsZip: string;
}

/**
 * Return the Accept Blue Card Tokenization page
 */
@Controller()
export class CheckoutController {
  @Get('checkout')
  async webhook(
    @Headers('X-signature') signature: string | undefined,
    @Res() res: Response,
    @Body() body: any,
  ): Promise<void> {
    res.send(`
<head>
  <title>Checkout</title>
  <script src="https://tokenization.develop.accept.blue/tokenization/v0.2"></script>
</head>
<html>

<form id="payment-form">
  <div>
    <p>Test cards</p>
    <ul>
      <li>Mastercard: 5555 3412 4444 1115 MM/YY: 03/30 CVV2: 737</li>
      <li>Visa: 4111 1111 4555 1142 MM/YY: 03/30 CVV2: 737</li>
    </ul>
  </div>
  <div id="payment-element" style="max-height:50vh;">
    <!-- Elements will create form elements here -->
  </div>
  <button id="submit">Submit</button>
  <div id="error-message" style="border: 2px solid red;min-height:50px;">
    <!-- Display error message to your customers here -->
  </div>
  <div id="nonce-output" style="border: 2px solid green;min-height:50px;">
  </div>
</form>

<script>

// See your keys here: https://dashboard.accept.blue/apikeys

const tokenizationSourceKey = '${
      process.env.ACCEPT_BLUE_TOKENIZATION_SOURCE_KEY ?? ''
    }';
const hostedTokenization = new window.HostedTokenization(tokenizationSourceKey);

const cardForm = hostedTokenization.create('card-form');

cardForm.mount('#payment-element');
cardForm.setStyles({
  name: 'border: 1px solid black',
  card: 'border: 1px solid black',
  expiryMonth: 'border: 1px solid black',
  expiryYear: 'border: 1px solid black',
  cvv2: 'border: 1px solid black',
});

const form = document.getElementById('payment-form');
const output = document.getElementById('nonce-output');

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const result = await cardForm.getNonceToken();

  var pre = document.createElement('pre');
  pre.innerHTML += "{\\n";
  pre.innerHTML += "source: nonce-" + result.nonce + "\\n";
  pre.innerHTML += "name: 'Test user'\\n";
  pre.innerHTML += "expiryMonth: " + result.expiryMonth + "\\n";
  pre.innerHTML += "expiryYear: " + result.expiryYear + "\\n";
  pre.innerHTML += "maskedCard: " + result.maskedCard + "\\n";
  pre.innerHTML += "cardType: " + result.cardType + "\\n";
  pre.innerHTML += "last4: " + result.last4 + "\\n";
  pre.innerHTML += "}";

  output.innerHTML = '';
  output.appendChild(pre)
});
</script>
</html>
    `);
  }
}

/**
 * Test plugin for serving the Stripe intent checkout page
 */
@VendurePlugin({
  imports: [PluginCommonModule],
  controllers: [CheckoutController],
})
export class AcceptBlueTestCheckoutPlugin {}
