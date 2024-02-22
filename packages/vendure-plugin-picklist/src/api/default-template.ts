export const defaultTemplate = `

<!DOCTYPE html>
<html style="margin: 0;">

<head>
    <meta charset="utf-8" />
    <title>Order: {{ order.code }}</title>
    <style>
        h4 {
            font-size: 0.6rem;
            margin: 0;
        }
        h5 {
            font-size: 0.6rem;
            margin: 0;
        }
        h20 {
            font-size: 0.8rem;
            color: #00000080;
        }

        .quantity-info {
            width: 10%;
        }

        .product-info {
            width: 58%;
        }

    </style>
</head>

<body style="font-family: Arial, Helvetica, sans-serif; width: 100%;">

        <!-- PICKLIST INFO + LOGO -->

        <table style="width: 96%">
            <tr>
                <td id="invoice-info">
                    <h2>Picklist</h2>
                    <h5>Date: <h20>{{ orderDate }}</h20></h5>
                    <h5>Order: <h20>{{ order.code }}</h20></h5>
                </td> 
            </tr>
        </table>
    
        <hr> <!-- LINE -->

        <!--CLIENT INFO + COMPANY INFO -->
    
        <table style="width: 100%" >
            <tr>
                <td id="shipping-info">
                    <h4>Shipping Info</h4>
                    <h20>{{#with order.shippingAddress }}
                    {{ fullName }}<br />
                    {{#if company}} {{ company }}<br />
                    {{/if}} {{#if streetLine1}} {{ streetLine1 }} {{ streetLine2 }}<br />
                    {{/if}} {{#if postalCode}} {{ postalCode }}, {{ city }}<br />
                    {{/if}} {{#if country}} {{ country }}<br />
                    {{/if}} {{/with}}
                    {{ customerEmail }}<br /></h20>
                </td>
                <td id="billing-info">
                    {{#if order.billingAddress.streetLine1}}
                        <h4>Billing Info</h4>
                        <h20>{{#with order.billingAddress }}
                        <br />
                        {{#if company}} {{ company }}<br />
                        {{/if}} {{#if streetLine1}} {{ streetLine1 }} {{ streetLine2 }}<br />
                        {{/if}} {{#if postalCode}} {{ postalCode }}, {{ city }}<br />
                        {{/if}} {{#if country}} {{ country }}<br />
                        {{/if}} 
                        {{/with}} 
                        {{ customerEmail }} <br /> </h20>
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
            </tr>
            {{/each}}

            <!-- DISCOUNT -->

            {{#each order.discounts }}
            <tr>
                <td class="quantity-info"></td>
                <td class="product-info"><h20>{{ description }}</h20></td>
            </tr>
            {{/each}}
        </table>

        <hr> <!-- LINE -->

  </body>
</html>
`;
