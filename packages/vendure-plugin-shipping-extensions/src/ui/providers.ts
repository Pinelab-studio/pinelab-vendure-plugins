import { registerFormInputComponent } from '@vendure/admin-ui/core';
import { SelectTaxCategoryComponent } from './select-tax-category.component';

export default [
  registerFormInputComponent(
    'tax-category-id-form-input',
    SelectTaxCategoryComponent
  ),
];
