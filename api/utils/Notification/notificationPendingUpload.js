const { dbClient, dbName } = require('../../config/mongo');
const ObjectId = require('mongodb').ObjectId;

class NotificationPendingUpload {
  async getData(externalId) {
    const upload = await dbClient
      .db(dbName)
      .collection('uploads')
      .findOne({ _id: new ObjectId(externalId) });
    return upload;
  }
}

module.exports = NotificationPendingUpload;
