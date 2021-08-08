const VenmoGateway = require('./VenmoGateway');

const VENMO = 'venmo';

class PaymentProviderFactory {
    static create(type) {
        if (type === 'venmo') {
            return new VenmoGateway();
        }


        throw new Error('Payment provider invalid');
    }
}

PaymentProviderFactory.VENMO = VENMO;

module.exports = PaymentProviderFactory;
