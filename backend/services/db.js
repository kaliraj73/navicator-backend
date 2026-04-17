const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(process.cwd(), process.env.DB_PATH || './data/db.json');

function ensure() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ projects: [], snippets: [] }, null, 2));
  }
}

function read() {
  ensure();
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function write(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

module.exports = {
  get(key, fallback = null) {
    const data = read();
    return data[key] ?? fallback;
  },
  push(key, value) {
    const data = read();
    data[key] = Array.isArray(data[key]) ? data[key] : [];
    data[key].push(value);
    write(data);
    return value;
  },
};
