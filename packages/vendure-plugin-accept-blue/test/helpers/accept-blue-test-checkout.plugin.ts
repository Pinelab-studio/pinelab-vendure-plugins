import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { Body, Controller, Get, Headers, Res } from '@nestjs/common';
import { Response } from 'express';
import fs from 'fs/promises';
import Handlebars from 'handlebars';

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
 * Return a test checkout page to test payments.
 * Includes Accept Blue tokenization and Google Pay test
 */
@Controller()
export class CheckoutController {
  // Returns the Accept Blue Hosted tokenization form
  @Get('checkout')
  async checkout(
    @Headers('X-signature') signature: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    // Load HTML file
    const html = await fs.readFile(
      `${__dirname}/hosted-tokenization.html`,
      'utf8'
    );
    // Replace variables with handlebars
    const renderedHtml = Handlebars.compile(html)({
      acceptBlueTokenizationKey:
        process.env.ACCEPT_BLUE_TOKENIZATION_SOURCE_KEY,
    });
    res.send(renderedHtml);
  }

  // Returns a test google Pay form
  @Get('google-pay')
  async googlePay(
    @Headers('X-signature') signature: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    // Load HTML file
    const html = await fs.readFile(`${__dirname}/google-pay.html`, 'utf8');
    // Replace variables with handlebars
    const renderedHtml = Handlebars.compile(html)({});
    res.send(renderedHtml);
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
