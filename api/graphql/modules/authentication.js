const { gql } = require('apollo-server');

const authenticationResolvers = require('../resolvers/authentication')

const typeDefs = gql`
    extend type Query {
        getTokenByEmailAndPassword(email:String, password: String): AccessTokenObject! 
    }
    
    type AccessTokenObject {
        access_token: String
        error: String
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