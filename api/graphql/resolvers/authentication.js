const { AuthenticationError } = require('apollo-server');
const { RealmApiClient } = require('../../utils/Realm')
const realmApi = new RealmApiClient();
const { dbClient, dbName } = require('../../config/mongo');
const sgMail = require('@sendgrid/mail');
const jwt = require('jsonwebtoken');

const getTokenByEmailAndPassword = async (root, args) => {
    try {
        const { access_token, refresh_token, user_id } = await realmApi.getEmailPasswordAccessToken(args.email, args.password)
        return { access_token, refresh_token, user_id };
    } catch (e){
        throw new AuthenticationError(e);
    }
}

const assertAuthenticated = (context) => {
    try {
        return RealmApiClient.getUserFromGraphQL(context.token)
    } catch (e){
        throw e;
    }
};

const registerUser = async (parent, args) => {
    try {

        const { email, password, displayName, role } = args.user;
        const realmUser = await realmApi.registerUser(email, password);

        let user = {
            stitchId: realmUser.id,
            displayName: displayName,
            role: role ? role : 'member',
            email: email,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await dbClient.db(dbName).collection('users').insertOne(user);

        let token = jwt.sign({id: realmUser.id}, 'squadConfirmationEmailHashThatIsSuperSecure', { expiresIn: '1h' })

        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        const msg = {
            to: user.email,
            from: {
                name: "The Lookbook Team",
                email: "fred@teammysquad.com"
            },
            templateId: "d-b4712b8325e74eab98976c4ba0bcd5b9",
            dynamic_template_data: {
                link: process.env.FRONTEND_URL + `confirm-email/${token}`,
                name: user.displayName
            }
        };

        console.log(msg)

        await sgMail.send(msg);

        return await realmApi.getEmailPasswordAccessToken(email, password)
    } catch (e){
        throw e;
    }
}


module.exports = {
    queries: {
        getTokenByEmailAndPassword
    },
    mutations: {
        registerUser
    },
    helper: {
        assertAuthenticated
    }
}