const { gql } = require('apollo-server');

const authenticationResolvers = require('../resolvers/authentication')

const typeDefs = gql`
    extend type Query {
        getTokenByEmailAndPassword(email:String, password: String): AccessTokenObject! 
    }
    
    type AccessTokenObject {
        access_token: String
        refresh_token: String
        user_id: String
        error: String
    }
    
    input RegisterUserInput {
        email: String
        password: String
        displayName: String
        role: String
    }
    
   extend type Mutation {
        registerUser(user: RegisterUserInput!): AccessTokenObject!
    }
`

const resolvers = {
    Query: {
        ...authenticationResolvers.queries
    },

    Mutation: {
        ...authenticationResolvers.mutations
    }
}

module.exports = {
    typeDefs, resolvers
}