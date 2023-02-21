const { dbClient, dbName } = require('../../config/mongo');
const { RealmApiClient } = require('../../utils/Realm');
const realmApi = new RealmApiClient();
const ObjectId = require('mongodb').ObjectId;
const sgMail = require('@sendgrid/mail');
const jwt = require('jsonwebtoken');
const moment = require('moment'); // require

const notificationResolvers = require('../resolvers/notification');
const authenticationResolvers = require('../resolvers/authentication');
const { AuthenticationError } = require('apollo-server-express');

const users = async (root, args, context, info) => {
  await authenticationResolvers.helper.assertIsLoggedIn(context);

  const usersRef = dbClient.db(dbName).collection('users');
  const users = await usersRef.find({}).toArray();

  return users;
};

const user = async (root, { id }, context, info) => {
  if (!context.req.cookies.access_token) {
    throw new AuthenticationError();
  }

  await realmApi.isAccessTokenValid(context.req.cookies.access_token);

  const reqUserId = jwt.decode(context.req.cookies.access_token)?.sub;
  const reqDbUser = await dbClient.db(dbName).collection('users').findOne({ stitchId: reqUserId });
  if (!reqDbUser) {
    throw new Error('User not found');
  }

  const isSameProfile = reqDbUser._id.toString() === id;
  const isAdmin = reqDbUser?.role === 'admin';

  const usersRef = dbClient.db(dbName).collection('users');

  const user = await usersRef.findOne({ _id: new ObjectId(id) });

  if (!user) throw new Error('User does not exist');

  if (isSameProfile || isAdmin) {
    return user;
  } else {
    return {
      _id: user._id,
      displayName: user.displayName,
      username: user.username,
      pictureUrl: user.pictureUrl,
    };
  }
};

const userBy = async (root, { data }, context, info) => {
  if (!context.req.cookies.access_token) {
    throw new AuthenticationError();
  }

  await realmApi.isAccessTokenValid(context.req.cookies.access_token);

  const reqUserId = jwt.decode(context.req.cookies.access_token)?.sub;
  const reqDbUser = await dbClient.db(dbName).collection('users').findOne({ stitchId: reqUserId });
  if (!reqDbUser) {
    throw new Error('User not found');
  }

  const isSameProfile =
    reqDbUser.username.toString() === data || reqDbUser.email.toString() === data;
  const isAdmin = reqDbUser?.role === 'admin';

  const usersRef = dbClient.db(dbName).collection('users');
  let or = {
    $or: [{ username: data }, { email: data }],
  };

  const user = await usersRef.findOne(or);

  if (!user) throw new Error('User does not exist');

  if (isSameProfile || isAdmin) {
    return user;
  } else {
    return {
      _id: user._id,
      displayName: user.displayName,
      username: user.username,
      pictureUrl: user.pictureUrl,
    };
  }
};

const me = async (root, args, context, info) => {
  await authenticationResolvers.helper.assertIsLoggedIn(context);

  const reqUserId = jwt.decode(context.req.cookies.access_token)?.sub;

  const usersRef = dbClient.db(dbName).collection('users');
  const user = await usersRef.findOne({ stitchId: reqUserId });

  return user;
};

const getUserByFirebaseId = async (root, { firebaseId }, context, info) => {
  const usersRef = dbClient.db(dbName).collection('users');
  const user = await usersRef.findOne({ firebaseId: new ObjectId(firebaseId) });

  return user;
};

const getSpotlightMembers = async (root, args, context, info) => {
  let find = {
    homepage: true,
  };

  if (args.brandId) {
    find = { brandId: { $in: [new ObjectId(args.brandId)] } };
  }

  const uploads = await dbClient
    .db(dbName)
    .collection('uploads')
    .aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'memberId',
          foreignField: '_id',
          as: 'member',
        },
      },
      {
        $lookup: {
          from: 'brands',
          localField: 'brandId',
          foreignField: '_id',
          as: 'brand',
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $sort: { createdAt: -1 } },
      { $match: find },
    ])
    .limit(4)
    .toArray();

  for (let upload of uploads) {
    upload.brand = upload.brand[0];
    upload.member = upload.member[0];
    upload.category = upload.category[0];
  }

  return uploads;
};

const isFollowing = async (root, { userId1, userId2 }, context, info) => {
  const followers = await dbClient
    .db(dbName)
    .collection('followers')
    .aggregate([{ $match: { userId1: new ObjectId(userId1), userId2: new ObjectId(userId2) } }])
    .toArray();

  if (followers.length > 0) {
    return true;
  }

  return false;
};

const getUserTotalLooks = async (root, { id }, context, info) => {
  const count = await dbClient
    .db(dbName)
    .collection('uploads')
    .find({ memberId: new ObjectId(id) })
    .count();
  return count;
};

const getUserLastUpdatedDate = async (root, { id }, context, info) => {
  const look = await dbClient
    .db(dbName)
    .collection('uploads')
    .findOne({ $query: { memberId: new ObjectId(id) }, $orderby: { createdAt: -1 } });

  if (look) {
    let mDate = moment(look.createdAt);
    let sDate = mDate.format('MM-DD-YYYY');
    return sDate;
  }

  return null;
};

const getFollowers = async (root, args, context, info) => {
  await authenticationResolvers.helper.assertIsLoggedIn(context);

  let limit = args.limit || 10;
  let offset = args.page || 1;
  offset = (offset - 1) * limit;

  const followersEntries = await dbClient
    .db(dbName)
    .collection('followers')
    .aggregate([
      { $match: { followingId: new ObjectId(args.id) } },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }],
          data: [
            {
              $lookup: {
                from: 'users',
                localField: 'followerId',
                foreignField: '_id',
                as: 'user',
              },
            },
            { $skip: offset },
            { $limit: limit },
          ],
        },
      },
    ])
    .toArray();

  const followers = [];

  for (let followerEntry of followersEntries[0].data) {
    followers.push({
      _id: followerEntry.user[0]._id,
      username: followerEntry.user[0].username,
      displayName: followerEntry.user[0].displayName,
      pictureUrl: followerEntry.user[0].pictureUrl,
    });
  }

  return {
    data: followers,
    metadata: {
      totalCount: followersEntries[0].metadata[0].totalCount,
    },
  };
};

const getFollowings = async (root, args, context, info) => {
  await authenticationResolvers.helper.assertIsLoggedIn(context, args.id);

  let limit = args.limit || 10;
  let offset = args.page || 1;
  offset = (offset - 1) * limit;

  const followingEntries = await dbClient
    .db(dbName)
    .collection('followers')
    .aggregate([
      { $match: { followerId: new ObjectId(args.id) } },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }],
          data: [
            {
              $project: { _id: 0 },
            },
            {
              $lookup: {
                from: 'users',
                localField: 'followingId',
                foreignField: '_id',
                as: 'user',
              },
            },
          ],
        },
      },
    ])
    .toArray();

  const following = [];

  for (let followingEntry of followingEntries[0].data) {
    following.push({
      _id: followingEntry.user[0]._id,
      username: followingEntry.user[0].username,
      displayName: followingEntry.user[0].displayName,
      pictureUrl: followingEntry.user[0].pictureUrl,
    });
  }

  return following;
};

const getLookbookByUserId = async (root, { userId, limit, page }, context, info) => {
  await authenticationResolvers.helper.assertIsLoggedInAsAdminOrProfileId(context, userId);

  let _limit = limit || 10;
  let offset = page || 1;
  offset = (offset - 1) * _limit;

  const lookbook = await dbClient
    .db(dbName)
    .collection('users_lookbook')
    .aggregate([
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryIds',
          foreignField: '_id',
          as: 'categories',
        },
      },
      {
        $lookup: {
          from: 'brands',
          localField: 'brandIds',
          foreignField: '_id',
          as: 'brands',
        },
      },
      {
        $lookup: {
          from: 'uploads',
          localField: 'productIds',
          foreignField: '_id',
          as: 'products',
        },
      },

      {
        $lookup: {
          from: 'uploads',
          localField: 'uploadIds',
          foreignField: '_id',
          as: 'uploads',
        },
      },

      {
        $addFields: {
          brands: '$brands.name',
          categories: '$categories.name',
          products: '$products.productName',
        },
      },
      { $match: { userId: new ObjectId(userId) } },
      { $skip: offset },
      { $limit: _limit },
    ])
    .toArray();

  return lookbook;
};

const getReportedLooks = async (root, args, context, info) => {
  await authenticationResolvers.helper.assertIsLoggedInAsAdmin(context);

  let _limit = args.limit || 10;
  let offset = args.page || 1;
  offset = (offset - 1) * _limit;

  let match = {};
  if (args.filter.lookId) {
    match.lookId = new ObjectId(args.filter.lookId);
  }

  if (args.filter.type) {
    match.type = args.filter.type;
  }

  const reports = await dbClient
    .db(dbName)
    .collection('looks_report')
    .aggregate([
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }],
          data: [
            { $sort: { createdAt: -1 } },
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'users',
              },
            },
            {
              $lookup: {
                from: 'uploads',
                localField: 'lookId',
                foreignField: '_id',
                as: 'looks',
              },
            },
            {
              $addFields: {
                user: { $arrayElemAt: ['$user', 0] },
                look: { $arrayElemAt: ['$looks', 0] },
              },
            },
            { $match: match },
            { $skip: offset },
            { $limit: _limit },
          ],
        },
      },
    ])
    .toArray();

  return {
    data: reports[0].data,
    metadata: {
      totalCount: reports[0].metadata[0].totalCount,
    },
  };
};

const getLookbook = async (root, { id }, context, info) => {
  const lookbook = await dbClient
    .db(dbName)
    .collection('users_lookbook')
    .findOne({ _id: new ObjectId(id) });

  return lookbook;
};

const getMyFeedbackOffers = async (root, args, context, _) => {
  await authenticationResolvers.helper.assertIsLoggedIn(context);

  const reqUserId = jwt.decode(context.req.cookies.access_token)?.sub;

  let limit = args.limit || 10;
  let offset = args.page || 1;
  offset = (offset - 1) * limit;

  const usersRef = dbClient.db(dbName).collection('users');
  const user = await usersRef.findOne({ stitchId: reqUserId });

  const questions = await dbClient.db(dbName).collection('feedback_questions').find({}).toArray();

  const userOffers = await dbClient
    .db(dbName)
    .collection('feedback_offers')
    .aggregate([
      { $match: { $and: [{ memberId: new ObjectId(user._id) }, { active: true }] } },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }],
          data: [
            {
              $lookup: {
                from: 'uploads',
                let: { lookId: '$lookId' },
                pipeline: [
                  { $match: { $expr: { $eq: ['$_id', '$$lookId'] } } },
                  {
                    $lookup: {
                      from: 'brands',
                      let: { brandId: '$brandId' },
                      pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$brandId'] } } }],
                      as: 'brand',
                    },
                  },
                  {
                    $lookup: {
                      from: 'categories',
                      let: { categoryId: '$categoryId' },
                      pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$categoryId'] } } }],
                      as: 'category',
                    },
                  },
                  {
                    $lookup: {
                      from: 'products',
                      let: { productId: '$productId' },
                      pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$productId'] } } }],
                      as: 'product',
                    },
                  },
                  {
                    $addFields: {
                      brand: { $arrayElemAt: ['$brand', 0] },
                      category: { $arrayElemAt: ['$category', 0] },
                      product: { $arrayElemAt: ['$product', 0] },
                    },
                  },
                ],
                as: 'look',
              },
            },
            {
              $addFields: {
                look: { $arrayElemAt: ['$look', 0] },
              },
            },
            { $sort: { createdAt: -1 } },
            { $skip: offset },
            { $limit: limit },
          ],
        },
      },
    ])
    .toArray();

  const offers = userOffers[0].data.map((offer) => ({ ...offer, questions }));

  return {
    data: offers,
    metadata: {
      totalCount: userOffers[0].metadata[0].totalCount,
    },
  };
};

const getUserFeedbacks = async (root, args, context, info) => {
  await authenticationResolvers.helper.assertIsLoggedInAsAdminOrProfileId(context, args.id);

  let limit = args.limit || 10;
  let offset = args.page || 1;
  offset = (offset - 1) * limit;

  let customerFeedbacksUploads = await dbClient
    .db(dbName)
    .collection('customer_feedback')
    .aggregate([
      {
        $lookup: {
          from: 'customer_questions',
          localField: 'questions',
          foreignField: '_id',
          as: 'questions',
        },
      },
      {
        $lookup: {
          from: 'customers',
          localField: 'customerId',
          foreignField: '_id',
          as: 'customer',
        },
      },
      {
        $lookup: {
          from: 'feedback_answers',
          localField: '_id',
          foreignField: 'customerFeedbackId',
          as: 'feedbackAnswers',
        },
      },
      {
        $lookup: {
          from: 'uploads',
          let: { uploads: '$uploads' },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$uploads'] } } },
            {
              $lookup: {
                from: 'users',
                let: { memberId: '$memberId' },
                pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$memberId'] } } }],
                as: 'member',
              },
            },
            {
              $addFields: {
                member: { $arrayElemAt: ['$member', 0] },
              },
            },
            { $match: { 'member._id': new ObjectId(args.id) } },
          ],
          as: 'uploads',
        },
      },
      {
        $addFields: {
          questions: '$questions',
          uploads: '$uploads',
          offerType: 'upload',
          productUrl: { $arrayElemAt: ['$uploads.productUrl', 0] },
          memberUploadId: { $arrayElemAt: ['$uploads._id', 0] },
          customer: { $arrayElemAt: ['$customer', 0] },
        },
      },
      { $match: { 'uploads.member._id': new ObjectId(args.id) } },
      { $match: { 'feedbackAnswers.0': { $exists: false } } },
      { $skip: offset },
      { $limit: limit },
    ])
    .toArray();

  return [...customerFeedbacksUploads];
};

const getUserHistory = async (root, args, context) => {
  await authenticationResolvers.helper.assertIsLoggedInAsAdminOrProfileId(context, args.id);

  let limit = args.limit || 10;
  let offset = args.page || 1;
  offset = (offset - 1) * limit;

  let userHistory = await dbClient
    .db(dbName)
    .collection('earnings_history')
    .aggregate([
      { $match: { userId: new ObjectId(args.id) } },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }],
          data: [
            {
              $lookup: {
                from: 'feedback_offers',
                let: { offerId: '$offerId' },
                pipeline: [
                  { $match: { $expr: { $eq: ['$_id', '$$offerId'] } } },
                  {
                    $lookup: {
                      from: 'uploads',
                      let: { lookId: '$lookId' },
                      pipeline: [
                        { $match: { $expr: { $eq: ['$_id', '$$lookId'] } } },
                        {
                          $lookup: {
                            from: 'brands',
                            localField: 'brandId',
                            foreignField: '_id',
                            as: 'brand',
                          },
                        },
                        {
                          $addFields: {
                            brand: { $arrayElemAt: ['$brand', 0] },
                          },
                        },
                      ],
                      as: 'look',
                    },
                  },
                  {
                    $addFields: {
                      look: { $arrayElemAt: ['$look', 0] },
                    },
                  },
                ],
                as: 'offer',
              },
            },
            {
              $addFields: {
                offer: { $arrayElemAt: ['$offer', 0] },
                date: { $ifNull: [{ $arrayElemAt: ['$offer.updatedAt', 0] }, '$date'] },
              },
            },
            { $sort: { date: -1 } },
            { $skip: offset },
            { $limit: limit },
          ],
        },
      },
    ])
    .toArray();

  for (let historyElement of userHistory[0].data) {
    switch (historyElement.actionType) {
      case 'OFFER_COMPLETED':
        historyElement.__typename = 'OfferHistoryElement';
        break;
      case 'CASHED_OUT':
        historyElement.__typename = 'CashoutHistoryElement';
        break;
      case 'LOOK_UPLOADED':
        historyElement.__typename = 'UploadHistoryElement';
        break;
      default:
        break;
    }
  }

  return {
    data: userHistory[0].data,
    metadata: {
      totalCount: userHistory[0].metadata[0].totalCount,
    },
  };
};

const getUserCompletedAnswers = async (root, args, context, info) => {
  await authenticationResolvers.helper.assertIsLoggedInAsAdminOrProfileId(context, args.id);

  let limit = args.limit || 10;
  let offset = args.page || 1;
  offset = (offset - 1) * limit;

  let answers = await dbClient
    .db(dbName)
    .collection('feedback_answers')
    .aggregate([
      {
        $lookup: {
          from: 'customer_questions',
          localField: 'answers.questionId',
          foreignField: '_id',
          as: 'questions',
        },
      },
      {
        $lookup: {
          from: 'uploads',
          localField: 'memberUploadId',
          foreignField: '_id',
          as: 'uploads',
        },
      },
      {
        $addFields: {
          answers: {
            $map: {
              input: '$answers',
              as: 'answerElement',
              in: {
                $mergeObjects: [
                  '$$answerElement',
                  {
                    question: {
                      $arrayElemAt: [
                        '$questions',
                        {
                          $indexOfArray: ['$questions._id', '$$answerElement.questionId'],
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
      { $project: { questions: 0 } },
      {
        $addFields: {
          feedbackOfferAnswers: '$answers',
          productURL: { $arrayElemAt: ['$uploads.productUrl', 0] },
        },
      },
      { $match: { userId: new ObjectId(args.id) } },
      { $sort: { createdAt: -1 } },
      { $skip: offset },
      { $limit: limit },
    ])
    .toArray();

  console.log(answers);
  return answers;
};

const getUserAnswer = async (root, args, context, info) => {
  let answers = await dbClient
    .db(dbName)
    .collection('feedback_answers')
    .aggregate([
      {
        $lookup: {
          from: 'customer_questions',
          localField: 'answers.questionId',
          foreignField: '_id',
          as: 'questions',
        },
      },
      {
        $lookup: {
          from: 'uploads',
          localField: 'memberUploadId',
          foreignField: '_id',
          as: 'uploads',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'users',
        },
      },
      {
        $addFields: {
          answers: {
            $map: {
              input: '$answers',
              as: 'answerElement',
              in: {
                $mergeObjects: [
                  '$$answerElement',
                  {
                    question: {
                      $arrayElemAt: [
                        '$questions',
                        {
                          $indexOfArray: ['$questions._id', '$$answerElement.questionId'],
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
      { $project: { questions: 0 } },
      {
        $addFields: {
          feedbackOfferAnswers: '$answers',
          productURL: { $arrayElemAt: ['$uploads.productUrl', 0] },
          member: { $arrayElemAt: ['$users', 0] },
        },
      },
      { $match: { _id: new ObjectId(args.id) } },
      { $sort: { createdAt: -1 } },
    ])
    .toArray();

  console.log(answers[0]);
  return answers[0];
};

/* MUTATIONS */
const updateUser = async (parent, args) => {
  let userInput = JSON.parse(JSON.stringify(args.user));

  try {
    await dbClient
      .db(dbName)
      .collection('users')
      .updateOne(
        { _id: new ObjectId(args.id) },
        {
          $set: userInput,
          $currentDate: { updatedAt: true },
        }
      );
  } catch (e) {
    console.log(e);
  }

  return { _id: new ObjectId(args.id) };
};

const lookbookit = async (parent, args) => {
  try {
    let lookbook = {
      userId: new ObjectId(args.data.userId),
      brandIds: args.data.brandIds ? args.data.brandIds.map((id) => new ObjectId(id)) : [],
      categoryIds: args.data.categoryIds ? args.data.categoryIds.map((id) => new ObjectId(id)) : [],
      productIds: args.data.productIds ? args.data.productIds.map((id) => new ObjectId(id)) : [],
      uploadIds: args.data.uploadIds ? args.data.uploadIds.map((id) => new ObjectId(id)) : [],
      photoURL: args.data.photoURL,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    lookbook = await dbClient.db(dbName).collection('users_lookbook').insertOne(lookbook);

    return lookbook.insertedId.toString();
  } catch (e) {
    return e;
  }
};

const unlookbookit = async (parent, args) => {
  try {
    const response = await dbClient
      .db(dbName)
      .collection('users_lookbook')
      .deleteOne({ _id: new ObjectId(args.id) });
    return args.id;
  } catch (e) {
    return e;
  }
};

const confirmUser = async (root, args, context) => {
  let user;
  try {
    const reqUserId = jwt.verify(args.token, process.env.JWT_SECRET);

    const usersRef = dbClient.db(dbName).collection('users');
    user = await usersRef.findOne({ stitchId: reqUserId?.id });

    await dbClient
      .db(dbName)
      .collection('users')
      .updateOne(
        { stitchId: reqUserId?.id },
        {
          $set: { status: 'confirmed' },
          $currentDate: { updatedAt: true },
        }
      );
  } catch (e) {
    return e;
  }

  authenticationResolvers.helper.sendWelcomeEmail(user.email);

  return true;
};

const deleteProfile = async (parent, args) => {
  try {
    await dbClient
      .db(dbName)
      .collection('users')
      .updateOne(
        { _id: new ObjectId(args.id) },
        {
          $set: { status: 'deleted' },
          $currentDate: { updatedAt: true },
        }
      );
  } catch (e) {
    return e;
  }

  return true;
};

const sendVerificationEmail = async (parent, args) => {
  const usersRef = dbClient.db(dbName).collection('users');
  const user = await usersRef.findOne({ email: args.email });

  authenticationResolvers.helper.sendConfirmationEmail(user.stitchId, args.email);
};

const sendPhoneNumberNotificationEmail = async (parent, args) => {
  try {
    let user = await dbClient
      .db(dbName)
      .collection('users')
      .findOne({ _id: new ObjectId(args.id) });

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const msg = {
      to: user.email,
      from: {
        name: 'The Lookbook Team',
        email: 'fred@teammysquad.com',
      },
      templateId: 'd-771f94f5f263425eb20ed3550bef2908',
      dynamic_template_data: {
        add_phone_number_link: process.env.FRONTEND_URL + `member/profile`,
      },
    };

    console.log(msg);

    await sgMail.send(msg);
  } catch (e) {
    console.log(e);
    return e;
  }

  return true;
};

const follow = async (parent, args, context) => {
  await authenticationResolvers.helper.assertIsLoggedInAsAdminOrProfileId(context, args.from);

  try {
    const follower = {
      followerId: new ObjectId(args.from),
      followingId: new ObjectId(args.to),
    };

    await dbClient
      .db(dbName)
      .collection('followers')
      .updateOne(follower, { $setOnInsert: follower }, { upsert: true });

    return dbClient
      .db(dbName)
      .collection('users')
      .findOne({ _id: new ObjectId(args.to) });
  } catch (e) {
    return e;
  }
};

const unfollow = async (parent, args, context) => {
  await authenticationResolvers.helper.assertIsLoggedInAsAdminOrProfileId(context, args.remove);

  try {
    await dbClient
      .db(dbName)
      .collection('followers')
      .deleteOne({
        followerId: new ObjectId(args.remove),
        followingId: new ObjectId(args.from),
      });

    return dbClient
      .db(dbName)
      .collection('users')
      .findOne({ _id: new ObjectId(args.from) });
  } catch (e) {
    return e;
  }
};

const validateFeedbackAnswer = async (feedbackAnswer) => {
  const offer = await dbClient
    .db(dbName)
    .collection('feedback_offers')
    .findOne({ _id: new ObjectId(feedbackAnswer.feedbackId) });

  if (!offer || !offer.active) throw new Error('Feedback offer is not active');

  const dbQuestions = await dbClient.db(dbName).collection('feedback_questions').find({}).toArray();

  const transformedDbQuestions = dbQuestions.reduce(
    (acc, question) => ({
      ...acc,
      [question._id]: question.answers,
    }),
    {}
  );

  feedbackAnswer.answers.forEach((answer) => {
    if (!Object.keys(transformedDbQuestions).includes(answer.questionId))
      throw new Error('Questions are not valid');
    if (!transformedDbQuestions[answer.questionId].includes(answer.answer)) {
      throw new Error('Answers are not valid');
    }
  });
};

const answerFeedback = async (parent, args) => {
  try {
    await validateFeedbackAnswer(args.data);

    await dbClient
      .db(dbName)
      .collection('feedback_offers')
      .updateOne({ _id: new ObjectId(args.data.feedbackId) }, { $set: { active: false } });

    let answerFeedback = {
      feedbackId: new ObjectId(args.data.feedbackId),
      userId: new ObjectId(args.data.userId),
      answers: args.data.answers.map((answer) => ({
        ...answer,
        questionId: new ObjectId(answer.questionId),
      })),
      createdAt: new Date(),
    };

    answerFeedback = await dbClient
      .db(dbName)
      .collection('feedback_answers')
      .insertOne(answerFeedback);

    //Add Notification
    // let feedback = await dbClient
    //   .db(dbName)
    //   .collection('customer_feedback')
    //   .findOne({ _id: new ObjectId(args.data.feedbackId) });
    // await notificationResolvers.helper.createAnswerFeedbackEarnedNotificationToMember(
    //   feedback.customerId,
    //   args.data.userId,
    //   args.data.amount,
    //   answerFeedback.insertedId.toString()
    // );

    const feedbackAnswerInfo = await dbClient
      .db(dbName)
      .collection('feedback_offers')
      .findOne({ _id: new ObjectId(args.data.feedbackId) });

    const currentUserInfo = await dbClient
      .db(dbName)
      .collection('users')
      .findOne({ _id: new ObjectId(args.data.userId) });

    await dbClient
      .db(dbName)
      .collection('users')
      .updateOne(
        { _id: new ObjectId(args.data.userId) },
        {
          $set: {
            currentBalance:
              Number(currentUserInfo.currentBalance) + Number(feedbackAnswerInfo.earnings),
          },
        }
      );

    return answerFeedback.insertedId.toString();
  } catch (e) {
    return e;
  }
};

const reportLook = async (parent, args, context) => {
  try {
    await authenticationResolvers.helper.assertIsLoggedIn(context);

    let reportData = {
      userId: new ObjectId(args.data.userId),
      lookId: new ObjectId(args.data.lookId),
      description: args.data.description,
      type: args.data.type,
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const report = await dbClient.db(dbName).collection('looks_report').insertOne(reportData);

    return report.insertedId.toString();
  } catch (e) {
    return e;
  }
};

const deleteReport = async (parent, args, context) => {
  try {
    await authenticationResolvers.helper.assertIsLoggedIn(context);

    await dbClient
      .db(dbName)
      .collection('looks_report')
      .updateOne({ _id: new ObjectId(args.id) }, { $set: { deleted: true } });

    return true;
  } catch (e) {
    return e;
  }
};

module.exports = {
  queries: {
    users,
    user,
    userBy,
    me,
    getMyFeedbackOffers,
    getSpotlightMembers,
    getUserFeedbacks,
    getUserHistory,
    getUserCompletedAnswers,
    getUserAnswer,
    getLookbook,
    getLookbookByUserId,
    getFollowers,
    getFollowings,
    isFollowing,
    getUserTotalLooks,
    getUserLastUpdatedDate,
    getReportedLooks,
  },
  mutations: {
    updateUser,
    lookbookit,
    unlookbookit,
    confirmUser,
    deleteProfile,
    sendVerificationEmail,
    sendPhoneNumberNotificationEmail,
    follow,
    unfollow,
    answerFeedback,
    reportLook,
    deleteReport,
  },
};
