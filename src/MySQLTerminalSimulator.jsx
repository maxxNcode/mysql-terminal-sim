import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Trash2, Upload, Download, Info, Database, ChevronRight, Eraser } from "lucide-react";

/**
 * MySQL Web Terminal Simulator
 * -------------------------------------------------------------
 * A single-file React component that simulates a MySQL-like CLI
 * in the browser. It supports a practical subset of MySQL/SQL and
 * several MySQL client meta-commands. Designed for beginners to
 * practice CRUD and common commands without a server.
 *
 * ✅ Supported SQL (case-insensitive):
 *   - CREATE DATABASE <name>;
 *   - DROP DATABASE <name>;
 *   - SHOW DATABASES;
 *   - USE <dbname>;
 *   - CREATE TABLE <name> (col defs...);  // column-level PRIMARY KEY & AUTO_INCREMENT
 *   - DROP TABLE <name>;
 *   - SHOW TABLES;
 *   - DESCRIBE <table>; / DESC <table>;
 *   - INSERT INTO <table> [(cols,...)] VALUES (...), (...);
 *   - SELECT <cols|*> FROM <table>
 *       [WHERE <col op value> [AND/OR ...]]
 *       [ORDER BY <col> [ASC|DESC]]
 *       [LIMIT <n> [OFFSET <m>]];
 *   - UPDATE <table> SET col=val[, ...] [WHERE ...];
 *   - DELETE FROM <table> [WHERE ...];
 *
 * 🧰 Client/meta commands (start of line):
 *   - HELP or \h                 : show help
 *   - CLEAR or \! cls or \! clear: clear screen output
 *   - \c                          : cancel current (multi-line) buffer
 *   - EXIT or QUIT               : end session (just prints a message)
 *   - \G                         : Use at the end of SELECT to print vertical rows
 *   - STATUS or \s               : show server/client status (simulated)
 *   - HISTORY                    : show typed command history
 *
 * 📝 Notes
 *   - Statements end with a semicolon (;) or \G.
 *   - Strings may be quoted with single ' or double " quotes.
 *   - WHERE supports =, !=, <>, >, <, >=, <= and basic AND/OR.
 *   - Types are accepted but not enforced (INT, VARCHAR(n), TEXT, etc.).
 *   - AUTO_INCREMENT on an INT column auto-numbers if a row inserts NULL/omits it.
 *
 * 🎯 Extras
 *   - Import/Export database as JSON (top-right buttons)
 *   - Seed sample schema/data ("Seed Sample")
 *   - Reset (wipe all state)
 */

// ---------------------- Utilities ----------------------
const now = () => new Date().toLocaleString();
const clone = (x) => JSON.parse(JSON.stringify(x));

function tokenize(input) {
  // very light tokenizer to help with splitting by spaces but keeping quotes
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '\'' || ch === '"' || ch === '`') {
      const quote = ch; i++;
      let buf = "";
      while (i < input.length) {
        if (input[i] === '\\' && i + 1 < input.length) { buf += input[i+1]; i += 2; continue; }
        if (input[i] === quote) { i++; break; }
        buf += input[i++];
      }
      tokens.push({ type: 'string', value: buf });
      continue;
    }
    // punctuation
    if (",();=<>!*".includes(ch)) {
      // two-char operators
      const two = input.slice(i, i+2);
      if (["<=", ">=", "<>", "!="].includes(two)) {
        tokens.push({ type: 'op', value: two }); i += 2; continue;
      }
      tokens.push({ type: 'sym', value: ch }); i++; continue;
    }
    // word/number
    let buf = "";
    while (i < input.length && !/\s/.test(input[i]) && !",();=<>!*'\"`".includes(input[i])) buf += input[i++];
    tokens.push({ type: 'word', value: buf });
  }
  return tokens;
}

function upper(s) { return s.toUpperCase(); }
function unquote(v){ return typeof v === 'string' ? v : String(v); }

function parseListBetween(str, open='(', close=')'){
  const a = str.indexOf(open), b = str.lastIndexOf(close);
  if (a === -1 || b === -1 || b <= a) return null;
  return str.slice(a+1, b).trim();
}

// ---------------------- Engine State ----------------------
function createEmptyEngine(){
  return {
    version: 'MySQL Simulator 1.0',
    client: 'mysql Web Client',
    databases: {
      // default empty
    },
    currentDB: null,
    history: [],
    autoinc: {}, // key: db.table.col -> next int
  };
}

// ---------------------- Evaluation ----------------------
function evaluate(engine, rawInput) {
  const input = rawInput.trim();
  if (!input) return { out: null };

  // handle meta commands first
  const start = input.trim();
  const startUpper = start.toUpperCase();

  if (startUpper === 'HELP' || startUpper === '\\H') {
    return { out: helpText() };
  }
  if (['EXIT','QUIT'].includes(startUpper)) {
    return { out: 'Bye! (This is a simulated client — tab stays open.)' };
  }
  if (startUpper === 'HISTORY') {
    return { out: engine.history.map((h,i)=>`${i+1}\t${h}`).join('\n') || '(empty)' };
  }
  if (startUpper === 'STATUS' || startUpper === '\\S') {
    return { out:
`--------------\n${engine.client}  Ver ${engine.version}\nConnection id: 1\nCurrent database: ${engine.currentDB ?? '(none)'}\nServer version: Simulated\nProtocol version: 10 (pretend)\nUptime: a while\nThreads: 1  Questions: many  Slow queries: 0  Opens: a few\n--------------` };
  }
  if (startUpper === 'CLEAR' || startUpper === '\\! CLS' || startUpper === '\\! CLEAR') {
    return { clearScreen: true, out: null };
  }
  if (startUpper === '\\C') {
    return { out: 'Command buffer cleared.' };
  }

  // SQL statements may end with ; or \G
  let vertical = false;
  let stmt = input;
  if (stmt.endsWith('\\G')) { vertical = true; stmt = stmt.slice(0, -2).trim(); }
  if (stmt.endsWith(';')) stmt = stmt.slice(0, -1);

  const u = upper(stmt);

  // dispatch by leading keyword
  if (u.startsWith('CREATE DATABASE ')) return createDatabase(engine, stmt);
  if (u.startsWith('DROP DATABASE ')) return dropDatabase(engine, stmt);
  if (u === 'SHOW DATABASES') return showDatabases(engine);
  if (u.startsWith('USE ')) return useDatabase(engine, stmt);
  if (u.startsWith('CREATE TABLE ')) return createTable(engine, stmt);
  if (u.startsWith('DROP TABLE ')) return dropTable(engine, stmt);
  if (u === 'SHOW TABLES') return showTables(engine);
  if (u.startsWith('DESCRIBE ') || u.startsWith('DESC ')) return describeTable(engine, stmt);
  if (u.startsWith('INSERT INTO ')) return insertInto(engine, stmt);
  if (u.startsWith('SELECT ')) return selectFrom(engine, stmt, { vertical });
  if (u.startsWith('UPDATE ')) return updateTable(engine, stmt);
  if (u.startsWith('DELETE FROM ')) return deleteFrom(engine, stmt);

  return { out: `ERROR: Unrecognized or unsupported statement. Type HELP for supported commands.` };
}

// ---------------------- Helpers for DB ops ----------------------
function ensureDB(engine){
  if (!engine.currentDB) return { err: 'ERROR: No database selected. Use USE <dbname>;' };
  if (!engine.databases[engine.currentDB]) return { err: `ERROR: Unknown database '${engine.currentDB}'.` };
  return { ok: true };
}

function normalizeIdent(x){
  // remove backticks and quotes
  return x.replace(/^`|`$/g,'');
}

function parseIdentifiersList(listStr){
  // splits by commas but respects simple quotes
  const res = [];
  let cur = "", inS=false, inD=false;
  for (let i=0;i<listStr.length;i++){
    const ch = listStr[i];
    if (ch==="'" && !inD) { inS = !inS; cur += ch; continue; }
    if (ch==='"' && !inS) { inD = !inD; cur += ch; continue; }
    if (ch===',' && !inS && !inD) { if (cur.trim()) res.push(cur.trim()); cur=""; continue; }
    cur += ch;
  }
  if (cur.trim()) res.push(cur.trim());
  return res;
}

function parseWhere(whereStr){
  // very simple where parser supporting AND/OR and binary ops
  if (!whereStr) return null;
  const tokens = tokenize(whereStr);
  // parse expression with precedence: AND over OR
  function parseValue(tok){
    const t = tok.shift();
    if (!t) return null;
    if (t.type==='string') return { type:'literal', value: t.value };
    if (t.type==='word') {
      // number?
      if (/^\d+(?:\.\d+)?$/.test(t.value)) return { type:'literal', value: Number(t.value) };
      // unquoted word -> treat as identifier or literal string depending on context, we choose literal
      return { type:'identifier', name: normalizeIdent(t.value) };
    }
    return null;
  }
  function parseComp(tok){
    const left = parseValue(tok); if (!left) return null;
    const opTok = tok.shift(); if (!opTok) return left;
    const op = (opTok.value||'').toUpperCase();
    if (!['=','!=','<>','>','<','>=','<=','LIKE'].includes(op)) { tok.unshift(opTok); return left; }
    const right = parseValue(tok);
    return { type:'comp', op, left, right };
  }
  function parseAnd(tok){
    let node = parseComp(tok);
    while (tok.length){
      const t = tok[0];
      if (t.type==='word' && upper(t.value)==='AND'){ tok.shift(); const rhs = parseComp(tok); node = { type:'and', left:node, right:rhs }; }
      else break;
    }
    return node;
  }
  function parseOr(tok){
    let node = parseAnd(tok);
    while (tok.length){
      const t = tok[0];
      if (t.type==='word' && upper(t.value)==='OR'){ tok.shift(); const rhs = parseAnd(tok); node = { type:'or', left:node, right:rhs }; }
      else break;
    }
    return node;
  }
  return parseOr(tokens);
}

function evalExpr(row, expr){
  if (!expr) return true;
  switch (expr.type){
    case 'literal': return expr.value;
    case 'identifier': return row[normalizeIdent(expr.name)];
    case 'comp': {
      const l = evalExpr(row, expr.left);
      const r = evalExpr(row, expr.right);
      switch (expr.op){
        case '=': return l==r; // eslint-disable-line eqeqeq
        case '!=':
        case '<>': return l!=r; // eslint-disable-line eqeqeq
        case '>': return Number(l)>Number(r);
        case '<': return Number(l)<Number(r);
        case '>=': return Number(l)>=Number(r);
        case '<=': return Number(l)<=Number(r);
        case 'LIKE': {
          // basic % wildcard
          const pattern = String(r).replace(/[%_]/g, (m)=> m==='%'?'.*':'.');
          return new RegExp(`^${pattern}$`, 'i').test(String(l));
        }
        default: return false;
      }
    }
    case 'and': return evalExpr(row, expr.left) && evalExpr(row, expr.right);
    case 'or': return evalExpr(row, expr.left) || evalExpr(row, expr.right);
    default: return false;
  }
}

// ---------------------- SQL Implementations ----------------------
function createDatabase(engine, stmt){
  const m = /CREATE\s+DATABASE\s+`?([A-Za-z0-9_]+)`?/i.exec(stmt);
  if (!m) return { out: 'ERROR: Syntax: CREATE DATABASE <name>;' };
  const name = m[1];
  if (engine.databases[name]) return { out: `ERROR: Can't create database '${name}'; database exists` };
  engine.databases[name] = { tables: {} };
  return { out: `Query OK, 1 row affected (simulated)\nDatabase created: ${name}` };
}

function dropDatabase(engine, stmt){
  const m = /DROP\s+DATABASE\s+`?([A-Za-z0-9_]+)`?/i.exec(stmt);
  if (!m) return { out: 'ERROR: Syntax: DROP DATABASE <name>;' };
  const name = m[1];
  if (!engine.databases[name]) return { out: `ERROR: Unknown database '${name}'.` };
  delete engine.databases[name];
  if (engine.currentDB === name) engine.currentDB = null;
  return { out: `Query OK, database '${name}' dropped.` };
}

function showDatabases(engine){
  const names = Object.keys(engine.databases);
  const header = '+--------------------+\n| Database           |\n+--------------------+';
  const rows = names.map(n=>`| ${n.padEnd(18)} |`).join('\n');
  return { out: `${header}\n${rows || '| (none)            |'}\n+--------------------+\n${names.length} row(s) in set` };
}

function useDatabase(engine, stmt){
  const m = /USE\s+`?([A-Za-z0-9_]+)`?/i.exec(stmt);
  if (!m) return { out: 'ERROR: Syntax: USE <dbname>;' };
  const name = m[1];
  if (!engine.databases[name]) return { out: `ERROR: Unknown database '${name}'.` };
  engine.currentDB = name;
  return { out: `Database changed to ${name}` };
}

function createTable(engine, stmt){
  const ok = ensureDB(engine); if (ok.err) return { out: ok.err };
  const m = /CREATE\s+TABLE\s+`?([A-Za-z0-9_]+)`?\s*\((.*)\)$/is.exec(stmt);
  if (!m) return { out: 'ERROR: Syntax: CREATE TABLE <name> (cols...);' };
  const tableName = m[1];
  const colsStr = m[2];
  const table = { columns: [], rows: [] };
  const colDefs = parseIdentifiersList(colsStr);
  let primaryKey = null;
  colDefs.forEach(def => {
    const parts = def.split(/\s+/);
    const colName = normalizeIdent(parts[0].replace(/,$/,''));
    if (!colName) return;
    const type = (parts[1]||'VARCHAR(255)');
    const flags = upper(def);
    const isAuto = flags.includes('AUTO_INCREMENT');
    const isPK = flags.includes('PRIMARY KEY');
    table.columns.push({ name: colName, type, auto: isAuto, pk: isPK });
    if (isPK) primaryKey = colName;
  });
  const db = engine.databases[engine.currentDB];
  if (db.tables[tableName]) return { out: `ERROR: Table '${tableName}' already exists.` };
  db.tables[tableName] = table;
  // init autoinc counters
  table.columns.forEach(c => {
    if (c.auto) engine.autoinc[`${engine.currentDB}.${tableName}.${c.name}`] = 1;
  });
  return { out: `Query OK, table '${tableName}' created with ${table.columns.length} column(s).` };
}

function dropTable(engine, stmt){
  const ok = ensureDB(engine); if (ok.err) return { out: ok.err };
  const m = /DROP\s+TABLE\s+`?([A-Za-z0-9_]+)`?/i.exec(stmt);
  if (!m) return { out: 'ERROR: Syntax: DROP TABLE <name>;' };
  const t = m[1];
  const db = engine.databases[engine.currentDB];
  if (!db.tables[t]) return { out: `ERROR: Unknown table '${t}'.` };
  delete db.tables[t];
  return { out: `Query OK, table '${t}' dropped.` };
}

function showTables(engine){
  const ok = ensureDB(engine); if (ok.err) return { out: ok.err };
  const db = engine.databases[engine.currentDB];
  const names = Object.keys(db.tables);
  const header = '+--------------------+\n| Tables_in_' + engine.currentDB.padEnd(10) + '|\n+--------------------+';
  const rows = names.map(n=>`| ${n.padEnd(18)} |`).join('\n');
  return { out: `${header}\n${rows || '| (none)            |'}\n+--------------------+\n${names.length} row(s) in set` };
}

function describeTable(engine, stmt){
  const ok = ensureDB(engine); if (ok.err) return { out: ok.err };
  const m = /(DESCRIBE|DESC)\s+`?([A-Za-z0-9_]+)`?/i.exec(stmt);
  if (!m) return { out: 'ERROR: Syntax: DESCRIBE <table>;' };
  const t = m[2];
  const db = engine.databases[engine.currentDB];
  const table = db.tables[t];
  if (!table) return { out: `ERROR: Unknown table '${t}'.` };
  const header = '+-----------+--------------+------+-----+---------+----------------+\n| Field     | Type         | Null | Key | Default | Extra          |\n+-----------+--------------+------+-----+---------+----------------+';
  const rows = table.columns.map(c=>{
    const key = c.pk ? 'PRI' : '';
    const extra = c.auto ? 'auto_increment' : '';
    const line = `| ${c.name.padEnd(9)} | ${String(c.type).padEnd(12)} | NO   | ${key.padEnd(3)} | NULL    | ${extra.padEnd(14)} |`;
    return line;
  }).join('\n');
  return { out: `${header}\n${rows}\n+-----------+--------------+------+-----+---------+----------------+\n${table.columns.length} row(s) in set` };
}

function parseValuesList(valsStr){
  // supports multiple row groups: (..),(..)
  const rows = [];
  let depth = 0, cur = '';
  for (let i=0;i<valsStr.length;i++){
    const ch = valsStr[i];
    if (ch==='(') { if (depth++>0) cur+=ch; continue; }
    if (ch===')') { if (--depth>0) { cur+=ch; continue; } rows.push(cur); cur=''; continue; }
    if (depth>0) cur += ch;
  }
  return rows.map(r=> parseIdentifiersList(r).map(v=> parseLiteral(v.trim())) );
}

function parseLiteral(token){
  const t = token.trim();
  if (t.match(/^NULL$/i)) return null;
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) return t.slice(1,-1);
  if (/^\d+$/.test(t)) return Number(t);
  if (/^\d+\.\d+$/.test(t)) return Number(t);
  // bareword -> treat as string identifier literal
  return t.replace(/^`|`$/g,'');
}

function insertInto(engine, stmt){
  const ok = ensureDB(engine); if (ok.err) return { out: ok.err };
  const m = /INSERT\s+INTO\s+`?([A-Za-z0-9_]+)`?\s*(\(([^)]*)\))?\s*VALUES\s*(.*)$/is.exec(stmt);
  if (!m) return { out: 'ERROR: Syntax: INSERT INTO <table> [(cols,...)] VALUES (...);' };
  const tableName = m[1];
  const colsPart = m[3] ? parseIdentifiersList(m[3]).map(c=>normalizeIdent(c.replace(/`/g,''))) : null;
  const valsPart = m[4];
  const db = engine.databases[engine.currentDB];
  const table = db.tables[tableName];
  if (!table) return { out: `ERROR: Unknown table '${tableName}'.` };
  const valuesRows = parseValuesList(valsPart);
  let affected = 0;
  const autokeys = table.columns.filter(c=>c.auto).map(c=>c.name);
  const allCols = table.columns.map(c=>c.name);

  for (const rowVals of valuesRows){
    const row = {};
    if (colsPart) {
      if (rowVals.length !== colsPart.length) return { out: 'ERROR: Column count doesn\'t match value count.' };
      allCols.forEach(c=> row[c] = null);
      colsPart.forEach((c,i)=> row[c] = rowVals[i]);
    } else {
      if (rowVals.length > allCols.length) return { out: 'ERROR: Too many values.' };
      allCols.forEach((c,i)=> row[c] = (i < rowVals.length ? rowVals[i] : null));
    }
    // handle autoincrement
    for (const col of autokeys){
      if (row[col] === null || typeof row[col] === 'undefined') {
        const key = `${engine.currentDB}.${tableName}.${col}`;
        row[col] = engine.autoinc[key] ?? 1;
        engine.autoinc[key] = row[col] + 1;
      }
    }
    table.rows.push(row); affected++;
  }
  return { out: `Query OK, ${affected} row(s) affected` };
}

function selectFrom(engine, stmt, { vertical }){
  const ok = ensureDB(engine); if (ok.err) return { out: ok.err };
  // Basic SELECT parser
  const m = /SELECT\s+([\s\S]+?)\s+FROM\s+`?([A-Za-z0-9_]+)`?(?:\s+WHERE\s+([\s\S]*?))?(?:\s+ORDER\s+BY\s+([A-Za-z0-9_`]+)\s*(ASC|DESC)?)?(?:\s+LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?)?\s*$/i.exec(stmt);
  if (!m) return { out: 'ERROR: Syntax: SELECT <cols> FROM <table> [WHERE ...] [ORDER BY col [ASC|DESC]] [LIMIT n [OFFSET m]];' };
  const colsStr = m[1].trim();
  const tableName = m[2];
  const whereStr = m[3];
  const orderColRaw = m[4];
  const orderDir = (m[5] || 'ASC').toUpperCase();
  const limitN = m[6] ? Number(m[6]) : null;
  const offsetN = m[7] ? Number(m[7]) : 0;

  const db = engine.databases[engine.currentDB];
  const table = db.tables[tableName];
  if (!table) return { out: `ERROR: Unknown table '${tableName}'.` };

  const where = parseWhere(whereStr);
  let rows = table.rows.filter(r=> evalExpr(r, where));

  // order
  if (orderColRaw){
    const orderCol = normalizeIdent(orderColRaw.replace(/`/g,''));
    rows.sort((a,b)=>{
      const va = a[orderCol]; const vb = b[orderCol];
      if (va == null && vb == null) return 0;
      if (va == null) return -1; if (vb == null) return 1;
      if (va < vb) return orderDir==='ASC' ? -1 : 1;
      if (va > vb) return orderDir==='ASC' ? 1 : -1;
      return 0;
    });
  }

  if (offsetN) rows = rows.slice(offsetN);
  if (limitN != null) rows = rows.slice(0, limitN);

  // projection
  let selectedCols;
  if (colsStr === '*') selectedCols = table.columns.map(c=>c.name);
  else selectedCols = colsStr.split(',').map(s=>normalizeIdent(s.trim().replace(/`/g,'')));

  // COUNT(*) shortcut
  if (/^COUNT\(\*\)$/i.test(colsStr)){
    const txt = '+----------+\n| COUNT(*) |\n+----------+\n| ' + String(rows.length).padEnd(8) + ' |\n+----------+';
    return { out: `${txt}\n1 row in set` };
  }

  if (vertical){
    // \G style output
    let out = '';
    rows.forEach((r, idx)=>{
      out += `*************************** ${idx+1}. row ***************************\n`;
      selectedCols.forEach(c=>{
        out += `${c}: ${r[c] == null ? 'NULL' : r[c]}\n`;
      });
    });
    out += `${rows.length} row(s) in set`;
    return { out };
  }

  // table output
  const widths = {};
  selectedCols.forEach(c=> widths[c] = Math.max(c.length, 3));
  rows.forEach(r=> selectedCols.forEach(c=> widths[c] = Math.max(widths[c], String(r[c] ?? 'NULL').length)));
  const headerLine = '+' + selectedCols.map(c=> '-'.repeat(widths[c]+2)).join('+') + '+';
  const headerNames = '|' + selectedCols.map(c=> ' ' + c.padEnd(widths[c]) + ' ').join('|') + '|';
  const body = rows.map(r=> '|' + selectedCols.map(c=> ' ' + String(r[c] ?? 'NULL').padEnd(widths[c]) + ' ').join('|') + '|').join('\n');
  const out = `${headerLine}\n${headerNames}\n${headerLine}\n${body || ''}\n${headerLine}\n${rows.length} row(s) in set`;
  return { out };
}

function updateTable(engine, stmt){
  const ok = ensureDB(engine); if (ok.err) return { out: ok.err };
  const m = /UPDATE\s+`?([A-Za-z0-9_]+)`?\s+SET\s+([\s\S]+?)(?:\s+WHERE\s+([\s\S]*))?$/i.exec(stmt);
  if (!m) return { out: 'ERROR: Syntax: UPDATE <table> SET col=val[, ...] [WHERE ...];' };
  const tableName = m[1];
  const setStr = m[2];
  const whereStr = m[3];
  const db = engine.databases[engine.currentDB];
  const table = db.tables[tableName];
  if (!table) return { out: `ERROR: Unknown table '${tableName}'.` };
  const assigns = parseIdentifiersList(setStr).map(s=>{
    const mm = /`?([A-Za-z0-9_]+)`?\s*=\s*([\s\S]+)/.exec(s);
    if (!mm) return null;
    return { col: normalizeIdent(mm[1]), val: parseLiteral(mm[2]) };
  }).filter(Boolean);
  const where = parseWhere(whereStr);
  let affected = 0;
  table.rows.forEach(r=>{
    if (evalExpr(r, where)) { assigns.forEach(a=> r[a.col] = a.val); affected++; }
  });
  return { out: `Query OK, ${affected} row(s) affected` };
}

function deleteFrom(engine, stmt){
  const ok = ensureDB(engine); if (ok.err) return { out: ok.err };
  const m = /DELETE\s+FROM\s+`?([A-Za-z0-9_]+)`?(?:\s+WHERE\s+([\s\S]*))?$/i.exec(stmt);
  if (!m) return { out: 'ERROR: Syntax: DELETE FROM <table> [WHERE ...];' };
  const tableName = m[1];
  const whereStr = m[2];
  const db = engine.databases[engine.currentDB];
  const table = db.tables[tableName];
  if (!table) return { out: `ERROR: Unknown table '${tableName}'.` };
  const where = parseWhere(whereStr);
  const before = table.rows.length;
  table.rows = table.rows.filter(r=> !evalExpr(r, where));
  const affected = before - table.rows.length;
  return { out: `Query OK, ${affected} row(s) affected` };
}

function helpText(){
  return [
    'Supported SQL:',
    '  CREATE DATABASE name;  DROP DATABASE name;  SHOW DATABASES;',
    '  USE dbname;  SHOW TABLES;  CREATE TABLE t (...);  DROP TABLE t;  DESCRIBE t;',
    '  INSERT INTO t [(cols,...)] VALUES (...),(...);',
    '  SELECT cols FROM t [WHERE ...] [ORDER BY col [ASC|DESC]] [LIMIT n [OFFSET m]];',
    '  UPDATE t SET col=val[, ...] [WHERE ...];',
    '  DELETE FROM t [WHERE ...];',
    '',
    'Meta (client) commands:',
    '  HELP or \\h      : show this help',
    '  STATUS or \\s    : show client/server status (simulated)',
    '  CLEAR / \\! cls  : clear screen',
    '  HISTORY          : show history',
    '  \\c              : cancel current buffer',
    '  end SELECT with \\G to print vertical rows',
  ].join('\n');
}

// ---------------------- UI Component ----------------------
function ToolbarButton({ icon:Icon, label, onClick }){
  return (
    <button 
      onClick={onClick} 
      className="flex items-center gap-1 sm:gap-2 px-2 py-2 sm:px-3 sm:py-2 rounded-xl sm:rounded-2xl shadow-sm border hover:shadow-md transition text-xs sm:text-sm whitespace-nowrap"
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function usePersistentState(key, initial){
  const [val, setVal] = useState(()=>{
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; } catch { return initial; }
  });
  useEffect(()=>{ try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }, [key, val]);
  return [val, setVal];
}

export default function MySQLTerminalSimulator(){
  const [engine, setEngine] = usePersistentState('mysql-sim-engine', createEmptyEngine());
  const [output, setOutput] = usePersistentState('mysql-sim-output', []);
  const [buffer, setBuffer] = useState('');
  const [verticalMode, setVerticalMode] = useState(false);
  const [multiline, setMultiline] = useState(false);
  const inputRef = useRef(null);

  useEffect(()=>{ inputRef.current?.focus(); }, []);

  function appendOut(text){
    setOutput(o=>[...o, text]);
  }

  function runStatement(stmt){
    const e = clone(engine);
    const res = evaluate(e, stmt);
    e.history.push(stmt);
    setEngine(e);
    if (res.clearScreen) setOutput([]);
    if (res.out) appendOut(formatPrompt(stmt) + '\n' + res.out + '\n');
  }

  function formatPrompt(stmt){
    return `mysql> ${stmt}`;
  }

  function onEnter(){
    const text = buffer.trim();
    if (!text) return;
    // detect multi-line if no ; or \G
    const ends = /;\s*$|\\G\s*$/m.test(text);
    if (!ends){ setMultiline(true); setBuffer(prev=>prev+'\n'); return; }
    setMultiline(false);
    runStatement(text);
    setBuffer('');
  }

  function handleKey(e){
    if (e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      onEnter();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='l'){
      e.preventDefault(); setOutput([]);
    }
  }

  function seedSample(){
    const e = clone(engine);
    if (!e.databases['school']) e.databases['school'] = { tables: {} };
    e.currentDB = 'school';
    e.databases['school'].tables['students'] = {
      columns: [
        { name: 'student_id', type: 'INT', auto: true, pk: true },
        { name: 'first_name', type: 'VARCHAR(50)', auto: false, pk: false },
        { name: 'last_name', type: 'VARCHAR(50)', auto: false, pk: false },
        { name: 'age', type: 'INT', auto: false, pk: false },
        { name: 'course', type: 'VARCHAR(50)', auto: false, pk: false },
      ],
      rows: [
        { student_id: 1, first_name: 'Mark', last_name: 'Lendio', age: 21, course: 'BSIT' },
        { student_id: 2, first_name: 'Anna', last_name: 'Lopez', age: 20, course: 'BSCS' },
        { student_id: 3, first_name: 'John', last_name: 'Cruz', age: 22, course: 'BSIT' },
      ]
    };
    e.autoinc['school.students.student_id'] = 4;
    setEngine(e);
    appendOut(`[${now()}] Seeded sample DB 'school' with table 'students'.`);
  }

  function resetAll(){
    setEngine(createEmptyEngine());
    setOutput([]);
    setBuffer('');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-black text-slate-100 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6" />
            <h1 className="text-xl font-semibold">MySQL Web Terminal</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <ToolbarButton icon={Info} label="Help" onClick={()=> appendOut(helpText())} />
            <ToolbarButton icon={Play} label="Seed Sample" onClick={seedSample} />
            <ToolbarButton icon={Eraser} label="Clear" onClick={()=> setOutput([])} />
            <ToolbarButton icon={Trash2} label="Reset" onClick={resetAll} />
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4">
          <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="bg-black/50 rounded-2xl shadow-xl border border-white/10 p-4">
            <div className="font-mono text-xs text-slate-400 mb-2">Type SQL and press Enter. Commands end with <span className="text-slate-200">;</span> or <span className="text-slate-200">\\G</span></div>
            <div className="bg-black rounded-xl p-3 h-64 sm:h-[420px] overflow-auto border border-white/10">
              <pre className="whitespace-pre-wrap text-sm leading-relaxed">{output.join('\n')}</pre>
            </div>
            <div className="mt-3 flex items-start gap-2">
              <span className="font-mono mt-3 text-sm">mysql&gt;</span>
              <textarea
                ref={inputRef}
                value={buffer}
                onChange={e=> setBuffer(e.target.value)}
                onKeyDown={handleKey}
                placeholder={multiline?"(multi-line) end with ; or \\G":"Enter SQL or type HELP"}
                className="flex-1 bg-black/70 border border-white/10 rounded-xl p-3 font-mono text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button onClick={onEnter} className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 shadow h-12 w-12 flex items-center justify-center">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>

          <motion.div initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} className="bg-white/5 rounded-2xl shadow-xl border border-white/10 p-4 space-y-4">
            <h2 className="text-lg font-semibold">Quick Start</h2>
            <ol className="list-decimal list-inside space-y-2 text-slate-200 text-sm">
              <li>Click <b>Seed Sample</b> (creates DB <code>school</code> with <code>students</code> table).</li>
              <li>Try: <code className="bg-black/40 px-1 rounded">SELECT * FROM students;</code></li>
              <li>Insert: <code className="bg-black/40 px-1 rounded">INSERT INTO students (first_name,last_name,age,course) VALUES ('Ranz','Gutierrez',20,'BSIT');</code></li>
              <li>Update: <code className="bg-black/40 px-1 rounded">UPDATE students SET course='BSCS' WHERE first_name='Mark';</code></li>
              <li>Delete: <code className="bg-black/40 px-1 rounded">DELETE FROM students WHERE age &lt; 21;</code></li>
            </ol>
            <h3 className="font-semibold mt-4">Supported Commands</h3>
            <ul className="list-disc list-inside text-sm text-slate-200 space-y-1">
              <li><code>HELP</code>, <code>STATUS</code>, <code>HISTORY</code></li>
              <li><code>CLEAR</code> or <code>\! cls</code> (clear screen), <code>\c</code> (cancel buffer)</li>
              <li>End SELECT with <code>\G</code> for vertical output</li>
            </ul>
            <h3 className="font-semibold mt-4">Examples</h3>
            <div className="text-xs space-y-2 bg-black/30 rounded-xl p-3 font-mono overflow-x-auto">
{`
CREATE DATABASE school;
USE school;
CREATE TABLE students (
  student_id INT PRIMARY KEY AUTO_INCREMENT,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  age INT,
  course VARCHAR(50)
);
INSERT INTO students (first_name,last_name,age,course) VALUES
  ('Mark','Lendio',21,'BSIT'),
  ('Anna','Lopez',20,'BSCS');
SELECT * FROM students ORDER BY age DESC LIMIT 5;
SELECT COUNT(*) FROM students;
`}
            </div>
            <p className="text-xs text-slate-400">Note: This is a learning simulator. Syntax coverage is practical but not perfect.</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
