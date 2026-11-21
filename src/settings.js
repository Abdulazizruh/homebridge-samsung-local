/** Names that must stay unique to this plugin, so it can never collide with
 * homebridge-smartthings-oauth or any other SmartThings plugin. */
export const PLUGIN_NAME = 'homebridge-samsung-local';
export const PLATFORM_NAME = 'SamsungLocal';
/** Folder inside the Homebridge storage path that holds everything this plugin writes. */
export const STORAGE_DIR_NAME = 'samsung-local';
/** Namespace for accessory UUIDs. Never reuse another plugin's seed. */
export const UUID_NAMESPACE = 'homebridge-samsung-local:device:';
export const NAME_SUFFIX = 'Local';
export const MIN_PYTHON = [3, 11];
