const { gql } = require('apollo-server');

const typeDefs = gql`
  type Metadata {
    totalCount: Int!
  }
`;

module.exports = {
  typeDefs,
};
