import { VendurePlugin, VerificationTokenGenerator } from '@vendure/core';
import { Injectable } from '@nestjs/common';
export const testVerificationToken = 'nbhgfxdsdfghjkl-cfgvhbjnklm-vgftrg';
@Injectable()
export class MockedVerificationTokenGenerator {
  generateVerificationToken(): string {
    console.log(
      `--------------------------------generateVerificationToken-----------------------------`
    );
    return testVerificationToken;
  }

  verifyVerificationToken(token: string): boolean {
    console.log(
      `--------------------------------verifyVerificationToken-----------------------------`
    );
    return testVerificationToken === token;
  }
}
export const mockedVerificationTokenGenerator = {
  generateVerificationToken: (): string => {
    console.log(
      `--------------------------------generateVerificationToken-----------------------------`
    );
    return testVerificationToken;
  },
  verifyVerificationToken: (token: string): boolean => {
    console.log(
      `--------------------------------verifyVerificationToken-----------------------------`
    );
    return testVerificationToken === token;
  },
  configService: undefined,
};
@VendurePlugin({
  providers: [
    {
      provide: VerificationTokenGenerator,
      useValue: MockedVerificationTokenGenerator,
    },
    MockedVerificationTokenGenerator,
  ],
  exports: [MockedVerificationTokenGenerator],
})
export class OverrideVerificationTokenGeneratorPlugin {}
