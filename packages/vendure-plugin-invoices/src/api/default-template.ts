export const defaultTemplate = `
<!DOCTYPE html>
<html style="zoom: 0.55">
  <head>
    <meta charset="utf-8" />
    <title>Bestelling {{ order.code }}</title>
  </head>
  <body style="font-family: Arial, Helvetica, sans-serif">
    <table style="width: 100%">
      <tr>
        <td>
          <br />
          <br />
          Wormenkwekerij Wasse<br />
          Reikampen 6<br />
          9415 RB, Hijken<br />
          Kvk: 66626811<br />
          Btw nr: NL001413015b26<br />
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
          {{#with order.address }} {{ fullName }}<br />
          {{#if company}} {{ company }}<br />
          {{/if}} {{#if streetLine1}} {{ streetLine1 }} {{ streetLine2 }}<br />
          {{/if}} {{#if postalCode}} {{ postalCode }}, {{ city }}<br />
          {{/if}} {{#if country}} {{ country }}<br />
          {{/if}} {{/with}}
        </td>
        <td>
          Bestelnummer: {{ order.code }} <br />
          Datum: {{ order.orderPlacedAt }}
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
        <td>Verzendkosten</td>
        <td style="text-align: right">
          €{{ formatMoney order.shippingWithTax }}
        </td>
      </tr>

      <tr></tr>
    </table>

    <hr />

    <table style="width: 100%">
      <tr>
        <td style="text-align: right">Totaal Excl.</td>
        <td style="text-align: right">€{{ formatMoney order.total }}</td>
      </tr>

      <tr style="text-align: right">
        <td><strong>Totaal Incl.</strong></td>
        <td style="text-align: right">
          <strong>€{{ formatMoney order.totalWithTax }}</strong>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
