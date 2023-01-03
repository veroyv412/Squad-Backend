'use strict';

const MongoClient = require('mongodb').MongoClient;
const dotenv = require('dotenv');
dotenv.config();

const uri = process.env.MONGO_BD_URL;
const dbClient = new MongoClient(uri, { useNewUrlParser: true,  useUnifiedTopology: true });
const dbName = process.env.DB_NAME;

console.log('process.env.MONGO_BD_URL', process.env.MONGO_BD_URL);
console.log('Backend URI', uri);
console.log('dbClient', dbClient);
console.log('dbName', dbName);

module.exports.dbClient = dbClient;
module.exports.dbName = dbName;