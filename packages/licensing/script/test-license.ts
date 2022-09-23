import { decodeLicense, isValidForPlugin } from '../src/license';
const licenseKey = process.argv[2];
const pluginName = process.argv[3];
console.log('decoded:', decodeLicense(licenseKey));
console.log('is valid for plugin:', isValidForPlugin(licenseKey, pluginName));
