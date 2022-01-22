const axios = require('axios');
const moment = require('moment'); // require
const _ = require('lodash');


class RealmApiClient {
    accessToken = null

    async getAccessToken() {
        const config = {
            method: 'get',
            url: 'https://realm.mongodb.com/api/admin/v3.0/auth/providers/mongodb-cloud/login',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            data : { username: process.env.REALM_USERNAME, apiKey: process.env.REALM_API_KEY }
        };

        const response = await axios(config)

        if ( response.status === 200 ){
            this.accessToken = response.data.access_token
            return this.accessToken
        }

        return null
    }

    /**
     * @returns List of Realm Users
     */
    async getUsers() {
        const accessToken = this.accessToken ?? await this.getAccessToken();
        if ( accessToken ){
            const config = {
                method: 'get',
                url: `https://realm.mongodb.com/api/admin/v3.0/groups/${process.env.REALM_GROUP_ID}/apps/${process.env.REALM_APP_ID}/users`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
            };

            const response = await axios(config)
            if ( response.status === 200 ){
                let users = response.data
                users = users.map(u => {
                    u.last_active = new Date(u.last_authentication_date)
                    return u
                })
                return users
            }

            return []
        }

        return []
    }

    async getUser(id) {
        const accessToken = this.accessToken ?? await this.getAccessToken();
        if ( accessToken ){
            const config = {
                method: 'get',
                url: `https://realm.mongodb.com/api/admin/v3.0/groups/${process.env.REALM_GROUP_ID}/apps/${process.env.REALM_APP_ID}/users/${id}`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
            };

            const response = await axios(config)
            if ( response.status === 200 ){
                let user = response.data
                return user
            }

            return []
        }

        return []
    }
}


module.exports = {
    RealmApiClient,
};