import { RequestContext, Injector } from '@vendure/core';
import { GoogleSheetDataStrategy, SheetContent } from '../src';

const HEADERS = {
  'variant id': 0,
  'variant name': 1,
  'retail (incl.btw)': 2,
  'wholesale (excl. btw)': 3,
};

export class TestDataStrategy implements GoogleSheetDataStrategy {
  code = 'test';

  getSheetMetadata() {
    return {
      sheets: ['Prijzen'],
      spreadSheetId: process.env.SHEET_ID!,
    };
  }

  validateSheetData(ctx: RequestContext, sheets: SheetContent[]) {
    if (sheets.length !== 1) {
      return 'Only one sheet named "Prijzen" is expected.';
    }
    const sheet = sheets[0];
    const headerRow = sheet.data[0];
    // validate headers
    const headerErrors = [];
    for (const [headerName, index] of Object.entries(HEADERS)) {
      if (headerRow[index] !== headerName) {
        headerErrors.push(
          `Expected '${headerName}' for column ${index + 1}, but got '${
            headerRow[index]
          }'.`
        );
      }
    }
    if (headerErrors.length > 0) {
      return headerErrors.join('\n');
    }
    return true;
  }

  async handleSheetData(
    ctx: RequestContext,
    injector: Injector,
    sheets: SheetContent[]
  ): Promise<string> {
    return `Successfully processed ${sheets[0].data.length} rows`;
  }
}
