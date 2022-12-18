'use strict';

const MongoClient = require('mongodb').MongoClient;
const dotenv = require('dotenv');
dotenv.config();


const uri = process.env.BD_URL;
const dbClient = new MongoClient(uri, { useNewUrlParser: true,  useUnifiedTopology: true });

console.log('process.env.BD_URL', process.env.BD_URL);
console.log('Backend URI', uri);
console.log('dbClient', dbClient);

const dbName = process.env.DB_NAME;

console.log('dbName', dbName);

module.exports.dbClient = dbClient;
module.exports.dbName = dbName;