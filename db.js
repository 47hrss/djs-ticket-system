const { createConnection } = require("mysql");
const { MySQL } = require("./config.json");

const Connection = createConnection({
    host: MySQL?.Host,
    user: MySQL?.User,
    port: MySQL?.Port,
    password: MySQL?.Password,
    database: MySQL?.Database,
    charset: 'utf8mb4_general_ci',
    multipleStatements: true
});

Connection?.connect((err) => {
    if (err) {
        console.log(`[DATABASE] Error while connecting to MySQL (DATABASE: ${MySQL?.Database} | USER: ${MySQL?.User})`);
        process.exit();
    } else {
        Connection.query(`SHOW TABLES`, (err, data) => {
            if (err) throw err;

            console.log(`[DATABASE] Connected to MySQL (DATABASE: ${MySQL?.Database} | USER: ${MySQL?.User} | TABLES: ${data?.length || 0})`)
        });
    };
});

if (MySQL?.AutoCreateMissingTables) {
    const calls = [
        "CREATE TABLE IF NOT EXISTS ticket_system(guild VARCHAR(30) NOT NULL, category VARCHAR(30) NOT NULL, channel VARCHAR(30) NOT NULL, message VARCHAR(30) NOT NULL, role VARCHAR(30) NOT NULL, count BIGINT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS tickets(guild VARCHAR(30) NOT NULL, user VARCHAR(30) NOT NULL, channel VARCHAR(30) NOT NULL)"
    ];
    new Promise((resolve, reject) => {
        Connection.query(calls.join(';'), (err) => {
            if (err) reject(err);
            resolve(null);
        });
    });
};

module.exports = Connection;