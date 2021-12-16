const {dbClient, dbName} = require('../../config/mongo');
const ObjectId = require('mongodb').ObjectId;
const moment = require('moment'); // require
const crypto = require('crypto');
const _ = require('lodash');

const getTotalLooks = async (root, args, context, info) => {
    const uploads = await dbClient.db(dbName).collection("uploads").find().count();
    return uploads;
}

const getFilterLooksByBrandCategoryProduct = async (root, args, context, info) => {
    let { brandId, categoryId, productId } = args;

    let $matchBrand = { $match: {}}
    let $matchCategory = { $match: {}}
    let $matchProduct = { $match: {}}

    let result = {}
    let TotalUploads = await dbClient.db(dbName).collection("uploads").find().count();
    result.totalCount = TotalUploads
    result.data = []

    if ( brandId && brandId != '-' ){
        const brandUploads = await dbClient.db(dbName).collection("uploads").aggregate([
            {
                $lookup:{
                    from: "brands",
                    localField : "brandId",
                    foreignField : "_id",
                    as : "brand",
                }
            },
            {
                $addFields: {
                    "brandName": { "$arrayElemAt": [ "$brand.name", 0 ] },
                }
            },
            { $match: { brandId: { $eq: new ObjectId(brandId) } } },
            { $group: { _id: "$brandName", brandCount: { $sum : 1 } }},
            { $project: { brandCount: 1, brandName : 1 }}
        ]).toArray();

        if ( brandUploads.length > 0 ){
            result.data.push( { name: brandUploads[0]._id, count: brandUploads[0].brandCount})
        } else {
            result.data.push( { name: 'No Brand', count: 0})
        }
    }

    if ( categoryId && categoryId != '-' ){
        const categoryUploads = await dbClient.db(dbName).collection("uploads").aggregate([
            {
                $lookup:{
                    from: "categories",
                    localField : "categoryId",
                    foreignField : "_id",
                    as : "category",
                }
            },
            {
                $addFields: {
                    "categoryName": { "$arrayElemAt": [ "$category.name", 0 ] },
                }
            },
            { $match: { categoryId: { $eq: new ObjectId(categoryId) } } },
            { $group: { _id: "$categoryName", categoryCount: { $sum : 1 } }},
            { $project: { categoryCount: 1, categoryName : 1 }}
        ]).toArray();
        if ( categoryUploads.length > 0 ){
            result.data.push( { name: categoryUploads[0]._id, count: categoryUploads[0].categoryCount})
        } else {
            result.data.push( { name: 'No Category', count: 0})
        }
    }

    if ( productId && productId != '-' ){
        const productUploads = await dbClient.db(dbName).collection("uploads").aggregate([
            {
                $lookup:{
                    from: "products",
                    localField : "productId",
                    foreignField : "_id",
                    as : "product",
                }
            },
            {
                $addFields: {
                    "productName": { "$arrayElemAt": [ "$product.productName", 0 ] },
                }
            },
            { $match: { productId: { $eq: new ObjectId(productId) } } },
            { $group: { _id: "$productName", productCount: { $sum : 1 } }},
            { $project: { productCount: 1, productName : 1 }}
        ]).toArray();
        if ( productUploads.length > 0 ){
            result.data.push( { name: productUploads[0]._id, count: productUploads[0].productCount})
        } else {
            result.data.push( { name: 'No Product', count: 0})
        }
    }

    console.log('getFilterLooksByBrandCategoryProduct', result)

    return result;
}


const getLooksCountByDay = async (root, args, context, info) => {
    var dayOfMonth = +moment(args.date, "YYYY-MM-DD").format('DD');
    var month = +moment(args.date, "YYYY-MM-DD").format('MM');
    var year = +moment(args.date, "YYYY-MM-DD").format('YYYY');

    let uploads = await dbClient.db(dbName).collection("uploads").aggregate([
        {
            $project:
                {
                    _id: "$_id",
                    productName: "$productName",
                    createdAt: "$createdAt",
                    year: { $year: "$createdAt" },
                    month: { $month: "$createdAt" },
                    day: { $dayOfMonth: "$createdAt" }
                }
        },
        { $match : { day : dayOfMonth, month: month, year: year } },
    ]).toArray()

    console.log('getLooksCountByDay', uploads.length)

    return {
        totalCount: uploads.length,
        data: [
            {
                name: args.date,
                count: uploads.length
            }
        ]
    }
}

const getLooksCountByWeekRange = async (root, args, context, info) => {

    let uploads = await dbClient.db(dbName).collection("uploads").aggregate([
        {
            $project:
                {
                    _id: "$_id",
                    productName: "$productName",
                    createdAt: "$createdAt",
                    year: { $year: "$createdAt" },
                    month: { $dateToString: { format: "%m", date: "$createdAt" } },
                    day: { $dayOfMonth: "$createdAt" },
                    name: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }
                }
        },
        { $match : { createdAt: { $gte: new Date(args.dateFrom), $lte: new Date(args.dateTo) }}},
        { $group: {  _id : { name : "$name" }, count: { $sum : 1 }  }},
        { $sort : { "_id.name": 1 } },
    ]).toArray()

    console.log('getLooksCountByWeekRange', uploads)

    const result = {
        totalCount: uploads.reduce(function(count, u){
            return count + u.count;
        }, 0),
        data: uploads.map(u => {
            return { name: u._id.name, count: u.count }
        })
    }

    return result
}

const getLooksCountByYearRange = async (root, args, context, info) => {

    let uploads = await dbClient.db(dbName).collection("uploads").aggregate([
        {
            $project:
                {
                    _id: "$_id",
                    productName: "$productName",
                    createdAt: "$createdAt",
                    year: { $year: "$createdAt" },
                }
        },
        { $match : { createdAt: { $gte: new Date(args.dateFrom), $lte: new Date(args.dateTo) }}},
        { $group: {  _id : { year : "$year" }, count: { $sum : 1 }  }},
        { $sort : { "_id.year": 1 } },
    ]).toArray()

    console.log('getLooksCountByYearRange', uploads)

    const result = {
        totalCount: uploads.reduce(function(count, u){
            return count + u.count;
        }, 0),
        data: uploads.map(u => {
            return { name: u._id.year, count: u.count }
        })
    }

    return result
}

const getLooksCountByMonth = async (root, args, context, info) => {
    let year = +moment(args.date, "YYYY-MM-DD").format('YYYY');

    let uploads = await dbClient.db(dbName).collection("uploads").aggregate([
        {
            $project:
                {
                    _id: "$_id",
                    productName: "$productName",
                    createdAt: "$createdAt",
                    month: { $dateToString: { format: "%m", date: "$createdAt" } },
                    year: { $year: "$createdAt" },
                }
        },
        { $match : { year: { $eq: year }}},
        { $group: {  _id : { month : "$month" }, count: { $sum : 1 }  }},
        { $sort : { "_id.month": 1 } },
    ]).toArray()

    console.log('getLooksCountByMonth', uploads)

    const result = {
        totalCount: uploads.reduce(function(count, u){
            return count + u.count;
        }, 0),
        data: uploads.map(u => {
            return { name: u._id.month, count: u.count }
        })
    }

    return result
}


const getTotalSignups = async (root, args, context, info) => {
    const users = await dbClient.db(dbName).collection("users").find({role: "member"}).count();
    return users;
}

const getFilterMemberByGenderAgeLocation = async (root, args, context, info) => {
    const { gender = null, location = null, ageFrom = null, ageTo = null } = args;

    let result = {}
    let TotalUsers = await dbClient.db(dbName).collection("users").find({role:"member"}).count();
    result.totalCount = TotalUsers
    result.data = []
    result.list = []

    if ( gender ){
        const usersGender = await dbClient.db(dbName).collection("users").aggregate([
            { $match: { gender: gender, role: "member" } },
            { $group: { _id: "$gender", genderCount: { $sum : 1 } }},
            { $project: { genderCount: 1, gender : 1 }}
        ]).toArray();

        const usersGenderList = await dbClient.db(dbName).collection("users").aggregate([
            { $match: { gender: gender, role: "member" } },
        ]).toArray();

        if ( usersGender.length > 0 ){
            result.data.push( { name: usersGender[0]._id, count: usersGender[0].genderCount})
            result.list = usersGenderList
        } else {
            result.data.push( { name: 'No Gender', count: 0})
        }
    }

    if ( location ){
        const usersLocation = await dbClient.db(dbName).collection("users").aggregate([
            { $match: { "locationCity": new RegExp(location), role: "member" } },
            { $group: { _id: "$locationCity", locationCount: { $sum : 1 } }},
            { $project: { locationCount: 1, hometownCity : 1 }}
        ]).toArray();

        const usersLocationList = await dbClient.db(dbName).collection("users").aggregate([
            { $match: { "locationCity": new RegExp(location), role: "member" } },
        ]).toArray();

        if ( usersLocation.length > 0 ){
            result.data.push( { name: usersLocation[0]._id, count: usersLocation[0].locationCount})
            result.list = usersLocationList
        } else {
            result.data.push( { name: 'No Location', count: 0})
        }
    }

    if ( ageFrom && ageTo){
        const usersAgeCount = await dbClient.db(dbName).collection("users").find({ age: { $gte: ageFrom, $lte: ageTo }, role: "member" }).count();
        const usersAgeCountList = await dbClient.db(dbName).collection("users").find({ age: { $gte: ageFrom, $lte: ageTo }, role: "member" }).toArray();
        if ( usersAgeCount > 0 ){
            result.data.push( { name: ageFrom + ' to ' + ageTo, count: usersAgeCount})
            result.list = usersAgeCountList
        } else {
            result.data.push( { name: 'No Age', count: 0})
        }
    }

    return result
}

const getSignupsCountByDay = async (root, args, context, info) => {
    const dayOfMonth = +moment(args.date, "YYYY-MM-DD").format('DD');
    const month = +moment(args.date, "YYYY-MM-DD").format('MM');
    const year = +moment(args.date, "YYYY-MM-DD").format('YYYY');

    let users = await dbClient.db(dbName).collection("users").aggregate([
        {
            $project:
                {
                    _id: "$_id",
                    createdAt: "$createdAt",
                    year: { $year: "$createdAt" },
                    month: { $month: "$createdAt" },
                    day: { $dayOfMonth: "$createdAt" },
                    role: "$role"
                }
        },
        { $match : { day : dayOfMonth, month: month, year: year, role: "member" } },
    ]).toArray()

    console.log('getSignupsCountByDay', users.length)

    return {
        totalCount: users.length,
        data: [
            {
                name: args.date,
                count: users.length
            }
        ]
    }
}

const getSignupsCountByWeekRange = async (root, args, context, info) => {

    let users = await dbClient.db(dbName).collection("users").aggregate([
        {
            $project:
                {
                    _id: "$_id",
                    createdAt: "$createdAt",
                    year: { $year: "$createdAt" },
                    month: { $dateToString: { format: "%m", date: "$createdAt" } },
                    day: { $dayOfMonth: "$createdAt" },
                    name: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                    role: "$role"
                }
        },
        { $match : { role: "member", createdAt: { $gte: new Date(args.dateFrom), $lte: new Date(args.dateTo) }}},
        { $group: {  _id : { name : "$name" }, count: { $sum : 1 }  }},
        { $sort : { "_id.name": 1 } },
    ]).toArray()

    console.log('getSignupsCountByWeekRange', users)

    const result = {
        totalCount: users.reduce(function(count, u){
            return count + u.count;
        }, 0),
        data: users.map(u => {
            return { name: u._id.name, count: u.count }
        })
    }

    return result
}

const getSignupsCountByYearRange = async (root, args, context, info) => {

    let users = await dbClient.db(dbName).collection("users").aggregate([
        {
            $project:
                {
                    _id: "$_id",
                    createdAt: "$createdAt",
                    year: { $year: "$createdAt" },
                    role: "$role"
                }
        },
        { $match : { role: "member", createdAt: { $gte: new Date(args.dateFrom), $lte: new Date(args.dateTo) }}},
        { $group: {  _id : { year : "$year" }, count: { $sum : 1 }  }},
        { $sort : { "_id.year": 1 } },
    ]).toArray()

    console.log('getSignupsCountByYearRange', users)

    const result = {
        totalCount: users.reduce(function(count, u){
            return count + u.count;
        }, 0),
        data: users.map(u => {
            return { name: u._id.year, count: u.count }
        })
    }

    return result
}

const getSignupsCountByMonth = async (root, args, context, info) => {
    let year = +moment(args.date, "YYYY-MM-DD").format('YYYY');

    let users = await dbClient.db(dbName).collection("users").aggregate([
        {
            $project:
                {
                    _id: "$_id",
                    createdAt: "$createdAt",
                    month: { $dateToString: { format: "%m", date: "$createdAt" } },
                    year: { $year: "$createdAt" },
                    role: "$role"
                }
        },
        { $match : { role: "member", year: { $eq: year }}},
        { $group: {  _id : { month : "$month" }, count: { $sum : 1 }  }},
        { $sort : { "_id.month": 1 } },
    ]).toArray()

    console.log('getSignupsCountByMonth', users)

    const result = {
        totalCount: users.reduce(function(count, u){
            return count + u.count;
        }, 0),
        data: users.map(u => {
            return { name: u._id.month, count: u.count }
        })
    }

    return result
}

module.exports = {
    queries: {
        getTotalLooks,
        getFilterLooksByBrandCategoryProduct,
        getLooksCountByDay,
        getLooksCountByWeekRange,
        getLooksCountByYearRange,
        getLooksCountByMonth,

        getTotalSignups,
        getFilterMemberByGenderAgeLocation,
        getSignupsCountByDay,
        getSignupsCountByWeekRange,
        getSignupsCountByYearRange,
        getSignupsCountByMonth,
    },

}