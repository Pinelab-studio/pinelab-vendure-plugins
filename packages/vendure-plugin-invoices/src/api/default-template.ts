export const defaultTemplate = `
<!DOCTYPE html>
<html style="zoom: 0.55">
  <head>
    <meta charset="utf-8" />
    <title>Order {{ order.code }}</title>
  </head>
  <body style="font-family: Arial, Helvetica, sans-serif">
    <table style="width: 100%">
      <tr>
        <td>
          <br />
          <br />
          https://pinelab.studio<br />
          Thanks for your order at Pinelab.studio!
        </td>
      </tr>
    </table>

    <hr />
    
    <br />
    <br />
    <br />

    <table style="width: 100%">
      <tr>
        <td>
          {{#with order.address }} 
          {{ fullName }}<br />
          {{#if company}} {{ company }}<br />
          {{/if}} {{#if streetLine1}} {{ streetLine1 }} {{ streetLine2 }}<br />
          {{/if}} {{#if postalCode}} {{ postalCode }}, {{ city }}<br />
          {{/if}} {{#if country}} {{ country }}<br />
          {{/if}} {{/with}}
          {{ customerEmail }}<br />
        </td>
        <td>
          Order: {{ order.code }} <br />
          InvoiceNr: {{ invoiceNumber }} <br />
          Date: {{ orderDate }}
        </td>
      </tr>
    </table>

    <br />
    <br />
    <br />

    <table style="width: 100%">
      {{#each order.lines }}
      <tr>
        <td>{{ quantity }} x</td>
        <td>{{ productVariant.sku }} {{ productVariant.name }}</td>
        <td style="text-align: right">€{{ formatMoney linePriceWithTax }}</td>
      </tr>
      {{/each}} {{#each order.discounts }}
      <tr>
        <td></td>
        <td>{{ description }}</td>
        <td style="text-align: right">€{{ formatMoney amount }}</td>
      </tr>
      {{/each}}

      <tr>
        <td>&nbsp;</td>
      </tr>
      <tr>
        <td></td>
        <td>Shipping with tax</td>
        <td style="text-align: right">
          €{{ formatMoney order.shippingWithTax }}
        </td>
      </tr>

      <tr></tr>
    </table>

    <hr />

    <table style="width: 100%">
      <tr>
        <td style="text-align: right">Subtotal </td>
        <td style="text-align: right">€{{ formatMoney order.total }}</td>
      </tr>

      <tr style="text-align: right">
        <td><strong>Total inc. tax</strong></td>
        <td style="text-align: right">
          <strong>€{{ formatMoney order.totalWithTax }}</strong>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
