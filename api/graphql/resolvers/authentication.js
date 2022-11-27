const { AuthenticationError } = require('apollo-server');
const { RealmApiClient } = require('../../utils/Realm')

const realmApi = new RealmApiClient();

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

module.exports = {
    queries: {
        getTokenByEmailAndPassword
    },
    mutations: {

    },
    helper: {
        assertAuthenticated
    }
}