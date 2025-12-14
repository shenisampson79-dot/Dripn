/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 * 
 * Foundation Matching Service - Recommends foundation shades from Fenty Beauty and MAC
 * based on user's analyzed skin tone
 */

import { SkinToneData, SkinToneDepth, SkinUndertone } from '@/contexts/BodyProfileContext';

export type FoundationBrand = 'fenty' | 'mac';
export type FoundationUndertone = 'warm' | 'cool' | 'neutral' | 'olive';

export interface FoundationShade {
  id: string;
  brand: FoundationBrand;
  brandName: string;
  line: string;
  shadeName: string;
  shadeCode: string;
  undertone: FoundationUndertone;
  depth: SkinToneDepth;
  hexColor: string;
  productUrl: string;
}

export interface FoundationMatch {
  shade: FoundationShade;
  matchScore: number;
}

const FENTY_SHADES: FoundationShade[] = [
  { id: 'fenty_100', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '100', shadeCode: '100', undertone: 'neutral', depth: 'very-fair', hexColor: '#F5E6D3', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-100' },
  { id: 'fenty_110', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '110', shadeCode: '110', undertone: 'warm', depth: 'very-fair', hexColor: '#F4E3CE', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-110' },
  { id: 'fenty_120', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '120', shadeCode: '120', undertone: 'cool', depth: 'very-fair', hexColor: '#F2E1D0', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-120' },
  { id: 'fenty_130', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '130', shadeCode: '130', undertone: 'neutral', depth: 'fair', hexColor: '#EBDAC5', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-130' },
  { id: 'fenty_140', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '140', shadeCode: '140', undertone: 'warm', depth: 'fair', hexColor: '#E8D5BE', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-140' },
  { id: 'fenty_150', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '150', shadeCode: '150', undertone: 'cool', depth: 'fair', hexColor: '#E5D0B8', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-150' },
  { id: 'fenty_160', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '160', shadeCode: '160', undertone: 'olive', depth: 'fair', hexColor: '#E2CBAE', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-160' },
  { id: 'fenty_170', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '170', shadeCode: '170', undertone: 'neutral', depth: 'light-medium', hexColor: '#DBBFA0', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-170' },
  { id: 'fenty_180', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '180', shadeCode: '180', undertone: 'warm', depth: 'light-medium', hexColor: '#D8BA98', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-180' },
  { id: 'fenty_190', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '190', shadeCode: '190', undertone: 'cool', depth: 'light-medium', hexColor: '#D5B590', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-190' },
  { id: 'fenty_200', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '200', shadeCode: '200', undertone: 'neutral', depth: 'light-medium', hexColor: '#D2B088', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-200' },
  { id: 'fenty_210', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '210', shadeCode: '210', undertone: 'warm', depth: 'light-medium', hexColor: '#CFAB80', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-210' },
  { id: 'fenty_220', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '220', shadeCode: '220', undertone: 'cool', depth: 'medium', hexColor: '#CCA678', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-220' },
  { id: 'fenty_230', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '230', shadeCode: '230', undertone: 'olive', depth: 'medium', hexColor: '#C9A170', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-230' },
  { id: 'fenty_240', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '240', shadeCode: '240', undertone: 'neutral', depth: 'medium', hexColor: '#C69C68', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-240' },
  { id: 'fenty_250', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '250', shadeCode: '250', undertone: 'warm', depth: 'medium', hexColor: '#C39760', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-250' },
  { id: 'fenty_260', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '260', shadeCode: '260', undertone: 'cool', depth: 'medium', hexColor: '#C09258', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-260' },
  { id: 'fenty_270', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '270', shadeCode: '270', undertone: 'olive', depth: 'medium', hexColor: '#BD8D50', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-270' },
  { id: 'fenty_280', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '280', shadeCode: '280', undertone: 'neutral', depth: 'medium-deep', hexColor: '#BA8848', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-280' },
  { id: 'fenty_290', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '290', shadeCode: '290', undertone: 'warm', depth: 'medium-deep', hexColor: '#B78340', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-290' },
  { id: 'fenty_300', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '300', shadeCode: '300', undertone: 'cool', depth: 'medium-deep', hexColor: '#B47E38', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-300' },
  { id: 'fenty_310', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '310', shadeCode: '310', undertone: 'neutral', depth: 'medium-deep', hexColor: '#B17930', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-310' },
  { id: 'fenty_320', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '320', shadeCode: '320', undertone: 'warm', depth: 'medium-deep', hexColor: '#AE7428', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-320' },
  { id: 'fenty_330', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '330', shadeCode: '330', undertone: 'olive', depth: 'medium-deep', hexColor: '#AB6F20', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-330' },
  { id: 'fenty_335', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '335', shadeCode: '335', undertone: 'warm', depth: 'medium-deep', hexColor: '#A86A18', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-335' },
  { id: 'fenty_340', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '340', shadeCode: '340', undertone: 'neutral', depth: 'deep', hexColor: '#A56510', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-340' },
  { id: 'fenty_350', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '350', shadeCode: '350', undertone: 'warm', depth: 'deep', hexColor: '#9D5D0C', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-350' },
  { id: 'fenty_360', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '360', shadeCode: '360', undertone: 'cool', depth: 'deep', hexColor: '#955508', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-360' },
  { id: 'fenty_370', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '370', shadeCode: '370', undertone: 'neutral', depth: 'deep', hexColor: '#8D4D04', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-370' },
  { id: 'fenty_380', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '380', shadeCode: '380', undertone: 'warm', depth: 'deep', hexColor: '#854500', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-380' },
  { id: 'fenty_385', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '385', shadeCode: '385', undertone: 'olive', depth: 'deep', hexColor: '#7D3D00', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-385' },
  { id: 'fenty_390', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '390', shadeCode: '390', undertone: 'neutral', depth: 'very-deep', hexColor: '#753500', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-390' },
  { id: 'fenty_400', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '400', shadeCode: '400', undertone: 'warm', depth: 'very-deep', hexColor: '#6D2D00', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-400' },
  { id: 'fenty_410', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '410', shadeCode: '410', undertone: 'cool', depth: 'very-deep', hexColor: '#652500', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-410' },
  { id: 'fenty_420', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '420', shadeCode: '420', undertone: 'neutral', depth: 'very-deep', hexColor: '#5D1D00', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-420' },
  { id: 'fenty_430', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '430', shadeCode: '430', undertone: 'warm', depth: 'very-deep', hexColor: '#551500', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-430' },
  { id: 'fenty_440', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '440', shadeCode: '440', undertone: 'cool', depth: 'very-deep', hexColor: '#4D0D00', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-440' },
  { id: 'fenty_445', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '445', shadeCode: '445', undertone: 'neutral', depth: 'very-deep', hexColor: '#450500', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-445' },
  { id: 'fenty_450', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '450', shadeCode: '450', undertone: 'warm', depth: 'very-deep', hexColor: '#3D0000', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-450' },
  { id: 'fenty_460', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '460', shadeCode: '460', undertone: 'neutral', depth: 'very-deep', hexColor: '#350000', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-460' },
  { id: 'fenty_470', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '470', shadeCode: '470', undertone: 'cool', depth: 'very-deep', hexColor: '#2D0000', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-470' },
  { id: 'fenty_480', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '480', shadeCode: '480', undertone: 'warm', depth: 'very-deep', hexColor: '#250000', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-480' },
  { id: 'fenty_485', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '485', shadeCode: '485', undertone: 'olive', depth: 'very-deep', hexColor: '#1D0000', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-485' },
  { id: 'fenty_490', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '490', shadeCode: '490', undertone: 'neutral', depth: 'very-deep', hexColor: '#150000', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-490' },
  { id: 'fenty_495', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '495', shadeCode: '495', undertone: 'warm', depth: 'very-deep', hexColor: '#0D0000', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-495' },
  { id: 'fenty_498', brand: 'fenty', brandName: 'Fenty Beauty', line: 'Pro Filt\'r', shadeName: '498', shadeCode: '498', undertone: 'cool', depth: 'very-deep', hexColor: '#050000', productUrl: 'https://fentybeauty.com/products/pro-filtr-soft-matte-longwear-foundation-498' },
];

const MAC_SHADES: FoundationShade[] = [
  { id: 'mac_nc10', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NC10', shadeCode: 'NC10', undertone: 'warm', depth: 'very-fair', hexColor: '#F7E8DA', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nc13', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NC13', shadeCode: 'NC13', undertone: 'warm', depth: 'very-fair', hexColor: '#F4E3D2', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nc15', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NC15', shadeCode: 'NC15', undertone: 'warm', depth: 'fair', hexColor: '#F1DECA', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nc20', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NC20', shadeCode: 'NC20', undertone: 'warm', depth: 'fair', hexColor: '#EED9C2', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nc25', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NC25', shadeCode: 'NC25', undertone: 'warm', depth: 'light-medium', hexColor: '#E8D0B5', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nc30', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NC30', shadeCode: 'NC30', undertone: 'warm', depth: 'light-medium', hexColor: '#E2C7A8', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nc35', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NC35', shadeCode: 'NC35', undertone: 'warm', depth: 'medium', hexColor: '#DCBE9B', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nc37', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NC37', shadeCode: 'NC37', undertone: 'warm', depth: 'medium', hexColor: '#D9BA95', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nc40', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NC40', shadeCode: 'NC40', undertone: 'warm', depth: 'medium', hexColor: '#D6B58F', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nc42', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NC42', shadeCode: 'NC42', undertone: 'warm', depth: 'medium', hexColor: '#D3B089', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nc44', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NC44', shadeCode: 'NC44', undertone: 'warm', depth: 'medium-deep', hexColor: '#CFAB82', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nc45', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NC45', shadeCode: 'NC45', undertone: 'warm', depth: 'medium-deep', hexColor: '#CBA67C', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nc47', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NC47', shadeCode: 'NC47', undertone: 'warm', depth: 'medium-deep', hexColor: '#C7A176', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nc50', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NC50', shadeCode: 'NC50', undertone: 'warm', depth: 'deep', hexColor: '#C39C70', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nc55', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NC55', shadeCode: 'NC55', undertone: 'warm', depth: 'deep', hexColor: '#BF976A', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nc58', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NC58', shadeCode: 'NC58', undertone: 'warm', depth: 'deep', hexColor: '#BB9264', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nc60', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NC60', shadeCode: 'NC60', undertone: 'warm', depth: 'very-deep', hexColor: '#B78D5E', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nc64', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NC64', shadeCode: 'NC64', undertone: 'warm', depth: 'very-deep', hexColor: '#B38858', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nw10', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NW10', shadeCode: 'NW10', undertone: 'cool', depth: 'very-fair', hexColor: '#F5E4D8', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nw13', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NW13', shadeCode: 'NW13', undertone: 'cool', depth: 'very-fair', hexColor: '#F2DFD0', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nw15', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NW15', shadeCode: 'NW15', undertone: 'cool', depth: 'fair', hexColor: '#EFDAC8', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nw20', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NW20', shadeCode: 'NW20', undertone: 'cool', depth: 'fair', hexColor: '#ECD5C0', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nw25', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NW25', shadeCode: 'NW25', undertone: 'cool', depth: 'light-medium', hexColor: '#E6CCB3', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nw30', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NW30', shadeCode: 'NW30', undertone: 'cool', depth: 'light-medium', hexColor: '#E0C3A6', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nw33', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NW33', shadeCode: 'NW33', undertone: 'cool', depth: 'medium', hexColor: '#DABA99', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nw35', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NW35', shadeCode: 'NW35', undertone: 'cool', depth: 'medium', hexColor: '#D4B18C', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nw40', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NW40', shadeCode: 'NW40', undertone: 'cool', depth: 'medium', hexColor: '#CEA87F', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nw43', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NW43', shadeCode: 'NW43', undertone: 'cool', depth: 'medium-deep', hexColor: '#C89F72', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nw45', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NW45', shadeCode: 'NW45', undertone: 'cool', depth: 'medium-deep', hexColor: '#C29665', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nw47', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NW47', shadeCode: 'NW47', undertone: 'cool', depth: 'medium-deep', hexColor: '#BC8D58', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nw50', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NW50', shadeCode: 'NW50', undertone: 'cool', depth: 'deep', hexColor: '#B6844B', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nw55', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NW55', shadeCode: 'NW55', undertone: 'cool', depth: 'deep', hexColor: '#B07B3E', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nw58', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NW58', shadeCode: 'NW58', undertone: 'cool', depth: 'very-deep', hexColor: '#AA7231', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nw60', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NW60', shadeCode: 'NW60', undertone: 'cool', depth: 'very-deep', hexColor: '#A46924', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_nw64', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'NW64', shadeCode: 'NW64', undertone: 'cool', depth: 'very-deep', hexColor: '#9E6017', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_n1', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'N1', shadeCode: 'N1', undertone: 'neutral', depth: 'very-fair', hexColor: '#F6E6DC', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_n2', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'N2', shadeCode: 'N2', undertone: 'neutral', depth: 'very-fair', hexColor: '#F3E1D4', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_n3', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'N3', shadeCode: 'N3', undertone: 'neutral', depth: 'fair', hexColor: '#F0DCCC', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_n4', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'N4', shadeCode: 'N4', undertone: 'neutral', depth: 'fair', hexColor: '#EDD7C4', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_n5', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'N5', shadeCode: 'N5', undertone: 'neutral', depth: 'light-medium', hexColor: '#E7CEBC', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_n6', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'N6', shadeCode: 'N6', undertone: 'neutral', depth: 'light-medium', hexColor: '#E1C5B4', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_n7', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'N7', shadeCode: 'N7', undertone: 'neutral', depth: 'medium', hexColor: '#DBBCAC', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_n8', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'N8', shadeCode: 'N8', undertone: 'neutral', depth: 'medium', hexColor: '#D5B3A4', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_n9', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'N9', shadeCode: 'N9', undertone: 'neutral', depth: 'medium-deep', hexColor: '#CFAA9C', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_n10', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'N10', shadeCode: 'N10', undertone: 'neutral', depth: 'deep', hexColor: '#C9A194', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_n11', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'N11', shadeCode: 'N11', undertone: 'neutral', depth: 'deep', hexColor: '#C3988C', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
  { id: 'mac_n12', brand: 'mac', brandName: 'MAC Cosmetics', line: 'Studio Fix Fluid', shadeName: 'N12', shadeCode: 'N12', undertone: 'neutral', depth: 'very-deep', hexColor: '#BD8F84', productUrl: 'https://www.maccosmetics.com/product/13847/120613/products/makeup/face/foundation/studio-fix-fluid-spf-15-24hr-matte-foundation-oil-control' },
];

const ALL_SHADES = [...FENTY_SHADES, ...MAC_SHADES];

const DEPTH_ORDER: SkinToneDepth[] = ['very-fair', 'fair', 'light-medium', 'medium', 'medium-deep', 'deep', 'very-deep'];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

function rgbToLab(r: number, g: number, b: number): { L: number; a: number; b: number } {
  let rN = r / 255;
  let gN = g / 255;
  let bN = b / 255;

  rN = rN > 0.04045 ? Math.pow((rN + 0.055) / 1.055, 2.4) : rN / 12.92;
  gN = gN > 0.04045 ? Math.pow((gN + 0.055) / 1.055, 2.4) : gN / 12.92;
  bN = bN > 0.04045 ? Math.pow((bN + 0.055) / 1.055, 2.4) : bN / 12.92;

  const x = (rN * 0.4124564 + gN * 0.3575761 + bN * 0.1804375) / 0.95047;
  const y = (rN * 0.2126729 + gN * 0.7151522 + bN * 0.0721750);
  const z = (rN * 0.0193339 + gN * 0.1191920 + bN * 0.9503041) / 1.08883;

  const xN = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
  const yN = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
  const zN = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;

  return {
    L: (116 * yN) - 16,
    a: 500 * (xN - yN),
    b: 200 * (yN - zN),
  };
}

function calculateColorDistance(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  
  if (!rgb1 || !rgb2) return Infinity;
  
  const lab1 = rgbToLab(rgb1.r, rgb1.g, rgb1.b);
  const lab2 = rgbToLab(rgb2.r, rgb2.g, rgb2.b);
  
  return Math.sqrt(
    Math.pow(lab1.L - lab2.L, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );
}

function getDepthDistance(depth1: SkinToneDepth, depth2: SkinToneDepth): number {
  const idx1 = DEPTH_ORDER.indexOf(depth1);
  const idx2 = DEPTH_ORDER.indexOf(depth2);
  return Math.abs(idx1 - idx2);
}

function mapUndertone(undertone: SkinUndertone): FoundationUndertone[] {
  switch (undertone) {
    case 'warm':
      return ['warm', 'neutral'];
    case 'cool':
      return ['cool', 'neutral'];
    case 'neutral':
      return ['neutral', 'warm', 'cool'];
    case 'olive':
      return ['olive', 'neutral', 'warm'];
    default:
      return ['neutral', 'warm', 'cool'];
  }
}

export function getRecommendedShades(
  skinTone: SkinToneData,
  limit: number = 6,
  brand?: FoundationBrand
): FoundationMatch[] {
  const compatibleUndertones = mapUndertone(skinTone.undertone);
  
  let candidates = brand 
    ? ALL_SHADES.filter(s => s.brand === brand)
    : ALL_SHADES;

  const scored = candidates.map(shade => {
    let score = 0;
    
    const colorDist = calculateColorDistance(skinTone.hexApproximation, shade.hexColor);
    score += colorDist;
    
    const depthDist = getDepthDistance(skinTone.depth, shade.depth);
    score += depthDist * 5;
    
    const undertoneIdx = compatibleUndertones.indexOf(shade.undertone);
    if (undertoneIdx === -1) {
      score += 20;
    } else {
      score += undertoneIdx * 3;
    }
    
    return { shade, matchScore: Math.max(0, 100 - score) };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);

  if (!brand) {
    const fentyMatches = scored.filter(m => m.shade.brand === 'fenty').slice(0, Math.ceil(limit / 2));
    const macMatches = scored.filter(m => m.shade.brand === 'mac').slice(0, Math.ceil(limit / 2));
    const combined = [...fentyMatches, ...macMatches];
    combined.sort((a, b) => b.matchScore - a.matchScore);
    return combined.slice(0, limit);
  }

  return scored.slice(0, limit);
}

export function getShadesByBrand(brand: FoundationBrand): FoundationShade[] {
  return ALL_SHADES.filter(s => s.brand === brand);
}

export function getAllShades(): FoundationShade[] {
  return ALL_SHADES;
}

export function getShadeById(id: string): FoundationShade | undefined {
  return ALL_SHADES.find(s => s.id === id);
}
