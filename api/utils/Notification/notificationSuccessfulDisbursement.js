const { dbClient, dbName } = require('../../config/mongo');
const ObjectId = require('mongodb').ObjectId;

class NotificationSuccessfulDisbursement {
    async getData (externalId) {
        const earning = await dbClient.db(dbName).collection("member_earnings").findOne({_id: new ObjectId(externalId)});
        return earning;
    }
}

module.exports = NotificationSuccessfulDisbursement