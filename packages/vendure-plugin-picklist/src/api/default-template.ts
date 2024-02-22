export const defaultTemplate = `

<!DOCTYPE html>
<html style="margin: 0;">

<head>
    <meta charset="utf-8" />
        <style>
            @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap');

            h1 {
                font-size: 1.9rem;
                margin: 0.5rem;
            }
            h6 {
                font-size: 0.6rem;
                margin: 0;
            }
            h4 {
                font-size: 0.8rem;
            }
            h5 {
                font-size: 0.8rem;
                margin: 0;
            }
            h3 {
                font-size: 1.2rem;
            }
            div {
                font-size: 0.8rem;
                color: #00000080;
                font-weight: normal;
            }

            .quantity-info {
                width: 10%;
            }

            .product-info {
                width: 58%;
            }

            .vat-info {
                width: 20%;
            }

            .subtotal-info {
                width: 20%;
            }
            



        </style>
    <title>Order: {{ order.code }}</title>
</head>

<body style="font-family: IBM Plex Mono, Arial, Helvetica, sans-serif; width: 100%;">

        <!-- PICKLIST INFO + LOGO -->

        <table style="width: 96%">
            <tr>
                <td id="invoice-info">
                    <h2>Picklist</h2>
                    <h5>Date: <div>{{ orderDate }}</div></h5>
                    <h5>Order: <div>{{ order.code }}</div></h5>
                    <h5>Picklist Number: <div>{{ invoiceNumber }}</div></h5>  
                </td>    
                <td id="logo">
                    <a href="https://pinelab.studio">
                        <img src="data:image/png;base64,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"
                            style= "width: 200px; float: right;"
                                                        
                        />
                    </a>
                </td>
            </tr>
        </table>
    
        <hr> <!-- LINE -->

        <!--CLIENT INFO + COMPANY INFO -->
    
        <table style="width: 100%" >
            <tr>
                <td id="shipping-info">
                    <h4>Shipping Info</h4>
                    <div>{{#with order.shippingAddress }}
                    {{ fullName }}<br />
                    {{#if company}} {{ company }}<br />
                    {{/if}} {{#if streetLine1}} {{ streetLine1 }} {{ streetLine2 }}<br />
                    {{/if}} {{#if postalCode}} {{ postalCode }}, {{ city }}<br />
                    {{/if}} {{#if country}} {{ country }}<br />
                    {{/if}} {{/with}}
                    {{ customerEmail }}<br /></div>
                </td>
                <td id="billing-info">
                    {{#if order.billingAddress.streetLine1}}
                        <h4>Billing Info</h4>
                        <div>{{#with order.billingAddress }}
                        <br />
                        {{#if company}} {{ company }}<br />
                        {{/if}} {{#if streetLine1}} {{ streetLine1 }} {{ streetLine2 }}<br />
                        {{/if}} {{#if postalCode}} {{ postalCode }}, {{ city }}<br />
                        {{/if}} {{#if country}} {{ country }}<br />
                        {{/if}} 
                        {{/with}} 
                        {{ customerEmail }} <br /> </div>
                    {{/if}}
                </td>
            </tr>
        </table>
    


        <!-- #, PRODUCTS, QUANTITY, AMOUNT IN $ -->

        <table style="width: 96%">
            <tr>
                <td class="quantity-info"> 
                    <h4>Qty</h4>
                </td>
                <td class="product-info"> 
                    <h4>Product</h4>
                </td>
                <td class="vat-info"> 
                    <h4>VAT</h4>
                </td>
                <td class="subtotal-info"> 
                    <h4>Total</h4>
                </td>
            </tr>
        </table>

        <hr> <!-- LINE -->


        <!-- PRODUCT INFO -->

        <table style="width: 96%">
            {{#each order.lines }}
            <tr>
                <td class="quantity-info"> 
                    <h4>{{ quantity }}</h4>
                </td>
                <td class="product-info"> 
                    <h5>{{ productVariant.name }}</h5> 
                </td>
                <td class="vat-info"> 
                    <h5>{{ taxRate }}%</h5>
                </td>
                <td class="amount-info"> 
                    <h5>&dollar;{{ formatMoney discountedLinePriceWithTax }}</h5>
                </td>
            </tr>
            {{/each}}

            <!-- SHIPPING COSTS -->

            {{#each order.shippingLines }}
            <tr>
                <td class="quantity-info"></td>
                <td class="product-info"><div>Shipping costs</div></td>
                <td class="vat-info"></td>
                <td class="amount-info"><div>&dollar;{{ formatMoney priceWithTax }}</div></td>
            </tr>
            {{/each}}

            <!-- DISCOUNT -->

            {{#each order.discounts }}
            <tr>
                <td class="quantity-info"></td>
                <td class="product-info"><div>{{ description }}</div></td>
                <td class="vat-info"></td>
                <td class="amount-info"><div>&dollar;{{ formatMoney amountWithTax }}</div></td>
            </tr>
            {{/each}}
        </table>



        <hr> <!-- LINE -->

        <!-- TAX INFO - (SUB)TOTAL PRICE -->
        
        <table style="width:96%;" >
          <tr>
              <td id="tax-information" style="width: 50%">
                  {{#each order.taxSummary }}
                  <h6>{{ description }}:</h6>
                  <h5>TAX {{ taxRate }}%: &dollar;{{ formatMoney taxTotal }}</h5>
                  {{/each}}
              </td>
              <td id="total-amount ">
                  <h5>Subtotal (ex VAT): &dollar;{{ formatMoney order.total }}</h5>
                  <h2>Total: &dollar;{{ formatMoney order.totalWithTax }}</h2>  
                  <h6>Thanks for your order at Pinelab.studio</h6>
              </td>
          </tr>
        </table>

      <td style="float: right;">
        
      </td>


        <!-- COMPANY DETAILS -->


        <table style="width:96%;">
          <tr>
              <tr>
                  <h5>Company details</h5>
              </tr>
              <td id="company-details" style="width: 50%">
                  <h4>CoC:<div> 123456789</div></h4>
                  <h4>VAT:<div> 121212121212</div></h4>
                  <h4>IBAN:<div> NL20INGB12345678910</div></h4>  
                  <h4>Email Address:<div> plugins@pinelab.studio</div></h4> 
              </td>
              <td>   
                  <h4>Mobile Number:<div> +31 6 12345678</div></h4> 
                  <h4>Address:<div> Cornelis Trooststraat 48,
                  8932 BR Leeuwarden, Friesland, The Netherlands </div></h4>
              </td>  
          </tr>
      </table>
  </body>
</html>


`;
