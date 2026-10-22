const { MongoClient } = require("mongodb");

let database;

async function connectToDatabase() {
    const uri = process.env.mongoURI || process.env.MONGODB_URI;

    if (!uri) {
        throw new Error("Set mongoURI or MONGODB_URI in the environment.");
    }

    const client = new MongoClient(uri);
    await client.connect();
    database = client.db();

    return database;
}

function getDatabase() {
    if (!database) {
        throw new Error("Database has not been connected.");
    }

    return database;
}

module.exports = { connectToDatabase, getDatabase };