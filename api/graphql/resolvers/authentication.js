const { AuthenticationError, ApolloError, ForbiddenError } = require('apollo-server');
const { RealmApiClient } = require('../../utils/Realm');
const realmApi = new RealmApiClient();
const { dbClient, dbName } = require('../../config/mongo');
const sgMail = require('@sendgrid/mail');
const jwt = require('jsonwebtoken');
const express = require('express');

/**
 * @param {express.Response<any, Record<string, any>>} res
 * @param {string} accessToken
 * @param {Record<string, any>} cookieOptions
 */
const setAccessTokenCookie = (res, accessToken, cookieOptions) => {
  const _cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    domain: process.env.NODE_ENV === 'development' ? 'localhost' : process.env.COOKIE_DOMAIN,
    secure: process.env.NODE_ENV === 'development' ? false : true,
    ...cookieOptions,
  };

  if (!accessToken) {
    res.clearCookie('access_token', _cookieOptions);
  } else {
    res.cookie('access_token', accessToken, _cookieOptions);
  }
};

/**
 * @param {express.Response<any, Record<string, any>>} res
 * @param {string} refreshToken
 * @param {Record<string, any>} cookieOptions
 */
const setRefreshTokenCookie = (res, refreshToken, cookieOptions) => {
  const _cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    domain: process.env.NODE_ENV === 'development' ? 'localhost' : process.env.COOKIE_DOMAIN,
    secure: process.env.NODE_ENV === 'development' ? false : true,
    ...cookieOptions,
  };

  if (!refreshToken) {
    res.clearCookie('refresh_token', _cookieOptions);
  } else {
    res.cookie('refresh_token', refreshToken, _cookieOptions);
  }
};

const getTokenByEmailAndPassword = async (_, args, context) => {
  let res;

  try {
    res = await realmApi.getEmailPasswordAccessToken(args.email, args.password);
  } catch (e) {
    throw new AuthenticationError(e);
  }

  const { access_token, refresh_token, user_id } = res;

  const reqDbUser = await dbClient.db(dbName).collection('users').findOne({ stitchId: user_id });

  if (reqDbUser && reqDbUser?.status !== 'confirmed') {
    throw new ApolloError('User not confirmed', 'UNVERIFIED');
  }

  const accessTokenExpiry = new Date(jwt.decode(access_token).exp * 1000);
  setAccessTokenCookie(context.res, access_token, {
    expires: accessTokenExpiry,
  });

  const refreshTokenExpiry = new Date(jwt.decode(refresh_token).exp * 1000);
  setRefreshTokenCookie(context.res, refresh_token, {
    expires: refreshTokenExpiry,
  });

  return { access_token, refresh_token, user_id };
};

const getAccessTokenByRefreshToken = async (_, args, context) => {
  const refreshToken = context.req.cookies['refresh_token'] || args.refresh_token;

  let accessToken;
  try {
    accessToken = await realmApi.getAccessTokenByRefreshToken(refreshToken);
  } catch (e) {
    console.log(e);
    return { success: false };
  }

  const accessTokenExpiry = new Date(jwt.decode(accessToken).exp * 1000);
  setAccessTokenCookie(context.res, accessToken, {
    expires: accessTokenExpiry,
  });

  return { access_token: accessToken, success: true };
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
      currentBalance: 0,
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
      throw new AuthenticationError();
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
      throw new AuthenticationError();
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

    throw new ForbiddenError('Action not allowed');
  } catch (e) {
    throw e;
  }
};

const assertIsLoggedInAsAdmin = async (context) => {
  try {
    if (!context.req.cookies.access_token) {
      throw new AuthenticationError();
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
    getAccessTokenByRefreshToken,
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
