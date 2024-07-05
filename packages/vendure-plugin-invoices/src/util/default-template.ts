export const defaultTemplate = `
<!DOCTYPE html>
<html style="margin: 0px">
  <head>
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Ubuntu:ital,wght@0,200,700&display=swap"
    />
    <meta charset="utf-8" />
    <style>
      body {
        font-family: "Ubuntu", sans-serif;
        font-weight: 300;
        font-size: 0.6rem;
      }
      table td,
      table td * {
        vertical-align: top;
      }
      h6 {
        font-size: 0.6rem;
        margin: 0;
      }
      h4 {
        font-size: 0.6rem;
        margin: 0;
      }
      h5 {
        font-size: 0.6rem;
        margin: 0;
      }
      h20 {
        font-size: 0.6rem;
        font-weight: 300;
      }

      .product-info {
        width: 30%;
      }

      .vat-info {
        width: 5%;
      }

      .subtotal-info {
        float: right;
      }

      .stick-to-top {
        vertical-align: top;
      }

      .order-line > td {
        padding: 0.6em 0;
      }
    </style>
    <title>Order: {{ order.code }}</title>
  </head>

  <body style="width: 100%">
    <!-- INVOICE INFO + LOGO -->

    <table style="width: 96%">
      <tr>
        <td id="invoice-info">
          {{#if isCreditInvoice}}
          <h1>Credit invoice</h1>
          {{else}}
          <h1>Invoice</h1>
          {{/if}}
          <h20><strong>Order Date: </strong>{{ orderDate }}</h20><br />
          <h20><strong>Order: </strong>{{ order.code }}</h20><br />
          <h20><strong>Invoice Number: </strong>{{ invoiceNumber }}</h20><br />
          {{#if originalInvoiceNumber}}
          <h20
            ><strong>Credit for Invoice: </strong>{{ originalInvoiceNumber
            }}</h20
          ><br />
          {{/if}}
        </td>
        <td id="logo">
          <img
            src="https://pinelab.studio/pinelab.png"
            style="height: 50px; float: right"
          />
        </td>
      </tr>
    </table>

    <hr />
    <!-- LINE -->

    <!--CLIENT INFO + COMPANY INFO -->

    <br />
    <br />
    <table style="width: 100%">
      <tr>
        <td id="shipping-info">
          <h4>Shipping Info</h4>
          <h20
            >{{#with order.shippingAddress }} {{ fullName }}<br />
            {{#if company}} {{ company }}<br />
            {{/if}} {{#if streetLine1}} {{ streetLine1 }} {{ streetLine2 }}<br />
            {{/if}} {{#if postalCode}} {{ postalCode }}, {{ city }}<br />
            {{/if}} {{#if country}} {{ country }}<br />
            {{/if}} {{/with}}
          </h20>
        </td>
        <td id="billing-info">
          {{#if order.billingAddress.streetLine1}}
          <h4>Billing Info</h4>
          <h20
            >{{#with order.billingAddress }} {{ fullName }}<br />
            {{#if company}} {{ company }}<br />
            {{/if}} {{#if streetLine1}} {{ streetLine1 }} {{ streetLine2 }}<br />
            {{/if}} {{#if postalCode}} {{ postalCode }}, {{ city }}<br />
            {{/if}} {{#if country}} {{ country }}<br />
            {{/if}} {{/with}}
          </h20>
          {{/if}}
        </td>
      </tr>
    </table>
    <br />
    <br />

    <!-- Don't render order lines for credit invoices, just the totals -->
    {{#unless isCreditInvoice}}

    <!-- PRODUCTS, QUANTITY, AMOUNT IN -->
    <table style="width: 96%">
      <tr>
        <td class="product-info">
          <h4>Product</h4>
        </td>
        <td class="quantity-info">
          <h4>Qty</h4>
        </td>
        <td class="subtotal-info">
          <h4>Total</h4>
        </td>
      </tr>
    </table>

    <hr />
    <!-- LINE -->

    <!-- PRODUCT INFO -->

    <table style="width: 96%">
      {{#each order.lines }}
      <tr class="order-line">
        <td class="product-info stick-to-top">{{ productVariant.name }}</td>
        <td class="quantity-info">{{ quantity }}</td>
        <td class="subtotal-info">€ {{ formatMoney discountedLinePrice }}</td>
      </tr>
      {{/each}}

      <!-- SHIPPING COSTS -->

      {{#each order.shippingLines }}
      <tr>
        <td class="product-info"><strong>{{ shippingMethod.name }}</strong></td>
        <td class="quantity-info"></td>
        <td class="subtotal-info"><h20>€ {{ formatMoney price }}</h20></td>
      </tr>
      {{/each}}

      <!-- DISCOUNT -->

      {{#each order.discounts }}
      <tr>
        <td class="product-info"><h20>{{ description }}</h20></td>
        <td class="quantity-info"></td>
        <td class="subtotal-info"><h20>£{{ formatMoney amount }}</h20></td>
      </tr>
      {{/each}}
    </table>

    {{/unless}}

    <hr />
    <!-- LINE -->

    <!-- TAX INFO - (SUB)TOTAL PRICE -->

    <table style="width: 96%">
      <tr>
        <td id="tax-information" style="width: 50%">
          {{#if payment.metadata.method }}
          <h6>Paid with:</h6>
          {{ payment.metadata.method }} {{/if}} {{#each order.taxSummary }}
          {{#if taxTotal }}
          <h6>{{ description }}:</h6>
          {{ taxRate }}%: € {{ formatMoney taxTotal }} {{/if}} {{/each}}
        </td>
        <td id="total-amount ">
          <h5>Total Excl. Tax: € {{ formatMoney order.total }}</h5>
          <h2>Total: € {{ formatMoney order.totalWithTax }}</h2>
        </td>
      </tr>
    </table>
    <hr />
    <!-- LINE -->
    <td style="float: right"></td>

    <br />
    <br />

    <!-- COMPANY DETAILS -->

    <table style="width: 96%; margin-top: 20px">
      <tr>
        <td style="width: 60%; float: top">
          <b>Company Registration:</b> 767302223 <br />
          <b>VAT ID:</b> NL840334343<br />
          <b>Email:</b> martijn@pinelab.studio<br />
        </td>
        <td>
          <b>Pinelab</b><br />
          Pinestreet<br />
          Leeuwarden<br />
          XXXX Postalcode<br />
          The Netherlands<br />
          Tel: +31 111118888
        </td>
      </tr>
    </table>
  </body>
</html>

`;
