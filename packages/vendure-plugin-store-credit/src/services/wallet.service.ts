import { Injectable } from '@nestjs/common';
import {
  Customer,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from '@vendure/core';
import {
  AdjustBalanceForWalletInput,
  CreateWalletInput,
} from '../api/generated/graphql';
import { Wallet } from '../entities/wallet.entity';
import { WalletAdjustment } from '../entities/wallet-adjustment.entity';

@Injectable()
export class WalletService {
  constructor(private readonly connection: TransactionalConnection) {}

  async createWallet(
    ctx: RequestContext,
    input: CreateWalletInput
  ): Promise<Wallet> {
    const customer = await this.connection
      .getRepository(ctx, Customer)
      .findOneOrFail({ where: { id: input.customerId } });
    const wallet = new Wallet({
      customer,
      initialAmount: input.initialBalance as number,
      amount: input.initialBalance as number,
    });
    return this.connection.getRepository(ctx, Wallet).save(wallet);
  }

  async adjustBalanceForWallet(
    ctx: RequestContext,
    input: AdjustBalanceForWalletInput
  ): Promise<Wallet> {
    const walletRepo = this.connection.getRepository(ctx, Wallet);
    const adjustmentRepo = this.connection.getRepository(ctx, WalletAdjustment);

    if (input.adjustmentType === 'CREDIT') {
      const res = await walletRepo
        .createQueryBuilder()
        .update(Wallet)
        .set({ balance: () => `balance + :amount` })
        .where('id = :id', { id: input.walletId })
        .setParameters({ amount: input.amount as number })
        .execute();

      if ((res.affected ?? 0) !== 1) {
        throw new UserInputError('Wallet not found');
      }
    }

    if (input.adjustmentType === 'DEBIT') {
      const res = await walletRepo
        .createQueryBuilder()
        .update(Wallet)
        .set({ balance: () => `balance - :amount` })
        .where('id = :id', { id: input.walletId })
        .andWhere('balance >= :amount')
        .setParameters({ amount: input.amount as number })
        .execute();

      if ((res.affected ?? 0) !== 1) {
        throw new UserInputError('Insufficient wallet balance');
      }
    }

    await adjustmentRepo.save(
      adjustmentRepo.create({
        wallet: { id: input.walletId } as Wallet,
        amount: input.amount as number,
      })
    );

    return walletRepo.findOneOrFail({
      where: { id: input.walletId },
      relations: ['ledgerEntries'],
    });
  }
}
