// import { INestApplication } from '@nestjs/common';
// import { DataSource } from 'typeorm';
// import { ID, OrderLine } from '@vendure/core';
// import { FPGrowth, Itemset } from 'node-fpgrowth';

// export async function getFrequentlyBoughtTogetherItemSets(
//   app: INestApplication
// ): Promise<void> {
//   const dataSource = app.get(DataSource);
//   const repository = await dataSource.getRepository(OrderLine);

//   const ordersSince = new Date();
//   ordersSince.setFullYear(ordersSince.getFullYear() - 5);
//   const channelId = 1;
//   const languageCode = 'nl';

//   const result = await repository
//     .createQueryBuilder('orderLine')
//     .innerJoinAndSelect('orderLine.productVariant', 'productVariant')
//     .innerJoinAndSelect('productVariant.translations', 'pvTranslations')
//     .innerJoin('orderLine.order', 'order')
//     .innerJoin('order.channels', 'channel')
//     .where('order.orderPlacedAt >= :ordersSince', { ordersSince })
//     .andWhere('channel.id = :channelId', { channelId })
//     .andWhere('productVariant.deletedAt IS NULL')
//     .andWhere('pvTranslations.languageCode = :languageCode', { languageCode })
//     .select(['orderLine.*', 'productVariant.id', 'pvTranslations.name'])
//     .getRawMany();

//   const identifyingField = 'pvTranslations_name'; // Use productVariant_id for production

//   const transactions = new Map<ID, string[]>();
//   result.forEach((orderLine) => {
//     const transactionsForOrder = transactions.get(orderLine.orderId) || [];
//     transactionsForOrder.push(orderLine[identifyingField]);
//     transactions.set(orderLine.orderId, transactionsForOrder);
//   });
//   const matrix = Array.from(transactions.values());
//   console.log('calculating frequent itemsets');
//   const fpgrowth = new FPGrowth<string>(0.001);
//   const itemSets = (await fpgrowth.exec(matrix))
//     // Only combinations allowed
//     .filter((is) => is.items.length > 1)
//     // Lowest support first, because if they make sense, the higher ones will too
//     .sort((a, b) => a.support - b.support)
//     .reverse();

//   console.log('frequent itemsets:', itemSets);
//   console.log('Total item sets', itemSets.length);
// }
