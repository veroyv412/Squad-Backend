const { gql } = require('apollo-server');

const analyticsResolvers = require('../resolvers/analytics')

const typeDefs = gql`
    extend type Query {
      getTotalLooks: Int
      getFilterLooksByBrandCategoryProduct(brandId:ID, categoryId:ID, productId: ID, userId: ID): analyticCountType
      getLooksCountByDay(date: Date): analyticCountType
      getLooksCountByWeekRange(dateFrom: Date, dateTo: Date): analyticCountType
      getLooksCountByYearRange(dateFrom: Date, dateTo: Date): analyticCountType
      getLooksCountByMonth(date: Date): analyticCountType
      
      getTotalSignups: Int
      getFilterMemberByGenderAgeLocation(gender:String, location: String, ageFrom: String, ageTo:String): analyticCountTypeList
      getSignupsCountByDay(date: Date): analyticCountType
      getSignupsCountByWeekRange(dateFrom: Date, dateTo: Date): analyticCountType
      getSignupsCountByYearRange(dateFrom: Date, dateTo: Date): analyticCountType
      getSignupsCountByMonth(date: Date): analyticCountType
    }

    type analyticCountData {
      name: String
      count: Int
    }
    
    type analyticCountType {
      totalCount: Int
      data: [analyticCountData]
    }
    
    type analyticCountTypeList {
      totalCount: Int
      data: [analyticCountData]
      list: [User]
    }
`

const resolvers = {
    Query: {
        ...analyticsResolvers.queries
    },

    Mutation: {
        ...analyticsResolvers.mutations
    }
}

module.exports = {
    typeDefs, resolvers
}