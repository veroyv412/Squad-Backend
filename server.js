require('events').EventEmitter.defaultMaxListeners = Infinity;
const logger = require('./logger');

const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cookieParser = require('cookie-parser');
const { ApolloServer } = require('apollo-server-express');

const { dbClient } = require('./api/config/mongo');

const app = express();
const cors = require('cors');

const firebaseAdmin = require('firebase-admin');
const serviceAccount = require('./api/config/service-account.json'); /*-> This refers to the google cloud service account, [Learn How to Get it From](https://firebase.google.com/docs/admin/setup)*/

firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
  databaseURL: 'https://squad-b2c2b.firebaseio.com/',
});

const database = firebaseAdmin.firestore();
const settings = { timestampsInSnapshots: true };
database.settings(settings);

const startServer = async () => {
  app.use(
    cors({
      origin: (origin, callback) => {
        const whitelist = [
          'http://localhost:8000',
          'http://localhost:3000',
          'https://squad-demos.netlify.app',
          'https://thelookbook.io',
        ];
        if (whitelist.indexOf(origin) !== -1 || !origin) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
      methods: ['POST', 'GET'],
      exposedHeaders: ['Set-Cookie'],
      credentials: true,
      optionsSuccessStatus: 200,
    }),
    cookieParser()
  );

  app.use(express.urlencoded({ extended: false }));
  app.use(logger.pre);

  const server = new ApolloServer({
    context: async ({ req, res }) => {
      const token = req.headers.authorization || '';
      return { token, res, req };
    },
    modules: [
      require('./api/graphql/modules/user'),
      require('./api/graphql/modules/customer'),
      require('./api/graphql/modules/brand'),
      require('./api/graphql/modules/category'),
      require('./api/graphql/modules/uploadPhoto'),
      require('./api/graphql/modules/product'),
      require('./api/graphql/modules/compensation'),
      require('./api/graphql/modules/notification'),
      require('./api/graphql/modules/analytics'),
      require('./api/graphql/modules/authentication'),
    ],
  });

  server.applyMiddleware({
    app,
    path: '/api/graphql',
    // cors logic handled in the `cors()` middleware
    cors: false,
  });

  app.listen({ port: process.env.PORT }, () => {
    dbClient
      .connect()
      .then((client) => {
        console.log('Apollo Server on http://localhost:' + process.env.PORT + '/api/graphql');
        console.log('MongoDB Connected');
      })
      .catch((err) => {
        console.log(err);
      });
  });
};

startServer();
