const { AuthenticationError } = require('apollo-server');
const { RealmApiClient } = require('../../utils/Realm');
const realmApi = new RealmApiClient();
const { dbClient, dbName } = require('../../config/mongo');
const sgMail = require('@sendgrid/mail');
const jwt = require('jsonwebtoken');

const getTokenByEmailAndPassword = async (_, args, context) => {
  try {
    const { access_token, refresh_token, user_id } = await realmApi.getEmailPasswordAccessToken(
      args.email,
      args.password
    );

    const reqDbUser = await dbClient
        .db(dbName)
        .collection('users')
        .findOne({ stitchId: user_id });

    if ( reqDbUser && reqDbUser?.status === 'pending' ){
      throw new Error('User not confirmed')
    }

    const accessTokenExpiry = new Date(jwt.decode(access_token).exp * 1000);
    const refreshTokenExpiry = new Date(jwt.decode(refresh_token).exp * 1000);

    context.res
      .cookie('access_token', access_token, {
        expires: accessTokenExpiry,
        httpOnly: true,
        sameSite: 'lax',
        domain: process.env.NODE_ENV === 'development' ? 'localhost' : process.env.COOKIE_DOMAIN,
        secure: process.env.NODE_ENV === 'development' ? false : true,
      })
      .cookie('refresh_token', refresh_token, {
        expires: refreshTokenExpiry,
        httpOnly: true,
        sameSite: 'lax',
        domain: process.env.NODE_ENV === 'development' ? 'localhost' : process.env.COOKIE_DOMAIN,
        secure: process.env.NODE_ENV === 'development' ? false : true,
      });

    return { access_token, refresh_token, user_id };
  } catch (e) {
    throw new AuthenticationError(e);
  }
};

const getAccessTokenByRefreshToken = async (_, args, context) => {
  try {
    const access_token = await realmApi.getAccessTokenByRefreshToken(args.refresh_token);
    return access_token ;
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

const registerUser = async (_, args, context) => {
  let isAdmin = false;

  try {
    const { email, password, displayName, username } = args.user;

    const realmUser = await realmApi.registerUser(email, password);
    const currentDate = new Date();

    const reqUserId = jwt.decode(context.req.cookies.access_token)?.sub;

    if (reqUserId) {
      const reqDbUser = await dbClient
        .db(dbName)
        .collection('users')
        .findOne({ stitchId: reqUserId });
      isAdmin = reqDbUser?.role === 'admin';
    }

    let user = {
      stitchId: realmUser.id,
      displayName: displayName,
      role: isAdmin ? 'customer' : 'member',
      email: email,
      status: 'pending',
      username: username,
      createdAt: currentDate,
      updatedAt: currentDate,
    };

    await dbClient.db(dbName).collection('users').insertOne(user);

    let token = jwt.sign({ id: realmUser.id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: user.email,
      from: {
        name: 'The Lookbook Team',
        email: 'fred@teammysquad.com',
      },
      templateId: 'd-b4712b8325e74eab98976c4ba0bcd5b9',
      dynamic_template_data: {
        link: process.env.FRONTEND_URL + `confirm-email/${token}`,
        name: user.displayName,
      },
    };

    await sgMail.send(msg);

    return true;
  } catch (e) {
    throw e;
  }
};

const assertIsLoggedIn = async (context) => {
  try {
    if (!context.req.cookies.access_token) {
      throw new Error('Unauthorized');
    }

    await realmApi.isAccessTokenValid(context.req.cookies.access_token);

    const reqUserId = jwt.decode(context.req.cookies.access_token)?.sub;
    const reqDbUser = await dbClient
      .db(dbName)
      .collection('users')
      .findOne({ stitchId: reqUserId });

    if (!reqDbUser) {
      throw new Error('User not found');
    }
  } catch (e) {
    throw e;
  }
};

const assertIsLoggedInAsAdminOrProfileId = async (context, id) => {
  try {
    if (!context.req.cookies.access_token) {
      throw new Error('Unauthorized');
    }

    await realmApi.isAccessTokenValid(context.req.cookies.access_token);

    const reqUserId = jwt.decode(context.req.cookies.access_token)?.sub;
    const reqDbUser = await dbClient
      .db(dbName)
      .collection('users')
      .findOne({ stitchId: reqUserId });
    if (!reqDbUser) {
      throw new Error('User not found');
    }

    const isAdmin = reqDbUser?.role === 'admin';
    const isSameProfile = reqDbUser._id.toString() === id;

    if (isAdmin || isSameProfile) {
      return true;
    }

    throw new Error('Forbidden');
  } catch (e) {
    throw e;
  }
};

const assertIsLoggedInAsAdmin = async (context) => {
  try {
    if (!context.req.cookies.access_token) {
      throw new Error('Unauthorized');
    }

    await realmApi.isAccessTokenValid(context.req.cookies.access_token);

    const reqUserId = jwt.decode(context.req.cookies.access_token)?.sub;

    const reqDbUser = await dbClient
      .db(dbName)
      .collection('users')
      .findOne({ stitchId: reqUserId });

    if (!reqDbUser) {
      throw new Error('User not found');
    }
    const isAdmin = reqDbUser?.role === 'admin';

    if (!isAdmin) {
      throw new Error('Forbidden');
    }
  } catch (e) {
    throw e;
  }
};

module.exports = {
  queries: {
    getTokenByEmailAndPassword,
    getAccessTokenByRefreshToken
  },
  mutations: {
    registerUser,
  },
  helper: {
    assertAuthenticated,
    assertIsLoggedIn,
    assertIsLoggedInAsAdmin,
    assertIsLoggedInAsAdminOrProfileId,
  },
};
