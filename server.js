require('events').EventEmitter.defaultMaxListeners = Infinity
const logger = require('./logger');

const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const { ApolloServer } = require('apollo-server-express');;

const { dbClient } = require('./api/config/mongo');

const app = express();
const cors = require('cors');

const firebaseAdmin = require('firebase-admin');
const serviceAccount = require('./api/config/service-account.json'); /*-> This refers to the google cloud service account, [Learn How to Get it From](https://firebase.google.com/docs/admin/setup)*/

firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount),
    databaseURL: "https://squad-b2c2b.firebaseio.com/"
});

const database = firebaseAdmin.firestore();
const settings = {timestampsInSnapshots: true};
database.settings(settings);

const startServer = async () => {

    /*
      The above code initializes firebase-admin globally
    */
    app.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers",
            "Origin, X-Requested-With, Content-Type, Accept, Authorization");

        if (req.method === "OPTIONS") {
            res.header('Access-Control-Allow-Methods', 'POST,GET');
            return res.status(200).json({});
        }
        next();
    });

    app.use(cors());
    app.use(express.urlencoded({ extended: false }));
    app.use(logger.pre);

    const server = new ApolloServer({
        context: async ({ req, res }) => {
            // Get the user token from the headers.
            const token = req.headers.authorization || '';

            // Add the user to the context
            return { token };
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
            require('./api/graphql/modules/authentication')
        ],
        formatResponse: (response, requestContext) => {
            if (response.data?.getTokenByEmailAndPassword) {
                const tokenExpireDate = new Date();
                tokenExpireDate.setDate(tokenExpireDate.getDate() + 1); //+ 1 day
                requestContext.response.http.headers.append("Set-Cookie",
                    `accessToken=${response.data.getTokenByEmailAndPassword.access_token}; expires=${tokenExpireDate}`);
                requestContext.response.http.headers.append("Set-Cookie",
                    `refreshToken=${response.data.getTokenByEmailAndPassword.access_token}; expires=${tokenExpireDate}`);
                requestContext.response.http.headers.append("Set-Cookie",
                    `userId=${response.data.getTokenByEmailAndPassword.user_id}; expires=${tokenExpireDate}`);
            }
            return response;
        },
    });

    server.applyMiddleware({ app, path: '/api/graphql' });

    app.listen({ port: process.env.PORT }, () => {
        dbClient.connect().then((client) => { console.log('Apollo Server on http://localhost:'+process.env.PORT+'/api/graphql');
            console.log('MongoDB Connected'); }).catch(err => { console.log(err) });
    });
}

startServer();
