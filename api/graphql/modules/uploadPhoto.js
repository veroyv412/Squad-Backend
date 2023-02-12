const { gql } = require('apollo-server');

const uploadPhotoResolvers = require('../resolvers/uploadPhoto');

const typeDefs = gql`
  extend type Query {
    getUploadedPhotos(productIds: [String], limit: Int, page: Int): UploadedPhotos!
    getUpload(id: String): UploadPhoto!
    getUserUploads(userId: String, limit: Int, page: Int): UploadedPhotos!
    getBrandUploads(brandId: String, userId: String): BrandUpload
    uploadsSearch(
      searchParam: String
      brandIds: String
      uploadIds: String
      categoryIds: String
      productIds: String
      limit: Int
      page: Int
    ): [SearchUploadPhoto]
    uploadsFilter(filter: FilterInput): [SearchUploadPhoto]
    getPendingUploads: [UploadPhoto]
    getFlaggedUploads: [UploadPhoto]
    getApprovedNotCredited: [UploadPhoto]
    getApprovedNotCreditedUploadedProducts: [UploadPhoto]
  }

  input FilterInput {
    gender: String
    location: String
    ageFrom: String
    ageTo: String
    education: String
    categoryNames: [String]
    brandNames: [String]
    productNames: [String]
  }

  type UploadPhotoLike {
    id: ID!
    member: User
    like: Boolean
  }

  type UploadPhoto {
    _id: ID!
    memberId: ID!
    brand: Brand!
    category: Category!
    brandId: ID!
    description: String
    categoryId: ID!
    productId: ID!
    product: Product!
    productName: String
    productUrl: String!
    likes: Int
    flagged: Boolean
    member: User!
    userLikes: [ID]
    brandName: String!
    categoryName: String!
    tags: [String]
    earnedAmount: Float
    earning: MemberEarnings
    homepage: Boolean
    hidden: Boolean
    createdAt: String!
    approved: Boolean
  }

  type UploadedPhotos {
    data: [UploadPhoto!]!
    metadata: Metadata!
  }

  input UploadPhotoInput {
    _id: ID
    brand: BrandInput
    category: CategoryInput
    product: ProductInput
    productName: String
    productUrl: String
    member: UserInput
    tags: [String]
    userId: ID
    flagged: Boolean
    approved: Boolean
    uuid: String
  }

  type SearchUser {
    _id: String
    pictureUrl: String
    role: String
    email: String
    displayName: String
    hasUploads: Boolean
  }

  type SearchBrand {
    _id: ID
    name: String
    verified: Boolean
  }

  type SearchUploadPhoto {
    _id: ID
    brand: SearchBrand
    category: SearchBrand
    productName: String
    brandName: String
    categoryName: String
    productUrl: String
    userLikes: [String]
    member: SearchUser
    homepage: Boolean
    approved: Boolean
  }

  type BrandUpload {
    brand: Brand
    isSubscribed: Boolean
    uploads: [UploadPhoto]
  }

  type ValidateError {
    brand: String
    category: String
    product: String
    errorCount: Int
  }

  type UploadedPhotoResponse {
    isApproved: Boolean
    id: String
  }

  extend type Mutation {
    addUploadedPhoto(uploadPhoto: UploadPhotoInput!): UploadedPhotoResponse
    updateUploadedPhoto(uploadPhoto: UploadPhotoInput!): String
    verifyUploadedPhoto(uploadPhoto: UploadPhotoInput!): String
    likeUploadedPhoto(id: ID, userId: ID): Boolean
    hideUnhideUploadedPhoto(id: ID): Boolean
    validateUpload(id: ID!): ValidateError
    flagUploadedPhoto(id: ID!): String
    setHomepageUploadedPhoto(ids: [ID]): String
  }
`;

const resolvers = {
  Query: {
    ...uploadPhotoResolvers.queries,
  },

  Mutation: {
    ...uploadPhotoResolvers.mutations,
  },
};

module.exports = {
  typeDefs,
  resolvers,
};
