const { gql } = require('apollo-server');

const lookbookCollectionResolvers = require('../resolvers/lookbookCollection');

const typeDefs = gql`
  extend type Query {
    getLookbookCollection(id: ID!): LookbookCollection
    getUserLookbookCollections(userId: ID!): UserLookbookCollections!
  }

  type LookbookCollection {
    _id: ID!
    owner: User!
    private: Boolean!
    title: String!
    looks: [UploadPhoto]!
  }

  type LookbookCollectionShape {
    _id: ID!
    ownerId: ID!
    private: Boolean!
    title: String!
    looks: [ID!]!
  }

  type UserLookbookCollections {
    data: [LookbookCollection!]!
    metadata: Metadata!
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
    updateLookbookCollection(data: LookbookCollectionUpdateInput!): LookbookCollection!
    deleteLookbookCollection(id: ID!): LookbookCollectionShape!
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
