import gql from 'graphql-tag';

const pdfTemplateFields = gql`
  fragment PDFTemplateFields on PDFTemplate {
    id
    name
    enabled
    templateString
  }
`;

export const updatePDFTemplate = gql`
  mutation updatePDFTemplate($id: ID!, $input: PDFTemplateInput!) {
    updatePDFTemplate(id: $id, input: $input) {
      ...PDFTemplateFields
    }
  }
  ${pdfTemplateFields}
`;

export const createPDFTemplate = gql`
  mutation createPDFTemplate($input: PDFTemplateInput!) {
    createPDFTemplate(input: $input) {
      ...PDFTemplateFields
    }
  }
  ${pdfTemplateFields}
`;

export const deletePDFTemplate = gql`
  mutation deletePDFTemplate($id: ID!) {
    deletePDFTemplate(id: $id) {
      ...PDFTemplateFields
    }
  }
  ${pdfTemplateFields}
`;

export const getPDFTemplates = gql`
  query pdfTemplates {
    pdfTemplates {
      items {
        ...PDFTemplateFields
      }
      totalItems
    }
  }
  ${pdfTemplateFields}
`;

export const getTemplateNames = gql`
  query pdfTemplateNames {
    pdfTemplates {
      items {
        id
        name
        enabled
      }
      totalItems
    }
  }
`;
