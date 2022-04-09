const NotificationOfferCreated = require('./notificationOfferCreated')
const NotificationOfferEarned = require('./notificationOfferEarned')
const NotificationSuccessfulUpload = require('./notificationSuccessfulUpload')
const NotificationPendingUpload = require('./notificationPendingUpload')
const NotificationFollowMember = require('./notificationFollowMember')
const NotificationSuccessfulDisbursement = require('./notificationSuccessfulDisbursement')

class NotificationFactory {
    static create (type) {
        if (type === 'offer_created') {
            return new NotificationOfferCreated()
        }

        if (type === 'offer_earned_amount') {
            return new NotificationOfferEarned()
        }

        if (type === 'member_successful_upload') {
            return new NotificationSuccessfulUpload()
        }

        if (type === 'member_pending_upload') {
            return new NotificationPendingUpload()
        }

        if (type === 'member_follow_member') {
            return new NotificationFollowMember()
        }

        if (type === 'member_successful_disbursement') {
            return new NotificationSuccessfulDisbursement()
        }

        throw new Error('Invalid Notification Type')
    }
}

module.exports = NotificationFactory