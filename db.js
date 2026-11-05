
const mysql = require("mysql2");

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "root",
    database: "inventory_db"
});

db.connect((err) => {
    if (err) {
        console.log("Database Connection Failed:", err);
        return;
    }

    console.log("MySQL Database Connected Successfully!");
});

module.exports = db;
