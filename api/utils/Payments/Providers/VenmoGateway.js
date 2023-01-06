const payoutsNodeJssdk = require('@paypal/payouts-sdk');
const moment = require('moment'); // require

class VenmoGateway {
  environment() {
    let clientId = process.env.VENMO_CLIENT_ID;
    let clientSecret = process.env.VENMO_SECRET;

    //if (process.env.NODE_ENV === 'production') {
    return new payoutsNodeJssdk.core.LiveEnvironment(clientId, clientSecret);
    //}

    return new payoutsNodeJssdk.core.SandboxEnvironment(clientId, clientSecret);
  }

  constructor() {
    this.gateway = new payoutsNodeJssdk.core.PayPalHttpClient(this.environment());
  }

  async payoutMember(senderBatchId, memberEarnings) {
    const items = memberEarnings.map((e) => ({
      recipient_type: 'PHONE',
      amount: e.amount,
      note: e.note,
      receiver: e.receiver,
      sender_item_id: e.sender_item_id,
      recipient_wallet: 'Venmo',
    }));
    try {
      const requestBody = {
        sender_batch_header: {
          sender_batch_id: senderBatchId,
        },
        items: items,
      };

      let request = new payoutsNodeJssdk.payouts.PayoutsPostRequest();
      request.requestBody(requestBody);

      let response = await this.gateway
        .execute(request)
        .then((response) => response.result.batch_header.payout_batch_id);
      return response;
    } catch (e) {
      throw e;
    }
  }
}

module.exports = VenmoGateway;
