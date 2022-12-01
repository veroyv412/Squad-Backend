const { AuthenticationError } = require('apollo-server');
const { RealmApiClient } = require('../../utils/Realm');
const jwt = require('jsonwebtoken');

const realmApi = new RealmApiClient();

const getTokenByEmailAndPassword = async (_, args, context) => {
	try {
		const { access_token, refresh_token, user_id } =
			await realmApi.getEmailPasswordAccessToken(args.email, args.password);
		const accessTokenExpiry = new Date(jwt.decode(access_token).exp * 1000);
		const refreshTokenExpiry = new Date(jwt.decode(refresh_token).exp * 1000);

		context.res
			.cookie('access_token', access_token, {
				expires: accessTokenExpiry,
				httpOnly: true,
				sameSite: 'lax',
				domain:
					process.env.NODE_ENV === 'development'
						? 'localhost'
						: process.env.COOKIE_DOMAIN,
				secure: process.env.NODE_ENV === 'development' ? false : true,
			})
			.cookie('refresh_token', refresh_token, {
				expires: refreshTokenExpiry,
				httpOnly: true,
				sameSite: 'lax',
				domain:
					process.env.NODE_ENV === 'development'
						? 'localhost'
						: process.env.COOKIE_DOMAIN,
				secure: process.env.NODE_ENV === 'development' ? false : true,
			});

		return { access_token, refresh_token, user_id };
	} catch (e) {
		throw new AuthenticationError(e);
	}
};

const assertAuthenticated = (context) => {
	try {
		return RealmApiClient.getUserFromGraphQL(context.token);
	} catch (e) {
		throw e;
	}
};

module.exports = {
	queries: {
		getTokenByEmailAndPassword,
	},
	mutations: {},
	helper: {
		assertAuthenticated,
	},
};
