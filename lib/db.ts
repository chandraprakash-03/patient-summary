import { Pool } from "pg";

// Database configuration
// Allow explicit control of SSL via DB_SSL. If DB_SSL is not set,
// default to enabling SSL only in production and only when not connecting to localhost.
const dbHost = process.env.DB_HOST || "localhost";
const envDbSsl = process.env.DB_SSL;
const defaultSslForProd =
	process.env.NODE_ENV === "production" &&
	dbHost !== "localhost" &&
	dbHost !== "127.0.0.1";
const useSsl =
	typeof envDbSsl !== "undefined" ? envDbSsl === "true" : defaultSslForProd;

const dbConfig = {
	user: process.env.DB_USER || "postgres",
	host: dbHost,
	database: process.env.DB_NAME || "your_database",
	password: process.env.DB_PASSWORD || "password",
	port: parseInt(process.env.DB_PORT || "5432"),
	ssl: useSsl ? { rejectUnauthorized: false } : false,
};



// Create a connection pool
const pool = new Pool(dbConfig);

// Test connection
pool.on("connect", () => {
	console.log("Connected to PostgreSQL database");
});

pool.on("error", (err) => {
	console.error("Database connection error:", err);
});

export default pool;

// Helper function to execute queries
export const query = async (text: string, params?: unknown[]) => {
	const client = await pool.connect();
	try {
		const result = await client.query(text, params);
		return result;
	} catch (error) {
		console.error("Database query error:", error);
		throw error;
	} finally {
		client.release();
	}
};
