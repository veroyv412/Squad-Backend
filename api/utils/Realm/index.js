const axios = require('axios');
const moment = require('moment'); // require
const _ = require('lodash');
const { AuthenticationError } = require('apollo-server');

const Realm = require('realm');
const dotenv = require('dotenv');
dotenv.config();

const app = new Realm.App({ id: process.env.REALM_APP_NAME });

class RealmApiClient {
  accessToken = null;
  refreshToken = null;

  static async getUserFromGraphQL(token) {
    const data = JSON.stringify({
      query: `query {
                users {
                    _id
                    email
                    displayName
                }
            }`,
      variables: {},
    });

    const config = {
      method: 'post',
      url: 'https://realm.mongodb.com/api/client/v2.0/app/squad-rpgkc/graphql',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: data,
    };

    try {
      const response = await axios(config);

      if (response.status === 200) {
        //this.accessToken = response.data.access_token
        return response.data.data.users[0];
      }
    } catch (e) {
      throw new AuthenticationError(e.message);
    }
  }

  async getEmailPasswordAccessToken(email, password) {
    const config = {
      method: 'get',
      url: `https://realm.mongodb.com/api/client/v2.0/app/${process.env.REALM_APP_NAME}/auth/providers/local-userpass/login`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      data: { username: email, password: password },
    };

    try {
      const response = await axios(config);

      if (response.status === 200) {
        this.accessToken = response.data.access_token;
        this.refreshToken = response.data.refresh_token;
        return {
          access_token: this.accessToken,
          refresh_token: this.refreshToken,
          user_id: response.data.user_id,
        };
      }
    } catch (e) {
      throw e.message;
    }
  }

  async registerUser(email, password) {
    await app.emailPasswordAuth.registerUser({ email, password });
    const credentials = Realm.Credentials.emailPassword(email, password);
    const user = await app.logIn(credentials);
    return user;
  }

  async getAccessToken() {
    const config = {
      method: 'get',
      url: 'https://realm.mongodb.com/api/admin/v3.0/auth/providers/mongodb-cloud/login',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      data: { username: process.env.REALM_USERNAME, apiKey: process.env.REALM_API_KEY },
    };

    const response = await axios(config);

    if (response.status === 200) {
      this.accessToken = response.data.access_token;
      return this.accessToken;
    }

    return null;
  }

  /**
   * @returns List of Realm Users
   */
  async getUsers() {
    const accessToken = this.accessToken ?? (await this.getAccessToken());
    if (accessToken) {
      const config = {
        method: 'get',
        url: `https://realm.mongodb.com/api/admin/v3.0/groups/${process.env.REALM_GROUP_ID}/apps/${process.env.REALM_APP_ID}/users`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      };

      const response = await axios(config);
      if (response.status === 200) {
        let users = response.data;
        users = users.map((u) => {
          u.last_active = new Date(u.last_authentication_date);
          return u;
        });
        return users;
      }

      return [];
    }

    return [];
  }

  async getUser(id) {
    const accessToken = this.accessToken ?? (await this.getAccessToken());
    if (accessToken) {
      const config = {
        method: 'get',
        url: `https://realm.mongodb.com/api/admin/v3.0/groups/${process.env.REALM_GROUP_ID}/apps/${process.env.REALM_APP_ID}/users/${id}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      };

      const response = await axios(config);
      if (response.status === 200) {
        let user = response.data;
        return user;
      }

      return [];
    }

    return [];
  }
}

module.exports = {
  RealmApiClient,
};
