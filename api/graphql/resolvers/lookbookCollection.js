const { dbClient, dbName } = require('../../config/mongo');
const ObjectId = require('mongodb').ObjectId;

const authenticationResolvers = require('../resolvers/authentication');

const jwt = require('jsonwebtoken');
const { ForbiddenError } = require('apollo-server-express');

const getUserLookbookCollections = async (_, args, context) => {
  await authenticationResolvers.helper.assertIsLoggedIn(context);

  let limit = args.limit || 10;
  let offset = args.page || 1;
  offset = (offset - 1) * limit;

  const reqUserId = jwt.decode(context.req.cookies.access_token)?.sub;
  const reqDbUser = await dbClient.db(dbName).collection('users').findOne({ stitchId: reqUserId });

  let match = {};
  if (args.userId != reqDbUser._id.toString()) {
    match = { $and: [{ ownerId: new ObjectId(args.userId) }, { private: false }] };
  } else {
    match = { ownerId: new ObjectId(args.userId) };
  }

  const collections = await dbClient
    .db(dbName)
    .collection('lookbook_collections')
    .aggregate([
      { $match: match },
      {
        $facet: {
          metadata: [{ $count: 'totalCount' }],
          data: [
            {
              $lookup: {
                from: 'uploads',
                localField: 'looks',
                foreignField: '_id',
                as: 'looks',
              },
            },

            { $skip: offset },
            { $limit: limit },
          ],
        },
      },
    ])
    .toArray();

  return {
    data: collections[0].data,
    metadata: {
      totalCount: collections[0].metadata[0].totalCount,
    },
  };
};

const getLookbookCollection = async (_, args, context) => {
  await authenticationResolvers.helper.assertIsLoggedIn(context);

  const reqUserId = jwt.decode(context.req.cookies.access_token)?.sub;
  const reqDbUser = await dbClient.db(dbName).collection('users').findOne({ stitchId: reqUserId });

  const collections = await dbClient
    .db(dbName)
    .collection('lookbook_collections')
    .aggregate([
      { $match: { _id: new ObjectId(args.id) } },
      {
        $lookup: {
          from: 'uploads',
          localField: 'looks',
          foreignField: '_id',
          as: 'looks',
        },
      },
    ])
    .toArray();

  const collection = collections[0];

  if (collection.private && collection.ownerId.toString() !== reqDbUser._id.toString())
    throw new ForbiddenError('Cannot access this collection');

  return collection;
};

const createLookbookCollection = async (_, args, context) => {
  try {
    await authenticationResolvers.helper.assertIsLoggedInAsAdminOrProfileId(
      context,
      args.data.ownerId
    );

    const ids = args.data?.looks ? args.data.looks.map((u) => new ObjectId(u)) : [];

    const collectionData = {
      ownerId: new ObjectId(args.data.ownerId),
      private: args.data.private ?? true,
      title: args.data.title,
      looks: ids,
    };

    const lookbookCollection = await dbClient
      .db(dbName)
      .collection('lookbook_collections')
      .insertOne(collectionData);

    return lookbookCollection.insertedId;
  } catch (e) {
    return e;
  }
};

const updateLookbookCollection = async (_, args, context) => {
  try {
    const collection = await dbClient
      .db(dbName)
      .collection('lookbook_collections')
      .findOne({ _id: new ObjectId(args.data.id) });

    await authenticationResolvers.helper.assertIsLoggedInAsAdminOrProfileId(
      context,
      collection.ownerId.toString()
    );

    const ids = args.data?.looks ? args.data.looks.map((u) => new ObjectId(u)) : collection.looks;
    const collectionData = {
      ...collection,
      private: args.data.private ?? collection.private,
      title: args.data.title ?? collection.title,
      looks: ids,
    };

    await dbClient
      .db(dbName)
      .collection('lookbook_collections')
      .updateOne(
        { _id: new ObjectId(args.data.id) },
        {
          $set: collectionData,
        }
      );

    return args.data.id;
  } catch (e) {
    return e;
  }
};

const deleteLookbookCollection = async (_, args, context) => {
  try {
    const target = await dbClient
      .db(dbName)
      .collection('lookbook_collections')
      .findOne({ _id: new ObjectId(args.id) });

    await authenticationResolvers.helper.assertIsLoggedInAsAdminOrProfileId(
      context,
      target.ownerId.toString()
    );

    await dbClient.db(dbName).collection('lookbook_collections').deleteOne(target);

    return true;
  } catch (e) {
    return e;
  }
};

module.exports = {
  queries: {
    getLookbookCollection,
    getUserLookbookCollections,
  },
  mutations: {
    createLookbookCollection,
    updateLookbookCollection,
    deleteLookbookCollection,
  },
};
