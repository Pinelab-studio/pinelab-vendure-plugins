import { INestApplication } from '@nestjs/common';
import {
  AdministratorService,
  Customer,
  CustomerService,
  Logger,
  RequestContext,
  RequestContextService,
} from '@vendure/core';
import { asError } from 'catch-unknown';
import { loggerCtx } from '../constants';
import { Wallet } from '../entities/wallet.entity';
import { WalletService } from './wallet.service';

/**
 * Creates wallets with the given balance for customers.
 * When emailAddresses is omitted, wallets are created for all customers.
 *
 * @param app - NestJS INestApplication instance (Vendure server application)
 * @param walletDetails - Wallet details: name, balance (minor units), balanceDescription
 * @param actAsAdministratorEmailAddress - The administrator's email address used for record-keeping
 * @param emailAddresses - Optional list of customer email addresses. If omitted, all customers are processed
 * @param batchSize - Number of customers to process per batch (default 50)
 * @returns Array of the created Wallet entities
 */
export async function createWalletsForCustomers(
  app: INestApplication<unknown>,
  walletDetails: {
    name: string;
    balance: number;
    balanceDescription: string;
  },
  actAsAdministratorEmailAddress: string,
  emailAddresses?: string[],
  batchSize = 50,
): Promise<Wallet[]> {
  let ctx = await app.get(RequestContextService).create({
    apiType: 'admin',
  });
  const customerService = app.get(CustomerService);
  const administratorService = app.get(AdministratorService);
  const walletService = app.get(WalletService);

  const {
    items: [administrator],
  } = await administratorService.findAll(
    ctx,
    {
      filter: { emailAddress: { eq: actAsAdministratorEmailAddress } },
    },
    ['user'],
  );

  if (!administrator) {
    throw new Error(
      `No administrator found for email: ${actAsAdministratorEmailAddress}. Can not create wallets`,
    );
  }

  // Execute all operations from here on as '
  ctx = await app.get(RequestContextService).create({
    apiType: 'admin',
    user: administrator.user,
  });

  // Find customers that should have a wallet created
  const customers = await findWalletCustomers(
    ctx,
    customerService,
    emailAddresses,
    batchSize,
  );

  const createdWallets: Wallet[] = [];
  for (let i = 0; i < customers.length; i += batchSize) {
    const batch = customers.slice(i, i + batchSize);
    for (const customer of batch) {
      try {
        const wallet = await walletService.create(ctx, {
          customerId: customer.id,
          name: walletDetails.name,
        });
        if (walletDetails.balance > 0) {
          const [updatedWallet] = await walletService.adjustBalanceForWallet(
            ctx,
            walletDetails.balance,
            wallet.id,
            walletDetails.balanceDescription,
          );
          createdWallets.push(updatedWallet);
        } else {
          createdWallets.push(wallet);
        }
      } catch (e) {
        const error = asError(e);
        Logger.error(
          `Error creating wallet for customer '${customer.emailAddress}': ${error.message}`,
          loggerCtx,
        );
      }
    }
  }
  Logger.info(
    `Created ${createdWallets.length} wallets for ${customers.length} customers by ${administrator.emailAddress}`,
    loggerCtx,
  );

  return createdWallets;
}

/** Loads requested customers in batches, or all customers when no emails are supplied. */
async function findWalletCustomers(
  ctx: RequestContext,
  service: CustomerService,
  emails: string[] | undefined,
  batchSize: number,
): Promise<Customer[]> {
  const customers: Customer[] = [];
  if (emails?.length) {
    for (let i = 0; i < emails.length; i += batchSize) {
      const result = await service.findAll(ctx, {
        filter: { emailAddress: { in: emails.slice(i, i + batchSize) } },
        take: batchSize,
      });
      customers.push(...result.items);
    }
    const found = new Set(customers.map((c) => c.emailAddress));
    for (const email of emails) {
      if (!found.has(email))
        Logger.warn(`Customer not found for email: ${email}`, loggerCtx);
    }
  } else {
    let skip = 0;
    let hasMore = true;
    while (hasMore) {
      const result = await service.findAll(ctx, { take: batchSize, skip });
      customers.push(...result.items);
      hasMore = result.items.length === batchSize;
      skip += batchSize;
    }
  }
  return customers;
}
