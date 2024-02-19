import { Logger } from '@vendure/core';
import axios, { AxiosInstance } from 'axios';
import { loggerCtx } from '../constants';
import {
  AcceptBlueCardPaymentMethod,
  AcceptBlueCustomer,
  AcceptBluePaymentMethod,
  AcceptBlueRecurringSchedule,
  AcceptBlueRecurringScheduleInput,
  AcceptBlueRefundInput,
  AcceptBlueTransaction,
  CreditCardPaymentInput,
} from '../types';
import { isSameCard } from '../util';
import util from 'util';

export class AcceptBlueClient {
  readonly endpoint: string;
  readonly instance: AxiosInstance;

  constructor(
    public readonly apiKey: string,
    public readonly pin: string = '',
  ) {
    if (process.env.ACCEPT_BLUE_TEST_MODE === 'true') {
      this.endpoint = 'https://api.develop.accept.blue/api/v2/';
      Logger.warn(`Using Accept Blue in test mode`, loggerCtx);
    } else {
      this.endpoint = 'https://api.accept.blue/api/v2/';
    }
    this.instance = axios.create({
      baseURL: `${this.endpoint}`,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(
          `${this.apiKey}:${this.pin}`,
        ).toString('base64')}`,
      },
      validateStatus: () => true,
    });
  }

  async getOrCreateCustomer(emailAddress: string): Promise<AcceptBlueCustomer> {
    const existing = await this.getCustomer(emailAddress);
    if (existing) {
      return existing;
    } else {
      Logger.info(`Creating new customer ${emailAddress}`, loggerCtx);
      return await this.createCustomer(emailAddress);
    }
  }

  async getCustomer(
    emailAddress: string,
  ): Promise<AcceptBlueCustomer | undefined> {
    const customers = await this.request(
      'get',
      `customers?active=true&customer_number=${emailAddress}`,
    );
    if (customers.length > 1) {
      throw Error(
        `Multiple customers found for email '${emailAddress}' in Accept Blue. There should be only one.`,
      );
    }
    if (customers[0]) {
      return customers[0];
    }
    return undefined;
  }

  async createCustomer(emailAddress: string): Promise<AcceptBlueCustomer> {
    const customer: Partial<AcceptBlueCustomer> = {
      identifier: emailAddress,
      customer_number: emailAddress,
      email: emailAddress,
      active: true,
    };
    const result = await this.request('post', 'customers', customer);
    Logger.info(`Created new customer '${emailAddress}'`, loggerCtx);
    return result;
  }

  async getOrCreatePaymentMethod(
    acceptBlueCustomerId: number,
    input: CreditCardPaymentInput,
  ): Promise<AcceptBluePaymentMethod> {
    const methods = await this.getPaymentMethods(acceptBlueCustomerId);
    const existing = methods.find((method) =>
      isSameCard(input, method as AcceptBlueCardPaymentMethod),
    );
    if (existing) {
      return existing;
    } else {
      return await this.createPaymentMethod(acceptBlueCustomerId, input);
    }
  }

  async getPaymentMethods(
    acceptBlueCustomerId: number,
  ): Promise<AcceptBluePaymentMethod[]> {
    const result = await this.request(
      'get',
      `customers/${acceptBlueCustomerId}/payment-methods`,
    );
    if (!result) {
      return [];
    }
    return result;
  }

  async createPaymentMethod(
    acceptBlueCustomerId: number,
    input: CreditCardPaymentInput,
  ): Promise<AcceptBluePaymentMethod> {
    const result: AcceptBluePaymentMethod = await this.request(
      'post',
      `customers/${acceptBlueCustomerId}/payment-methods`,
      input,
    );
    Logger.info(
      `Created payment method '${result.payment_method_type}' (${result.id}) for customer '${result.customer_id}'`,
      loggerCtx,
    );
    return result;
  }

  async createRecurringSchedule(
    customerId: number,
    input: AcceptBlueRecurringScheduleInput,
  ): Promise<AcceptBlueRecurringSchedule> {
    const result: AcceptBlueRecurringSchedule = await this.request(
      'post',
      `customers/${customerId}/recurring-schedules`,
      {
        ...input,
        // Accept Blue requires dates to be in 'yyyy-mm-dd' format
        next_run_date: input.next_run_date
          ? this.toDateString(input.next_run_date)
          : undefined,
      },
    );
    Logger.info(
      `Created recurring schedule ${result.id} for customer '${result.customer_id}'`,
      loggerCtx,
    );
    return result;
  }

  async createRefund(
    input: AcceptBlueRefundInput,
  ): Promise<AcceptBlueTransaction> {
    const result: AcceptBlueTransaction = await this.request(
      'post',
      `transactions/refund`,
      input,
    );
    if (result.error_code) {
      Logger.error(
        `Failed creating refund for reference '${input.reference_number}'`,
        loggerCtx,
      );
    } else {
      Logger.info(
        `Created refund with status '${result.status}' for reference '${input.reference_number}'`,
        loggerCtx,
      );
    }
    return result;
  }

  async request(
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    data?: any,
  ): Promise<any | undefined> {
    const result = await this.instance[method](`/${path}`, data);
    if (result.status === 404) {
      Logger.debug(
        `No result found for ${method} to "${path}", returning undefined`,
        loggerCtx,
      );
      return undefined;
    }
    if (result.status >= 400) {
      Logger.error(
        `${method} to "${path}" resulted in: ${result.status} (${
          result.statusText
        }): ${util.inspect(result.data)}`,
        loggerCtx,
        util.inspect(result.data),
      );
      throw Error(result.statusText);
    }
    return result.data;
  }

  /**
   * Transform date to 'yyyy-mm-dd' format for Accept Blue
   */
  toDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
