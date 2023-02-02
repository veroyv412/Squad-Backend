const { gql } = require('apollo-server');

const lookbookCollectionResolvers = require('../resolvers/lookbookCollection');

const typeDefs = gql`
  extend type Query {
    getLookbookCollection(id: ID!): LookbookCollection
    getUserLookbookCollections(userId: ID!, limit: Int, page: Int): [LookbookCollection!]!
  }

  type LookbookCollection {
    _id: ID!
    ownerId: ID!
    private: Boolean!
    title: String!
    looks: [UploadPhoto]!
  }

  input LookbookCollectionCreationInput {
    id: ID
    ownerId: ID!
    private: Boolean
    title: String!
    looks: [ID]
  }

  input LookbookCollectionUpdateInput {
    id: ID!
    private: Boolean
    title: String
    looks: [ID]
  }

  extend type Mutation {
    createLookbookCollection(data: LookbookCollectionCreationInput!): ID
    updateLookbookCollection(data: LookbookCollectionUpdateInput!): ID
    deleteLookbookCollection(id: ID!): Boolean
  }
`;

const resolvers = {
  Query: {
    ...lookbookCollectionResolvers.queries,
  },

  Mutation: {
    ...lookbookCollectionResolvers.mutations,
  },
};

module.exports = {
  typeDefs,
  resolvers,
};
