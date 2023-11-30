export interface Customer {
  identifier: string;
  customer_number: string;
  first_name?: string;
  last_name?: string;
  email: string;
  website?: string;
  phone?: string;
  alternate_phone?: string;
  billing_info?: {
    first_name: string;
    last_name: string;
    street: string;
    street2: string;
    state: string;
    city: string;
    zip: string;
    country: string;
    phone: string;
  };
  shipping_info?: {
    first_name: string;
    last_name: string;
    street: string;
    street2: string;
    state: string;
    city: string;
    zip: string;
    country: string;
    phone: string;
  };
  active: true;
}
