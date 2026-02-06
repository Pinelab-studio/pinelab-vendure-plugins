import { INestApplication } from '@nestjs/common';
import {
  AdministratorService,
  Customer,
  CustomerService,
  Logger,
  RequestContextService,
} from '@vendure/core';
import { loggerCtx } from '../constants';
import { Wallet } from '../entities/wallet.entity';
import { WalletService } from './wallet.service';
import { asError } from 'catch-unknown';

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
  batchSize = 50
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
    ['user']
  );

  if (!administrator) {
    throw new Error(
      `No administrator found for email: ${actAsAdministratorEmailAddress}. Can not create wallets`
    );
  }

  // Execute all operations from here on as '
  ctx = await app.get(RequestContextService).create({
    apiType: 'admin',
    user: administrator.user,
  });

  // Find customers that should have a wallet created
  const customers: Customer[] = [];
  if (emailAddresses?.length) {
    for (let i = 0; i < emailAddresses.length; i += batchSize) {
      const batch = emailAddresses.slice(i, i + batchSize);
      const result = await customerService.findAll(ctx, {
        filter: { emailAddress: { in: batch } },
        take: batchSize,
      });
      customers.push(...result.items);
    }
    const foundEmails = new Set(customers.map((c) => c.emailAddress));
    for (const email of emailAddresses) {
      if (!foundEmails.has(email)) {
        Logger.warn(`Customer not found for email: ${email}`, loggerCtx);
      }
    }
  } else {
    let skip = 0;
    let hasMore = true;
    while (hasMore) {
      const result = await customerService.findAll(ctx, {
        take: batchSize,
        skip,
      });
      customers.push(...result.items);
      hasMore = result.items.length === batchSize;
      skip += batchSize;
    }
  }

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
            walletDetails.balanceDescription
          );
          createdWallets.push(updatedWallet);
        } else {
          createdWallets.push(wallet);
        }
      } catch (e) {
        const error = asError(e);
        Logger.error(
          `Error creating wallet for customer '${customer.emailAddress}'}: ${error.message}`,
          loggerCtx
        );
      }
    }
  }
  Logger.info(
    `Created ${createdWallets.length} wallets for ${customers.length} customers by ${administrator.emailAddress}`,
    loggerCtx
  );

  return createdWallets;
}
