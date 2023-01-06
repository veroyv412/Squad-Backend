const { dbClient, dbName } = require('../../config/mongo');
const ObjectId = require('mongodb').ObjectId;
const NotificationFactory = require('../../utils/Notification/notificationFactory');
const sgMail = require('@sendgrid/mail');

const moment = require('moment'); // require

const NOTIFICATION_TYPES = {
  OFFER_CREATED: 'offer_created',
  MEMBER_OFFER_EARNED_AMOUNT: 'offer_earned_amount',
  MEMBER_SUCCESSFUL_UPLOAD: 'member_successful_upload',
  MEMBER_PENDING_UPLOAD: 'member_pending_upload',
  MEMBER_FOLLOW_MEMBER: 'member_follow_member',
  MEMBER_SUCCESSFUL_DISBURSEMENT: 'member_successful_disbursement',
};

const NOTIFICATION_FROM_TO_TYPES = {
  CUSTOMER: 'customer',
  MEMBER: 'member',
  ADMIN: 'admin',
};

/* Queries */
const getMemberNotifications = async (root, args, context, info) => {
  const notifications = await dbClient
    .db(dbName)
    .collection('notifications')
    .find({ toUserType: 'member', toUserId: new ObjectId(args.userId) })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  console.log('Get Member Notifications ', notifications);

  for (let notification of notifications) {
    const notificationObject = NotificationFactory.create(notification.type);
    const data = await notificationObject.getData(notification.externalId);

    console.log('Notification External Data ', data);

    notification.data = JSON.stringify(data);
    notification.fromNow = moment(notification.createdAt).fromNow();
  }

  return notifications;
};

/* Helpers */
const addNotification = async (data) => {
  try {
    console.log('Add Notification Data ', data);

    let notification = {
      type: data.type,
      title: data.title,
      message: data.message,
      fromUserType: data.fromUserType,
      fromUserId: new ObjectId(data.fromUserId),
      toUserType: data.toUserType,
      toUserId: new ObjectId(data.toUserId),
      externalId: new ObjectId(data.externalId),
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const _notification = await dbClient
      .db(dbName)
      .collection('notifications')
      .insertOne(notification);

    return _notification.insertedId.toString();
  } catch (e) {
    return e;
  }
};

const createOfferNotificationsToMembers = async (customerId, uploadIds, externalId) => {
  try {
    let customer = await dbClient
      .db(dbName)
      .collection('customers')
      .findOne({ _id: new ObjectId(customerId) });

    const _uploads = await dbClient
      .db(dbName)
      .collection('uploads')
      .find({ _id: { $in: uploadIds.map((u) => new ObjectId(u)) } })
      .toArray();

    for (let upload of _uploads) {
      const data = {
        type: NOTIFICATION_TYPES.OFFER_CREATED,
        title: 'New Offer',
        message: `New feedback offer from Customer ${customer.companyName}`,
        fromUserType: NOTIFICATION_FROM_TO_TYPES.CUSTOMER,
        fromUserId: customerId,
        toUserType: NOTIFICATION_FROM_TO_TYPES.MEMBER,
        toUserId: upload.memberId,
        externalId: externalId,
      };

      console.log('Create Offer Notification To Members ', data);
      await addNotification(data);
    }
  } catch (e) {
    return e;
  }
};

const createAnswerFeedbackEarnedNotificationToMember = async (
  customerId,
  userId,
  amount,
  externalId
) => {
  try {
    let customer = await dbClient
      .db(dbName)
      .collection('customers')
      .findOne({ _id: new ObjectId(customerId) });

    const earnedAmount = amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });

    const data = {
      type: NOTIFICATION_TYPES.MEMBER_OFFER_EARNED_AMOUNT,
      title: 'New Answer',
      message: `Earned ${earnedAmount} from Customer ${customer.companyName} feedback Offer`,
      fromUserType: NOTIFICATION_FROM_TO_TYPES.CUSTOMER,
      fromUserId: customerId,
      toUserType: NOTIFICATION_FROM_TO_TYPES.MEMBER,
      toUserId: userId,
      externalId: externalId,
    };

    console.log('Create Earned Amount Notification To Members ', data);
    await addNotification(data);
  } catch (e) {
    return e;
  }
};

const createFollowNotificationToMember = async (userId1, userId2) => {
  try {
    let user1 = await dbClient
      .db(dbName)
      .collection('users')
      .findOne({ _id: new ObjectId(userId1) });

    const data = {
      type: NOTIFICATION_TYPES.MEMBER_FOLLOW_MEMBER,
      title: 'New Follow',
      message: `Congratulations, ${user1.displayName} has started following you!`,
      fromUserType: NOTIFICATION_FROM_TO_TYPES.MEMBER,
      fromUserId: userId1,
      toUserType: NOTIFICATION_FROM_TO_TYPES.MEMBER,
      toUserId: userId2,
      externalId: userId2,
    };

    console.log('Create Follow Notification To Members ', data);
    await addNotification(data);
  } catch (e) {
    return e;
  }
};

const createSuccessfulUploadNotificationToMember = async (uploadIds, amount) => {
  try {
    const _uploads = await dbClient
      .db(dbName)
      .collection('uploads')
      .find({ _id: { $in: uploadIds.map((u) => new ObjectId(u)) } })
      .toArray();

    const earnedAmount = amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    for (let upload of _uploads) {
      const data = {
        type: NOTIFICATION_TYPES.MEMBER_SUCCESSFUL_UPLOAD,
        title: 'New Upload',
        message: `Earned ${earnedAmount} from ${upload.brandName}/${upload.categoryName}/${upload.productName} Look Upload`,
        fromUserType: NOTIFICATION_FROM_TO_TYPES.ADMIN,
        fromUserId: '5ecfb68302d386b70167d566',
        toUserType: NOTIFICATION_FROM_TO_TYPES.MEMBER,
        toUserId: upload.memberId,
        externalId: upload._id,
      };

      console.log('Create Successful Upload Notification To Members ', data);
      await addNotification(data);

      let user = await dbClient
        .db(dbName)
        .collection('users')
        .findOne({ _id: new ObjectId(upload.memberId) });
      console.log(user);

      const msg = {
        to: user.email,
        from: {
          name: 'The Lookbook Team',
          email: 'fred@teammysquad.com',
        },
        templateId: 'd-36a5f60e1dda491baec106a27add0866',
        dynamic_template_data: {
          earnings_link: process.env.FRONTEND_URL + `member/earnings`,
          add_phone_number_link: process.env.FRONTEND_URL + `member/profile`,
        },
      };

      console.log('Upload compensation email.', msg);
      await sgMail.send(msg);
    }
  } catch (e) {
    return e;
  }
};

const createPendingUploadNotificationToMember = async (uploadId) => {
  try {
    const _upload = await dbClient
      .db(dbName)
      .collection('uploads')
      .findOne({ _id: new ObjectId(uploadId) });

    const data = {
      type: NOTIFICATION_TYPES.MEMBER_PENDING_UPLOAD,
      title: 'New Upload',
      message: `You successfully uploaded your look, it is in the process of being verified`,
      fromUserType: NOTIFICATION_FROM_TO_TYPES.ADMIN,
      fromUserId: '5ecfb68302d386b70167d566',
      toUserType: NOTIFICATION_FROM_TO_TYPES.MEMBER,
      toUserId: _upload.memberId,
      externalId: _upload._id,
    };

    console.log(
      'You successfully uploaded your look, it is in the process of being verified ',
      data
    );
    await addNotification(data);
  } catch (e) {
    return e;
  }
};

const createSuccessfulDisbursedEarningNotificationToMember = async (userId, externalId, note) => {
  const data = {
    type: NOTIFICATION_TYPES.MEMBER_SUCCESSFUL_DISBURSEMENT,
    title: 'New Disbursement',
    message: note,
    fromUserType: NOTIFICATION_FROM_TO_TYPES.ADMIN,
    fromUserId: '5ecfb68302d386b70167d566',
    toUserType: NOTIFICATION_FROM_TO_TYPES.MEMBER,
    toUserId: new ObjectId(userId),
    externalId: new ObjectId(externalId),
  };

  console.log('Create Successful Disbursed Notification To Members ', data);
  await addNotification(data);
};

/* Mutations */
const readNotification = async (parent, args) => {
  try {
    await dbClient
      .db(dbName)
      .collection('notifications')
      .updateOne(
        { _id: new ObjectId(args.notificationId) },
        {
          $set: { read: args.read },
          $currentDate: { updatedAt: true },
        }
      );
    return args.notificationId;
  } catch (e) {
    return e;
  }
};

module.exports = {
  queries: {
    getMemberNotifications,
  },
  mutations: {
    readNotification,
  },
  helper: {
    addNotification,
    createOfferNotificationsToMembers,
    createAnswerFeedbackEarnedNotificationToMember,
    createSuccessfulUploadNotificationToMember,
    createFollowNotificationToMember,
    createSuccessfulDisbursedEarningNotificationToMember,
    createPendingUploadNotificationToMember,
  },
};
