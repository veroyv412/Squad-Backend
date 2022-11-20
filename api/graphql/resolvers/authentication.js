const { AuthenticationError } = require('apollo-server');
const { RealmApiClient } = require('../../utils/Realm')

const realmApi = new RealmApiClient();

const getTokenByEmailAndPassword = async (root, args) => {
    try {
        const token = await realmApi.getEmailPasswordAccessToken(args.email, args.password)
        return { access_token: token } ;
    } catch (e){
        throw new AuthenticationError(e);
    }
}

module.exports = {
    queries: {
        getTokenByEmailAndPassword
    },
    mutations: {

    }
}