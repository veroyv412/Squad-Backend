const { gql } = require('apollo-server');

const authenticationResolvers = require('../resolvers/authentication');

const typeDefs = gql`
  extend type Query {
    getTokenByEmailAndPassword(email: String, password: String): AccessTokenObject!
    getAccessTokenByRefreshToken(refresh_token: String): RefreshTokenObject
  }

  type AccessTokenObject {
    access_token: String
    refresh_token: String
    user_id: String
    error: String
  }

  type RefreshTokenObject {
    access_token: String
    success: Boolean
  }

  input RegisterUserInput {
    email: String
    password: String
    displayName: String
    username: String
  }

  extend type Mutation {
    registerUser(user: RegisterUserInput!): Boolean
  }
`;

const resolvers = {
  Query: {
    ...authenticationResolvers.queries,
  },

  Mutation: {
    ...authenticationResolvers.mutations,
  },
};

module.exports = {
  typeDefs,
  resolvers,
};
