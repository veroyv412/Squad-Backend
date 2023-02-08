const { gql } = require('apollo-server');

const userResolvers = require('../resolvers/user');

const typeDefs = gql`
  extend type Query {
    user(id: ID!): User
    userBy(data: String!): User
    me: User!
    users: [User]
    getSpotlightMembers(brandId: ID): [UploadPhoto]
    getUserByFirebaseId(firebaseId: ID!): User
    getLookbookByUserId(userId: ID!, limit: Int, page: Int): [Lookbook!]!
    getLookbook(id: ID!): Lookbook
    getFollowers(id: ID, limit: Int, page: Int): UsersData!
    getFollowings(id: ID, limit: Int, page: Int): UsersData!
    isFollowing(userId1: ID, userId2: ID): Boolean!
    getUserFeedbacks(id: ID, limit: Int, page: Int): [CustomerFeedback!]!
    getMyFeedbackOffers(limit: Int, page: Int): [Offer!]!
    getUserCompletedAnswers(id: ID, limit: Int, page: Int): [FeedbackAnswer]
    getUserAnswer(id: ID): FeedbackAnswer
    getUserTotalLooks(id: ID): Int
    getUserLastUpdatedDate(id: ID): String
  }

  scalar Date

  type User {
    _id: ID!
    displayName: String!
    username: String
    email: String
    hasUploads: Boolean
    pictureUrl: String
    currentBalance: Float
    dob: Date
    gender: String
    locationCity: String
    locationState: String
    age: String
    paymentMethod: String
    paymentUsername: String
    status: String
    flagged: Boolean
    phoneNumber: String
    createdAt: Date
    lastActiveAt: Date
  }

  type UsersData {
    data: [User!]!
    metadata: Metadata!
  }

  type Lookbook {
    _id: ID!
    userId: ID!
    brandIds: [String]!
    categoryIds: [String]!
    productIds: [String]!
    uploadIds: [String]!
    photoURL: String!
    brands: [String]!
    categories: [String]
    products: [String]
    uploads: [UploadPhoto]
  }

  type Offer {
    _id: ID!
    userId: ID!
    look: UploadPhoto!
    questions: [OfferQuestion!]!
    earnings: Float!
    active: Boolean!
    createdAt: Date!
    updatedAt: Date!
  }

  type OfferQuestion {
    _id: ID
    text: String
    answers: [String]
  }

  type FeedbackAnswers {
    questionId: ID
    answer: String
    question: CustomerQuestion
  }

  type FeedbackAnswer {
    _id: ID
    customerFeedbackId: ID
    userId: ID
    member: User
    answers: [FeedbackAnswers]
    feedbackOfferAnswers: [FeedbackAnswers]
    amount: Float
    productURL: String
  }

  input UserInput {
    _id: String
    firstName: String
    lastName: String
    displayName: String
    username: String
    name: String
    email: String
    pictureUrl: String
    dob: String
    gender: String
    locationCity: String
    locationState: String
    hometownCity: String
    hometownState: String
    ethnicity: String
    orientation: String
    education: String
    height: String
    facebook: String
    instagram: String
    snapchat: String
    twitter: String
    linkedin: String
    work: String
    age: String
    role: String
    paymentMethod: String
    paymentUsername: String
    status: String
    phoneNumber: String
  }

  input LookbookInput {
    userId: ID!
    brandIds: [String]
    categoryIds: [String]
    productIds: [String]
    uploadIds: [String]
    photoURL: String
  }

  input AnswerFeedbackQuestionsInput {
    questionId: ID!
    answer: String
  }

  input AnswerFeedbackInput {
    feedbackId: ID!
    userId: ID!
    answers: [AnswerFeedbackQuestionsInput!]!
  }

  extend type Mutation {
    updateUser(id: ID, user: UserInput): User!
    lookbookit(data: LookbookInput): String
    unlookbookit(id: ID): String
    sendConfirmationEmail(id: ID): Boolean
    sendAfterConfirmationEmail(id: ID): Boolean
    sendPhoneNumberNotificationEmail(id: ID): Boolean
    updateUserStatus(id: ID): Boolean
    deleteProfile(id: ID): Boolean
    follow(from: ID!, to: ID!): User!
    unfollow(remove: ID!, from: ID!): User!
    answerFeedback(data: AnswerFeedbackInput): String
  }
`;

const resolvers = {
  Query: {
    ...userResolvers.queries,
  },

  Mutation: {
    ...userResolvers.mutations,
  },
};

module.exports = {
  typeDefs,
  resolvers,
};
