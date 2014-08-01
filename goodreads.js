(function() {
  /* Goodreads - Handles all connectivity to Goodreads API */
  /* API Docs: http://www.goodreads.com/api */  var Goodreads, http, oauth, sys, xml2js;
  http = require('http');
  xml2js = require('xml2js');
  oauth = (require('oauth')).OAuth;
  util = require('util');

  //add supplant to inject values into string
  String.prototype.supplant = function(o) {
    return this.replace(/{([^{}]*)}/g,
      function (a, b) {
        var r = o[b];
        return typeof r === 'string' || typeof r === 'number' ? r : a;
      }
    );
  };

  Goodreads = (function() {
    /* CONFIG */    var clone;
    function Goodreads(config) {
      this.options = {
        host: 'www.goodreads.com',
        port: 80,
        key: config.key,
        secret: config.secret,
        callback: config.callback || 'http://localhost:80045/callback',
        method: 'GET',
        path: '',
        oauth_request_url: 'http://goodreads.com/oauth/request_token',
        oauth_access_url: 'http://goodreads.com/oauth/access_token',
        oauth_version: '1.0',
        oauth_encryption: 'HMAC-SHA1'
      };
      this.oauthAccessToken = '';
      this.oauthAcessTokenSecret = '';
      this.client = null;
    }
    Goodreads.prototype.configure = function(gr_key, gr_secret, gr_callback) {
      this.options.key = gr_key || this.options.key;
      this.options.secret = gr_secret || this.options.secret;
      return this.options.callback = gr_callback || this.options.callback;
    };
    /* BOOKSHELVES */
    Goodreads.prototype.getShelves = function(userId, callback) {
      this.options.path = 'http://www.goodreads.com/shelf/list.xml?user_id=' + userId + "&key=" + this.options.key;
      return this.getRequest(callback);
    };
    Goodreads.prototype.getSingleShelf = function(params, callback) {
      //set up base path with required params
      this.options.path = 'http://www.goodreads.com/review/list/{id}.xml?key={key}&shelf={shelf}'.supplant({id: params.id, key: this.options.key, shelf: params.shelf});
      //check for optional params
      if (params.page) {
        this.options.path = this.options.path + '&page=' + params.page;
      }
      if (params.per_page) {
        this.options.path = this.options.path + '&per_page=' + params.per_page;
      }
      if (params.sort) {
        this.options.path = this.options.path + '&sort=' + params.sort;
      }
      if (params.query) {
        this.options.path = this.options.path + '&search_query=' + params.query;
      }
      if (params.order) {
        this.options.path = this.options.path + '&order=' + params.order;
      }

      return this.getRequest(callback);
    };

    /* REVIEWS */
    //returns imbeded review widget
    Goodreads.prototype.getReviewsByIsbn = function(isbn, callback) {
      this.options.path = 'https://www.goodreads.com/book/isbn?isbn=' + isbn + '&key=' + this.options.key; 
      return this.getRequest(callback);
    };

    /* SEARCH */
    // title, author, genre, all
    Goodreads.prototype.searchBook = function(params, callback) {
      this.options.path = 'https://www.goodreads.com/search.xml?key=' + this.options.key + '&q=' + encodeURI(params.query);
      if (params.page) {
        this.options.path = this.options.path + '&page=' + params.page;
      }
      if (params.search) {
        //title, author, genre, all
        this.options.path = this.options.path + '&searchfield=' + params.search;

      }
      return this.getRequest(callback);
    }; 

    Goodreads.prototype.searchAuthor = function(author, callback) {
      this.options.path = 'https://www.goodreads.com/api/author_url/' + encodeURI(author) + '?key=' + this.options.key;
      return this.getRequest(callback);
    };    

    /* NOTE: Not Working Yet!!!! */
    Goodreads.prototype.getFriends = function(userId, accessToken, accessTokenSecret, callback) {
      var oa;
      this.options.path = 'http://www.goodreads.com/friend/user/' + userId + '.xml?&key=' + this.options.key;
      oa = new oauth(this.options.oauth_request_url, this.options.oauth_access_url, this.options.key, this.options.secret, this.options.oauth_version, this.options.callback, this.options.oauth_encryption);
      return oa.getProtectedResource(this.options.path, 'GET', accessToken, accessTokenSecret, function(error, data, response) {
        if (error) {
          return callback('Error getting OAuth request token : ' + JSON.stringify(error), 500);
        } else {
          return callback(data);
        }
      });
    };
    /* OAUTH */
    Goodreads.prototype.requestToken = function(callback) {
      var oa;
      oa = new oauth(this.options.oauth_request_url, this.options.oauth_access_url, this.options.key, this.options.secret, this.options.oauth_version, this.options.callback, this.options.oauth_encryption);
      return oa.getOAuthRequestToken(function(error, oauthToken, oauthTokenSecret, results) {
        var url;
        if (error) {
          console.log(error);
          return callback('Error getting OAuth request token : ' + JSON.stringify(error), 500);
        } else {
          url = 'https://goodreads.com/oauth/authorize?oauth_token=' + oauthToken + '&oauth_callback=' + oa._authorize_callback;
          return callback({
            oauthToken: oauthToken,
            oauthTokenSecret: oauthTokenSecret,
            url: url
          });
        }
      });
    };
    Goodreads.prototype.processCallback = function(oauthToken, oauthTokenSecret, authorize, callback) {
      var oa;
      oa = new oauth(this.options.oauth_request_url, this.options.oauth_access_url, this.options.key, this.options.secret, this.options.oauth_version, this.options.callback, this.options.oauth_encryption);
      return oa.getOAuthAccessToken(oauthToken, oauthTokenSecret, authorize, function(error, oauthAccessToken, oauthAccessTokenSecret, results) {
        var parser;
        parser = new xml2js.Parser();
        if (error) {
          callback('Error getting OAuth access token : ' + (util.inspect(error)) + '[' + oauthAccessToken + '] [' + oauthAccessTokenSecret + '] [' + (util.inspect(results)) + ']', 500);
        } else {
          oa.get('http://www.goodreads.com/api/auth_user', oauthAccessToken, oauthAccessTokenSecret, function(error, data, response) {
            if (error) {
              return callback('Error getting User ID : ' + (util.inspect(error)), 500);
            } else {
              return parser.parseString(data);
            }
          });
        }
        return parser.on('end', function(result) {
          if (result.user['@'].id !== null) {
            return callback({
              'username': result.user.name,
              'userid': result.user['@'].id,
              'success': 1,
              'accessToken': oauthAccessToken,
              'accessTokenSecret': oauthAccessTokenSecret
            });
          } else {
            return callback('Error: Invalid XML response received from Goodreads', 500);
          }
        });
      });
    };
    /* API: 'GET' */
    Goodreads.prototype.getRequest = function(callback) {
      var parser, tmp, _options;
      _options = this.options;
      tmp = [];
      parser = new xml2js.Parser();
      return http.request(_options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
          return tmp.push(chunk);
        });
        res.on('end', function(e) {
          var body;
          body = tmp.join('');
          return parser.parseString(body);
        });
        return parser.on('end', function(result) {
          return callback(result);
        });
      }).end();
    };
    clone = function(obj) {
      if (obj !== null || typeof obj !== 'object') {
        return obj;
      }
    };
    return Goodreads;
  })();
  module.exports = {
    client: function(options) {
      return new Goodreads(options);
    }
  };
}).call(this);