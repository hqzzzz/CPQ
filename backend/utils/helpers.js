
const mapToCamel = (row) => {
    if (!row) return null;
    const newRow = {};
    for (const key in row) {
        const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        
        if (['galleryImages', 'documents', 'items', 'permissions', 'quote', 'production', 'bomConfig', 'statusLog'].includes(camelKey) || key.endsWith('_json')) {
            try {
                const finalKey = key.endsWith('_json') ? camelKey.replace('Json', '') : camelKey;
                newRow[finalKey] = (typeof row[key] === 'string') ? JSON.parse(row[key]) : (row[key] || []);
            } catch (e) {
                const finalKey = key.endsWith('_json') ? camelKey.replace('Json', '') : camelKey;
                newRow[finalKey] = [];
            }
        } else {
            newRow[camelKey] = row[key];
        }
    }
    return newRow;
};

module.exports = { mapToCamel };
