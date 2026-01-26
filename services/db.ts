import { INITIAL_TYPES, INITIAL_PRODUCTS, INITIAL_BOMS, INITIAL_QUOTES, DEFAULT_ROLES } from '../constants';
import { Product, ProductTypeDefinition, BOMStructure, Quote, RoleDefinition } from '../types';

// Declare global sql.js init function loaded via CDN
declare var initSqlJs: any;

let db: any = null;
const DB_NAME = 'CPQ_Local_DB';
const STORE_NAME = 'sqlite_snapshots';
const KEY = 'latest_snapshot';

// --- IndexedDB Helpers ---

const saveToIndexedDB = async (data: Uint8Array) => {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e: any) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = (e: any) => {
      const idb = e.target.result;
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(data, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
};

const loadFromIndexedDB = async (): Promise<Uint8Array | null> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e: any) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = (e: any) => {
      const idb = e.target.result;
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(KEY);
      getReq.onsuccess = () => resolve(getReq.result || null);
      getReq.onerror = () => reject(getReq.error);
    };
    request.onerror = () => {
       // Silent fail if DB doesn't exist yet
       resolve(null);
    };
  });
};

export const clearIndexedDB = async () => {
    return new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(DB_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// --- Initialization ---

export const initializeDB = async () => {
  if (db) return db;

  try {
    const SQL = await initSqlJs({
      locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });

    // Try to load from IndexedDB first
    const savedData = await loadFromIndexedDB();

    if (savedData) {
      console.log("Restoring database from IndexedDB...");
      db = new SQL.Database(savedData);
      
      // Migration: Ensure new columns/tables exist
      try {
          db.run("ALTER TABLE products ADD COLUMN gallery_json TEXT");
      } catch (e) { /* Column likely exists */ }
      
      try {
          db.run("ALTER TABLE products ADD COLUMN documents_json TEXT");
      } catch (e) { /* Column likely exists */ }
      
      try {
          db.run(`CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT, description TEXT, is_system INTEGER, permissions_json TEXT);`);
          // Check if roles empty, seed defaults
          const roleCount = db.exec("SELECT count(*) FROM roles")[0].values[0][0];
          if (roleCount === 0) {
              DEFAULT_ROLES.forEach(r => db.run("INSERT INTO roles VALUES (?, ?, ?, ?, ?)", [r.id, r.name, r.description, r.isSystem ? 1 : 0, JSON.stringify(r.permissions)]));
          }
      } catch(e) { console.error("Role migration error", e) }

    } else {
      console.log("Creating new in-memory database...");
      db = new SQL.Database();
      createTables(db);
      seedData(db);
      // Save initial seed immediately
      persistDB();
    }
    return db;
  } catch (err) {
    console.error("Failed to initialize SQLite:", err);
    throw err;
  }
};

const persistDB = () => {
    if (!db) return;
    const data = db.export();
    saveToIndexedDB(data).catch(err => console.error("Auto-save failed:", err));
};

export const getDB = () => db;

export const exportDB = (): Uint8Array | null => {
    if (!db) return null;
    return db.export();
};

const createTables = (db: any) => {
  db.run(`CREATE TABLE IF NOT EXISTS product_types (id TEXT PRIMARY KEY, name TEXT, level INTEGER, color TEXT);`);
  db.run(`CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, 
      material_code TEXT, 
      unit TEXT, 
      name TEXT, 
      description TEXT, 
      specifications TEXT, 
      type TEXT, 
      cost REAL, 
      base_price REAL, 
      inventory INTEGER, 
      category TEXT, 
      image_url TEXT,
      gallery_json TEXT,
      documents_json TEXT
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS boms (id TEXT PRIMARY KEY, root_product_id TEXT, name TEXT, items_json TEXT);`);
  db.run(`CREATE TABLE IF NOT EXISTS quotes (id TEXT PRIMARY KEY, customer_name TEXT, date TEXT, status TEXT, items_json TEXT, subtotal REAL, tax REAL, grand_total REAL);`);
  db.run(`CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT, description TEXT, is_system INTEGER, permissions_json TEXT);`);
};

const seedData = (db: any) => {
  try {
      const result = db.exec("SELECT count(*) as count FROM products");
      const count = result[0].values[0][0];
      if (count === 0) {
        INITIAL_TYPES.forEach(t => db.run("INSERT INTO product_types VALUES (?, ?, ?, ?)", [t.id, t.name, t.level, t.color]));
        INITIAL_PRODUCTS.forEach(p => db.run(
            `INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [p.id, p.materialCode, p.unit, p.name, p.description, p.specifications || '', p.type, p.cost, p.basePrice, p.inventory, p.category, p.imageUrl || '', '[]', '[]']
        ));
        INITIAL_BOMS.forEach(b => db.run("INSERT INTO boms VALUES (?, ?, ?, ?)", [b.id, b.rootProductId || null, b.name, JSON.stringify(b.items)]));
        INITIAL_QUOTES.forEach(q => db.run("INSERT INTO quotes VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [q.id, q.customerName, q.date, q.status, JSON.stringify(q.items), q.subtotal, q.tax, q.grandTotal]));
        DEFAULT_ROLES.forEach(r => db.run("INSERT INTO roles VALUES (?, ?, ?, ?, ?)", [r.id, r.name, r.description, r.isSystem ? 1 : 0, JSON.stringify(r.permissions)]));
      }
  } catch (e) {
      console.warn("Error seeding data:", e);
  }
};

// --- CRUD Actions ---

// ... Types, Products, BOMs, Quotes CRUD omitted for brevity but remain unchanged ...
// Only adding Roles CRUD

// 1. Roles
export const dbGetRoles = (): RoleDefinition[] => {
    if (!db) return [];
    try {
        const res = db.exec("SELECT * FROM roles");
        if (res.length === 0) return [];
        return res[0].values.map((row: any[]) => ({
            id: row[0], 
            name: row[1], 
            description: row[2], 
            isSystem: row[3] === 1,
            permissions: JSON.parse(row[4])
        }));
    } catch(e) {
        return [];
    }
};
export const dbAddRole = (r: RoleDefinition) => {
    if(!db) return;
    db.run("INSERT INTO roles VALUES (?, ?, ?, ?, ?)", 
        [r.id, r.name, r.description, r.isSystem ? 1 : 0, JSON.stringify(r.permissions)]);
    persistDB();
};
export const dbUpdateRole = (r: RoleDefinition) => {
    if(!db) return;
    db.run("UPDATE roles SET name=?, description=?, permissions_json=? WHERE id=?", 
        [r.name, r.description, JSON.stringify(r.permissions), r.id]);
    persistDB();
};
export const dbDeleteRole = (id: string) => {
    if(!db) return;
    db.run("DELETE FROM roles WHERE id=?", [id]);
    persistDB();
};

// ... Rest of exports matching previous file content for Types, Products, Boms, Quotes ...
// Re-exporting them to ensure file integrity in response
export const dbGetTypes = (): ProductTypeDefinition[] => {
    if (!db) return [];
    const res = db.exec("SELECT * FROM product_types");
    if (res.length === 0) return [];
    return res[0].values.map((row: any[]) => ({
        id: row[0], name: row[1], level: row[2], color: row[3]
    }));
};
export const dbAddType = (t: ProductTypeDefinition) => {
    if(!db) return;
    db.run("INSERT INTO product_types VALUES (?, ?, ?, ?)", [t.id, t.name, t.level, t.color]);
    persistDB();
};
export const dbUpdateType = (t: ProductTypeDefinition) => {
    if(!db) return;
    db.run("UPDATE product_types SET name=?, level=?, color=? WHERE id=?", [t.name, t.level, t.color, t.id]);
    persistDB();
};
export const dbDeleteType = (id: string) => {
    if(!db) return;
    db.run("DELETE FROM product_types WHERE id=?", [id]);
    persistDB();
};

export const dbGetProducts = (): Product[] => {
    if (!db) return [];
    const res = db.exec("SELECT * FROM products");
    if (res.length === 0) return [];
    return res[0].values.map((row: any[]) => ({
        id: row[0], materialCode: row[1], unit: row[2], name: row[3], description: row[4],
        specifications: row[5], type: row[6], cost: row[7], basePrice: row[8],
        inventory: row[9], category: row[10], imageUrl: row[11],
        galleryImages: row[12] ? JSON.parse(row[12]) : [],
        documents: row[13] ? JSON.parse(row[13]) : []
    }));
};
export const dbAddProduct = (p: Product) => {
    if(!db) return;
    db.run(`INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
        [p.id, p.materialCode, p.unit, p.name, p.description, p.specifications || '', p.type, p.cost, p.basePrice, p.inventory, p.category, p.imageUrl || '', JSON.stringify(p.galleryImages || []), JSON.stringify(p.documents || [])]);
    persistDB();
};
export const dbUpdateProduct = (p: Product) => {
    if(!db) return;
    db.run(`UPDATE products SET material_code=?, unit=?, name=?, description=?, specifications=?, type=?, cost=?, base_price=?, inventory=?, category=?, image_url=?, gallery_json=?, documents_json=? WHERE id=?`, 
        [p.materialCode, p.unit, p.name, p.description, p.specifications || '', p.type, p.cost, p.basePrice, p.inventory, p.category, p.imageUrl || '', JSON.stringify(p.galleryImages || []), JSON.stringify(p.documents || []), p.id]);
    persistDB();
};
export const dbDeleteProduct = (id: string) => {
    if(!db) return;
    db.run("DELETE FROM products WHERE id=?", [id]);
    persistDB();
};

export const dbGetBOMs = (): BOMStructure[] => {
    if (!db) return [];
    const res = db.exec("SELECT * FROM boms");
    if (res.length === 0) return [];
    return res[0].values.map((row: any[]) => ({
        id: row[0], rootProductId: row[1] || undefined, name: row[2], items: JSON.parse(row[3])
    }));
};
export const dbAddBOM = (b: BOMStructure) => {
    if(!db) return;
    db.run("INSERT INTO boms VALUES (?, ?, ?, ?)", [b.id, b.rootProductId || null, b.name, JSON.stringify(b.items)]);
    persistDB();
};
export const dbUpdateBOM = (b: BOMStructure) => {
    if(!db) return;
    db.run("UPDATE boms SET root_product_id=?, name=?, items_json=? WHERE id=?", [b.rootProductId || null, b.name, JSON.stringify(b.items), b.id]);
    persistDB();
};
export const dbDeleteBOM = (id: string) => {
    if(!db) return;
    db.run("DELETE FROM boms WHERE id=?", [id]);
    persistDB();
};

export const dbGetQuotes = (): Quote[] => {
    if (!db) return [];
    const res = db.exec("SELECT * FROM quotes");
    if (res.length === 0) return [];
    return res[0].values.map((row: any[]) => ({
        id: row[0], customerName: row[1], date: row[2], status: row[3],
        items: JSON.parse(row[4]), subtotal: row[5], tax: row[6], grandTotal: row[7]
    }));
};
export const dbAddQuote = (q: Quote) => {
    if(!db) return;
    db.run("INSERT INTO quotes VALUES (?, ?, ?, ?, ?, ?, ?, ?)", 
        [q.id, q.customerName, q.date, q.status, JSON.stringify(q.items), q.subtotal, q.tax, q.grandTotal]);
    persistDB();
};
export const dbUpdateQuote = (q: Quote) => { 
    if(!db) return;
    db.run("UPDATE quotes SET status=? WHERE id=?", [q.status, q.id]);
    persistDB();
};
export const dbDeleteQuote = (id: string) => {
    if(!db) return;
    db.run("DELETE FROM quotes WHERE id=?", [id]);
    persistDB();
};