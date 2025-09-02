# MySQL Web Terminal Simulator

A browser-based MySQL terminal simulator built with React, Tailwind CSS, and Framer Motion. This tool allows you to practice SQL commands without needing a real database server.

## Features

- **Full SQL Support**: CREATE, DROP, SHOW databases/tables, SELECT, INSERT, UPDATE, DELETE
- **MySQL Client Commands**: HELP, STATUS, HISTORY, CLEAR
- **Persistent Storage**: Your databases are saved in browser localStorage
- **Import/Export**: Save and load your work as JSON files
- **Sample Data**: Seed a sample database with one click
- **Responsive Design**: Works on desktop and mobile devices

## Supported SQL Commands

### Database Operations
- `CREATE DATABASE name;`
- `DROP DATABASE name;`
- `SHOW DATABASES;`
- `USE dbname;`

### Table Operations
- `CREATE TABLE t (col definitions);`
- `DROP TABLE t;`
- `SHOW TABLES;`
- `DESCRIBE t;` / `DESC t;`

### Data Operations
- `INSERT INTO t [(cols,...)] VALUES (...), (...);`
- `SELECT cols FROM t [WHERE ...] [ORDER BY col [ASC|DESC]] [LIMIT n [OFFSET m]];`
- `UPDATE t SET col=val[, ...] [WHERE ...];`
- `DELETE FROM t [WHERE ...];`

### Client Commands
- `HELP` or `\h` - Show help
- `STATUS` or `\s` - Show client/server status
- `CLEAR` or `\! cls` - Clear screen
- `HISTORY` - Show command history
- `\c` - Cancel current buffer
- End SELECT with `\G` for vertical output

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```bash
   cd mysql-web-terminal-simulator
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
src/
├── MySQLTerminalSimulator.jsx  # Main component
├── main.jsx                    # Entry point
├── index.css                   # Global styles
└── assets/                     # Static assets
```

## Technologies Used

- [React](https://reactjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [Lucide React](https://lucide.dev/)
- [Vite](https://vitejs.dev/)

## License

This project is licensed under the MIT License.