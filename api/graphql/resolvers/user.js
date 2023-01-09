const { dbClient, dbName } = require('../../config/mongo');
const ObjectId = require('mongodb').ObjectId;
const sgMail = require('@sendgrid/mail');
const jwt = require('jsonwebtoken');
const moment = require('moment'); // require

const notificationResolvers = require('../resolvers/notification');
const authenticationResolvers = require('../resolvers/authentication');

const users = async (root, args, context, info) => {
  await authenticationResolvers.helper.assertIsLoggedIn(context);

  const usersRef = dbClient.db(dbName).collection('users');
  const users = await usersRef.find({}).toArray();

  return users;
};

const user = async (root, { id }, context, info) => {
  const usersRef = dbClient.db(dbName).collection('users');

  const user = await usersRef.findOne({ _id: new ObjectId(id) });

  return user;
};

const userBy = async (root, { data }, context, info) => {
  const usersRef = dbClient.db(dbName).collection('users');
  let or = {
    $or: [{ username: data }, { email: data }],
  };

  const user = await usersRef.findOne(or);

  return user;
};

const me = async (root, args, context, info) => {
  if (!context.req.cookies.access_token) {
    throw new Error('Unauthorized');
  }

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
  console.log(count);
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

const getFollowers = async (root, { id }, context, info) => {
  const followers = await dbClient
    .db(dbName)
    .collection('followers')
    .aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId1',
          foreignField: '_id',
          as: 'user1',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId2',
          foreignField: '_id',
          as: 'user2',
        },
      },
      { $match: { userId2: new ObjectId(id) } },
      { $sort: { createdAt: -1 } },
    ])
    .toArray();

  for (let follower of followers) {
    follower.user1 = follower.user1[0];
    follower.user2 = follower.user2[0];
  }

  return followers;
};

const getFollowings = async (root, { id }, context, info) => {
  const followers = await dbClient
    .db(dbName)
    .collection('followers')
    .aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId1',
          foreignField: '_id',
          as: 'user1',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId2',
          foreignField: '_id',
          as: 'user2',
        },
      },
      { $match: { userId1: new ObjectId(id) } },
      { $sort: { createdAt: -1 } },
    ])
    .toArray();

  for (let follower of followers) {
    follower.user1 = follower.user1[0];
    follower.user2 = follower.user2[0];
  }

  return followers;
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

const getLookbook = async (root, { id }, context, info) => {
  const lookbook = await dbClient
    .db(dbName)
    .collection('users_lookbook')
    .findOne({ _id: new ObjectId(id) });

  return lookbook;
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

const getUserCompletedAnswers = async (root, args, context, info) => {
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

const updateUserStatus = async (parent, args) => {
  try {
    await dbClient
      .db(dbName)
      .collection('users')
      .updateOne(
        { $or: [{ stitchId: args.id }, { email: args.id }] },
        {
          $set: { status: 'confirmed' },
          $currentDate: { updatedAt: true },
        }
      );
  } catch (e) {
    return e;
  }

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

const sendConfirmationEmail = async (parent, args) => {
  try {
    let user = await dbClient
      .db(dbName)
      .collection('users')
      .findOne({ $or: [{ stitchId: args.id }, { email: args.id }] });
    console.log(user);
    let token = jwt.sign({ id: args.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

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

    console.log(msg);

    await sgMail.send(msg);
  } catch (e) {
    console.log(e);
    return e;
  }

  return true;
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

const sendAfterConfirmationEmail = async (parent, args) => {
  try {
    let user = await dbClient
      .db(dbName)
      .collection('users')
      .findOne({ $or: [{ stitchId: args.id }, { email: args.id }] });
    console.log(user);

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const msg = {
      to: user.email,
      from: {
        name: 'The Lookbook Team',
        email: 'fred@teammysquad.com',
      },
      templateId: 'd-eb1d7a9768084517946234c5fa2e2583',
      dynamic_template_data: {
        name: user.displayName,
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

const follow = async (parent, args) => {
  try {
    let follower = {
      userId1: new ObjectId(args.userId1),
      userId2: new ObjectId(args.userId2),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    follower = await dbClient.db(dbName).collection('followers').insertOne(follower);

    await notificationResolvers.helper.createFollowNotificationToMember(args.userId1, args.userId2);

    return follower.insertedId.toString();
  } catch (e) {
    console.log(e);
    return e;
  }
};

const unfollow = async (parent, args) => {
  try {
    const response = await dbClient
      .db(dbName)
      .collection('followers')
      .deleteOne({
        userId1: new ObjectId(args.userId1),
        userId2: new ObjectId(args.userId2),
      });

    return args.userId1;
  } catch (e) {
    console.log(e);
    return e;
  }
};

const answerFeedback = async (parent, args) => {
  try {
    let answerFeedback = {
      customerFeedbackId: new ObjectId(args.data.feedbackId),
      userId: new ObjectId(args.data.userId),
      answers: args.data.answers.map((a) => ({ ...a, questionId: new ObjectId(a.questionId) })),
      amount: args.data.amount,
      memberUploadId: new ObjectId(args.data.memberUploadId),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const upload = await dbClient
      .db(dbName)
      .collection('uploads')
      .findOne({ _id: new ObjectId(args.data.memberUploadId) });
    let offerEarnedAmount = upload.offerEarnedAmount ? upload.offerEarnedAmount : 0;
    offerEarnedAmount = offerEarnedAmount + args.data.amount;
    await dbClient
      .db(dbName)
      .collection('uploads')
      .updateOne(
        { _id: new ObjectId(upload._id) },
        { $set: { credited: true, offerEarnedAmount: offerEarnedAmount } }
      );

    answerFeedback = await dbClient
      .db(dbName)
      .collection('feedback_answers')
      .insertOne(answerFeedback);

    //Add Notification
    let feedback = await dbClient
      .db(dbName)
      .collection('customer_feedback')
      .findOne({ _id: new ObjectId(args.data.feedbackId) });
    await notificationResolvers.helper.createAnswerFeedbackEarnedNotificationToMember(
      feedback.customerId,
      args.data.userId,
      args.data.amount,
      answerFeedback.insertedId.toString()
    );

    await dbClient
      .db(dbName)
      .collection('member_earnings')
      .insertOne({
        entityId: new ObjectId(answerFeedback.insertedId.toString()),
        type: 'offer',
        amount: args.data.amount,
        memberId: new ObjectId(args.data.userId),
        payed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    return answerFeedback.insertedId.toString();
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
    getSpotlightMembers,
    getUserFeedbacks,
    getUserCompletedAnswers,
    getUserAnswer,
    getLookbook,
    getLookbookByUserId,
    getFollowers,
    getFollowings,
    isFollowing,
    getUserTotalLooks,
    getUserLastUpdatedDate,
  },
  mutations: {
    updateUser,
    lookbookit,
    unlookbookit,
    updateUserStatus,
    deleteProfile,
    sendConfirmationEmail,
    sendAfterConfirmationEmail,
    sendPhoneNumberNotificationEmail,
    follow,
    unfollow,
    answerFeedback,
  },
};
