require('dotenv').config();
import Coinbase from 'coinbase-commerce-node';

(async () => {
  // const client = Coinbase.Client.init(process.env.COINBASE_APIKEY!);

  const result = await Coinbase.resources.Charge.create({
    name: 'Steven S',
    description: 'Cryptherion wallet',
    local_price: {
      amount: '88.00',
      currency: 'EUR',
    },
    pricing_type: 'fixed_price',
  });
  console.log('RESS', result);
})();
