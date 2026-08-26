/**
 * G3-DM-09a — Julia fashion redirect classifier.
 * Run: npx tsx utils/juliaFashionRedirect.test.ts
 */
import assert from 'node:assert/strict';
import { isJuliaFashionStylingAsk, JULIA_FASHION_REDIRECT_RESPONSE } from '@/utils/juliaFashionRedirect';

assert.ok(JULIA_FASHION_REDIRECT_RESPONSE.includes('Stylist tab'));

assert.equal(
  isJuliaFashionStylingAsk(
    "Hi, I was thinking of buying a sarong but I'm not sure what to style it with, what do you think?",
  ),
  true,
);

assert.equal(isJuliaFashionStylingAsk('Where is usage this month?'), false);

assert.equal(
  isJuliaFashionStylingAsk('I need to speak to someone in customer service, ideally over the phone.'),
  false,
);

console.log('juliaFashionRedirect.test.ts: all passed');
