const {dbClient, dbName} = require('../../config/mongo');
const ObjectId = require('mongodb').ObjectId;
const moment = require('moment'); // require
const crypto = require('crypto');
const _ = require('lodash');
const { RealmApiClient } = require('../../utils/Realm')


const getTotalLooks = async (root, args, context, info) => {
    const uploads = await dbClient.db(dbName).collection("uploads").find().count();
    return uploads;
}

const getCustomerTotalLooks = async (root, args, context, info) => {
    const uploads = await dbClient.db(dbName).collection("uploads").aggregate([
        {
            $lookup:{
                from: "products",
                localField : "productId",
                foreignField : "_id",
                as : "product"
            }
        },
        { $match : { "product.customerId" : new ObjectId(args.customerId) } }
    ]).toArray();

    return uploads.length;
}

const getFilterLooksByBrandCategoryProduct = async (root, args, context, info) => {
    let { brandId, categoryId, productId, userId, customerId, ageFrom, ageTo, location } = args;

    let result = {}
    let totalUploads = await dbClient.db(dbName).collection("uploads").find().count();
    if ( userId ){
        totalUploads = await dbClient.db(dbName).collection("uploads").find({ memberId: new ObjectId(userId) }).count();
    }

    if ( customerId ){
        const uploads = await dbClient.db(dbName).collection("uploads").aggregate([
            {
                $lookup:{
                    from: "products",
                    localField : "productId",
                    foreignField : "_id",
                    as : "product"
                }
            },
            { $match : { "product.customerId" : new ObjectId(args.customerId) } }
        ]).toArray();
        totalUploads = uploads.length;
    }

    result.totalCount = totalUploads
    result.data = []

    if ( brandId && brandId != '-' ){
        let match = { brandId: { $eq: new ObjectId(brandId) } } ;
        if ( userId ){
            match['memberId'] = { $eq: new ObjectId(userId) }
        }

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
            { $match: match },
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
        let match = { categoryId: { $eq: new ObjectId(categoryId) } } ;
        if ( userId ){
            match['memberId'] = { $eq: new ObjectId(userId) }
        }

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
            { $match: match },
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
        let match = { productId: { $eq: new ObjectId(productId) } } ;
        if ( userId ){
            match['memberId'] = { $eq: new ObjectId(userId) }
        }

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
            { $match: match },
            { $group: { _id: "$productName", productCount: { $sum : 1 } }},
            { $project: { productCount: 1, productName : 1 }}
        ]).toArray();
        if ( productUploads.length > 0 ){
            result.data.push( { name: productUploads[0]._id, count: productUploads[0].productCount})
        } else {
            result.data.push( { name: 'No Product', count: 0})
        }
    }

    let userFind = [];
    if ( location && location != '-'  ){
        userFind.push( { '$or': [{ "user.hometownCity": new RegExp(location) }, { "user.hometownState": new RegExp(location)}] });
    }

    if ( ageFrom != '-' && ageTo != '-'){
        userFind.push( { "age": { $gte: ageFrom, $lte: ageTo } });
    }

    if ( ageFrom != '-' && ageTo == '-' ){
        userFind.push( { "age": { $gte: ageFrom } });
    }

    if ( ageFrom == '-' && ageTo  != '-'  ){
        userFind.push( { "age": { $lte: ageTo } });
    }

    console.log('args', args)
    console.log('userFind', userFind)
    if ( userFind.length ){
        if ( userId ){
            userFind['memberId'] = { $eq: new ObjectId(userId) }
        }

        const memberUploads = await dbClient.db(dbName).collection("uploads").aggregate([
            {
                $lookup:{
                    from: "users",
                    localField : "memberId",
                    foreignField : "_id",
                    as : "user",
                }
            },
            {
                $addFields: {
                    "displayName": { "$arrayElemAt": [ "$user.displayName", 0 ] },
                    "age": { "$arrayElemAt": [ "$user.age", 0 ] },
                    "location": { "$arrayElemAt": [ "$user.hometownCity", 0 ] },
                    "user": { "$arrayElemAt": [ "$user", 0 ] },
                }
            },
            { $match: userFind[0] },
            { $group: { _id: "$age", memberCount: { $sum : 1 } }},
            { $project: { memberCount: 1, age : 1 }}
        ]).toArray();
        if ( memberUploads.length > 0 ){
            result.data.push( { name: memberUploads[0]._id, count: memberUploads[0].memberCount})
        } else {
            result.data.push( { name: 'No Member', count: 0})
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
    let TotalUsers = await dbClient.db(dbName).collection("users").find({role:"member"}).toArray();
    result.totalCount = TotalUsers.length
    result.data = []
    result.list = TotalUsers

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

    const realmApi = new RealmApiClient();

    for ( const userKey in result.list ){
        const user = result.list[userKey]
        try {
            let findRealmUser = await realmApi.getUser(user.stitchId)
            if ( findRealmUser ){
                user.lastActiveAt = new Date(findRealmUser.last_authentication_date*1000)
            }
        } catch (e) {
            console.log(e)
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


const getTotalCreditsByCustomerId = async (customerId = null) => {
    let totalCredits = 0
    let credits = null;
    if ( customerId ){
        credits = await dbClient.db(dbName).collection("customer_credits").aggregate([
            { $match : { customerId: new ObjectId(customerId)}},
            {
                $group: {
                    _id: null,
                    total: {
                        $sum: "$amount"
                    }
                }
            },
        ]).toArray();
    } else {
        credits = await dbClient.db(dbName).collection("customer_credits").aggregate([
            {
                $group: {
                    _id: null,
                    total: {
                        $sum: "$amount"
                    }
                }
            },
        ]).toArray();
    }

    if ( credits && credits.length > 0 ){
        totalCredits = credits[0].total
    }

    return totalCredits;
}

const getTotalCredits = async (root, args, context, info) => {
    return await getTotalCreditsByCustomerId(args.customerId)
}

const getFilterCustomerId = async (root, args, context, info) => {
    const { customerId = null } = args;

    let result = {}
    let totalCredits = await getTotalCreditsByCustomerId(args.customerId);
    result.totalCount = totalCredits
    result.data = []

    if ( customerId ){
        const customerCredits = await dbClient.db(dbName).collection("customer_credits").aggregate([
            {
                $lookup:{
                    from: "customers",
                    localField : "customerId",
                    foreignField : "_id",
                    as : "customer",
                }
            },
            {
                $addFields: {
                    "companyName": { "$arrayElemAt": [ "$customer.companyName", 0 ] },
                }
            },
            { $match: { customerId: { $eq: new ObjectId(customerId) } } },
            { $group: { _id: { companyName: "$companyName"}, customerCount: { $sum : "$amount" } }},
            { $project: { customerCount: 1, companyName: 1 }}
        ]).toArray();

        if ( customerCredits.length > 0 ){
            result.data.push( { name: customerCredits[0]._id.companyName, count: customerCredits[0].customerCount})
        } else {
            //result.data.push( { name: 'Other', count: 0})
        }
    }

    return result
}




const getOfferCreditsByDay = async (root, args, context, info) => {
    var dayOfMonth = +moment(args.date, "YYYY-MM-DD").format('DD');
    var month = +moment(args.date, "YYYY-MM-DD").format('MM');
    var year = +moment(args.date, "YYYY-MM-DD").format('YYYY');

    let credits = await dbClient.db(dbName).collection("customer_credits").aggregate([
        {
            $project:
                {
                    _id: "$_id",
                    amount: "$amount",
                    createdAt: "$createdAt",
                    year: { $year: "$createdAt" },
                    month: { $month: "$createdAt" },
                    day: { $dayOfMonth: "$createdAt" }
                }
        },
        { $match : { day : dayOfMonth, month: month, year: year } },
    ]).toArray()

    console.log('getOfferCreditsByDay', credits.length)

    return {
        totalCount: credits.length,
        data: [
            {
                name: args.date,
                count: credits.length
            }
        ]
    }
}

const getOfferCreditsByWeekRange = async (root, args, context, info) => {

    let credits = await dbClient.db(dbName).collection("customer_credits").aggregate([
        {
            $project:
                {
                    _id: "$_id",
                    amount: "$amount",
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

    console.log('getOfferCreditsByWeekRange', credits)

    const result = {
        totalCount: credits.reduce(function(count, u){
            return count + u.count;
        }, 0),
        data: credits.map(u => {
            return { name: u._id.name, count: u.count }
        })
    }

    return result
}

const getOfferCreditsByYearRange = async (root, args, context, info) => {

    let credits = await dbClient.db(dbName).collection("customer_credits").aggregate([
        {
            $project:
                {
                    _id: "$_id",
                    amount: "$amount",
                    createdAt: "$createdAt",
                    year: { $year: "$createdAt" },
                }
        },
        { $match : { createdAt: { $gte: new Date(args.dateFrom), $lte: new Date(args.dateTo) }}},
        { $group: {  _id : { year : "$year" }, count: { $sum : 1 }  }},
        { $sort : { "_id.year": 1 } },
    ]).toArray()

    console.log('getOfferCreditsByYearRange', credits)

    const result = {
        totalCount: credits.reduce(function(count, u){
            return count + u.count;
        }, 0),
        data: credits.map(u => {
            return { name: u._id.year, count: u.count }
        })
    }

    return result
}

const getOfferCreditsByMonth = async (root, args, context, info) => {
    let year = +moment(args.date, "YYYY-MM-DD").format('YYYY');

    let credits = await dbClient.db(dbName).collection("customer_credits").aggregate([
        {
            $project:
                {
                    _id: "$_id",
                    amount: "$amount",
                    createdAt: "$createdAt",
                    month: { $dateToString: { format: "%m", date: "$createdAt" } },
                    year: { $year: "$createdAt" },
                }
        },
        { $match : { year: { $eq: year }}},
        { $group: {  _id : { month : "$month" }, count: { $sum : 1 }  }},
        { $sort : { "_id.month": 1 } },
    ]).toArray()

    console.log('getOfferCreditsByMonth', credits)

    const result = {
        totalCount: credits.reduce(function(count, u){
            return count + u.count;
        }, 0),
        data: credits.map(u => {
            return { name: u._id.month, count: u.count }
        })
    }

    return result
}

module.exports = {
    queries: {
        getTotalLooks,
        getCustomerTotalLooks,
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

        getTotalCredits,
        getFilterCustomerId,
        getOfferCreditsByDay,
        getOfferCreditsByWeekRange,
        getOfferCreditsByYearRange,
        getOfferCreditsByMonth
    },

}