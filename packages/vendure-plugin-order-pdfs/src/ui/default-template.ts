export const defaultTemplate = `
<!DOCTYPE html>
<html>

<head>
    <meta charset="utf-8" />
    <title>Order: {{ order.code }}</title>
</head>

<body style="font-family: Arial, Helvetica, sans-serif; width: 100%;">

        <table style="width: 96%">
            <tr>
                <td>
                    <h5>Order: <h20>{{ order.code }}</h20></h5>
                    <h5>Date: <h20>{{ orderDate }}</h20></h5>
                </td> 
            </tr>
        </table>
    
        <hr> <!-- LINE -->

        <!--CLIENT INFO + COMPANY INFO -->
    
        <table style="width: 96%">
            <tr>
                <td id="shipping-info">
                    <h4>Shipping Info</h4>
                    {{#with order.shippingAddress }}
                    {{ fullName }}<br />
                    {{#if company}} {{ company }}<br />
                    {{/if}} {{#if streetLine1}} {{ streetLine1 }} {{ streetLine2 }}<br />
                    {{/if}} {{#if postalCode}} {{ postalCode }}, {{ city }}<br />
                    {{/if}} {{#if country}} {{ country }}<br />
                    {{/if}} {{/with}}
                    {{ customerEmail }}<br />
                </td>
                <td id="billing-info">
                    {{#if order.billingAddress.streetLine1}}
                        <h4>Billing Info</h4>
                        {{#with order.billingAddress }}
                        <br />
                        {{#if company}} {{ company }}<br />
                        {{/if}} {{#if streetLine1}} {{ streetLine1 }} {{ streetLine2 }}<br />
                        {{/if}} {{#if postalCode}} {{ postalCode }}, {{ city }}<br />
                        {{/if}} {{#if country}} {{ country }}<br />
                        {{/if}} 
                        {{/with}} 
                        {{ customerEmail }} <br />
                    {{/if}}
                </td>
            </tr>
        </table>

        <!-- #, PRODUCTS, QUANTITY, AMOUNT IN $ -->

        <table style="width: 96%">
            <tr>
                <td> 
                    <h4>Qty</h4>
                </td>
                <td> 
                    <h4>Product</h4>
                </td>
            </tr>
            
            {{#each order.lines }}
            <tr>
                <td> 
                    {{ quantity }}
                </td>
                <td> 
                    {{ productVariant.name }}
                </td>
            </tr>
            {{/each}}

            <!-- DISCOUNT -->

            {{#each order.discounts }}
            <tr>
                <td></td>
                <td>{{ description }}</td>
            </tr>
            {{/each}}
        </table>

        <hr> <!-- LINE -->

  </body>
</html>
`;
