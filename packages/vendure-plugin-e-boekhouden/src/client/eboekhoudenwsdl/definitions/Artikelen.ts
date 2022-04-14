import { CArtikel } from './CArtikel';

/**
 * Artikelen
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.e-boekhouden.nl/soap`
 */
export interface Artikelen {
  /** cArtikel[] */
  cArtikel?: Array<CArtikel>;
}
