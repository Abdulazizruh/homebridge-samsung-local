import { SamsungLocalPlatform } from './src/platform.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './src/settings.js';

/** @param {import('homebridge').API} api */
export default (api) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, SamsungLocalPlatform);
};
