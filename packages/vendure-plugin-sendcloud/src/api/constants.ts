export const loggerCtx = 'SendcloudPlugin';
export const PLUGIN_OPTIONS = Symbol('SENDCLOUD_OPTIONS');
/** Used to detect synced orders, so don't change it */
export const SYNC_SUCCESS_NOTE = 'Successfully synced to SendCloud';
/** History entry type of sync attempts logged by plugin versions <= 2.1.x */
export const LEGACY_HISTORY_ENTRY_TYPE = 'SENDCLOUD_NOTIFICATION';
