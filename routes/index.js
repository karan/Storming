var express = require('express');
var router = express.Router();
var passport = require('passport');
if (process.env.NODE_ENV === 'production') {
    var constants = require('./../config/constants.production.js');
} else {
    var constants = require('./../config/constants.js');
}
var request = require('request');
var twit = require('twit');

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}

router.get('/', function(req, res) {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.render('index');
});

router.get('/login', passport.authenticate('twitter'));

router.get(constants.Twitter.CALLBACK,
    passport.authenticate('twitter', {
      successRedirect: '/dashboard',
      failureRedirect: '/'
    })
);

router.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

router.get('/dashboard', isAuthenticated, function(req, res) {
  res.render('dashboard', { username: req.user.username });
});

router.post('/tweet', isAuthenticated, function(req, res) {
  var API_URL = 'https://upload.twitter.com/1.1/media/upload.json';

  var image = req.body.image.replace(/^data.*base64,/, '');

  // First we post to media/upload.json
  request.post(API_URL, {
    oauth: {
      consumer_key: constants.Twitter.KEY,
      consumer_secret: constants.Twitter.SECRET,
      token: req.user.access_token,
      token_secret: req.user.access_token_secret
    },
    form: {
      media: image
    },
    json: true
  }, function (err, response, body) {
    var T = new twit({
      consumer_key: constants.Twitter.KEY,
      consumer_secret: constants.Twitter.SECRET,
      access_token: req.user.access_token,
      access_token_secret: req.user.access_token_secret
    });

    T.post('statuses/update', {
      status: req.body.message || "",
      media_ids: body.media_id_string
    }, function(err, data, response) {
      var tweet_id = data.id_str;
      T.get('statuses/oembed', { id: tweet_id }, function(err, data, response) {
        req.user.tweet_ids.push('https://twitter.com/' + req.user.username + '/status/' + tweet_id);
        req.user.save(function(err, u) {
          res.send(data.html);
        });
      });
    });
  });
});

router.post('/upload/imgur', function(req, res) {

  var img = req.body.image.replace(/^data:image\/(png|jpg);base64,/, '');
  var options = {
    url: 'https://api.imgur.com/3/image',
    method: 'POST',
    body: {
      image: img,
      type: 'base64',
    },
    json: true,
    headers: {
     'Authorization': 'Client-ID ' + constants.Imgur.ID
    }
  }

  request.post(options, function(err, response, body) {
    if (err) {
      return res.send('error');
    }

    return res.send(body.data.link);
  });
});

module.exports = router;
