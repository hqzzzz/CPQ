/**
 * DEPRECATED
 * This application has migrated to a pure REST API architecture.
 * Local database services (IndexedDB/SQLite) have been removed.
 * Please refer to services/api.ts for data interactions.
 */

export const initializeDB = async () => { console.warn("DB Service is deprecated."); };
export const getDB = () => null;
export const exportDB = () => null;
export const clearIndexedDB = async () => {};