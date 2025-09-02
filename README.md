# MySQL Web Terminal Simulator

A browser-based MySQL terminal simulator built with React. Practice SQL commands in a realistic terminal environment without needing a database server.

## Features

- **Realistic MySQL Terminal**: Simulates a MySQL command-line interface in the browser
- **Full SQL Support**: CREATE, DROP, SELECT, INSERT, UPDATE, DELETE operations
- **Database Management**: Create and manage multiple databases and tables
- **Persistent Storage**: Your databases are saved in browser localStorage
- **Import/Export**: Save your work as JSON and load it later
- **Responsive Design**: Works on desktop and mobile devices
- **No Server Required**: Everything runs client-side in the browser

## Supported SQL Commands

- `CREATE DATABASE database_name;`
- `DROP DATABASE database_name;`
- `SHOW DATABASES;`
- `USE database_name;`
- `CREATE TABLE table_name (column definitions);`
- `DROP TABLE table_name;`
- `SHOW TABLES;`
- `DESCRIBE table_name;` or `DESC table_name;`
- `INSERT INTO table_name [(columns)] VALUES (values);`
- `SELECT columns FROM table_name [WHERE conditions] [ORDER BY column] [LIMIT n];`
- `UPDATE table_name SET column=value [WHERE conditions];`
- `DELETE FROM table_name [WHERE conditions];`

## Meta Commands

- `HELP` or `\h` - Show help
- `STATUS` or `\s` - Show server status
- `CLEAR` or `\! cls` - Clear screen
- `HISTORY` - Show command history
- `\c` - Cancel current buffer
- End SELECT with `\G` for vertical output

## Quick Start

1. Click "Seed Sample" to create a sample database
2. Try: `SELECT * FROM students;`
3. Insert a row: `INSERT INTO students (first_name,last_name,age,course) VALUES ('John','Doe',25,'BSCS');`
4. Update: `UPDATE students SET course='BSIT' WHERE first_name='John';`
5. Delete: `DELETE FROM students WHERE age < 21;`

## Development

This project is built with:
- React
- Vite
- Tailwind CSS
- Framer Motion
- Lucide React Icons

### Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Build for production: `npm run build`

## Deployment

Deploy to GitHub Pages:
1. Create a new repository on GitHub
2. Update the `homepage` field in package.json to point to your GitHub Pages URL
3. Run `npm run deploy`

## License

MIT