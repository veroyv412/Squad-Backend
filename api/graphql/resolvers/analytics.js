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


module.exports = {
    queries: {
        getTotalLooks,
        getFilterLooksByBrandCategoryProduct,
        getLooksCountByDay,
        getLooksCountByWeekRange,
        getLooksCountByYearRange,
        getLooksCountByMonth
    },

}