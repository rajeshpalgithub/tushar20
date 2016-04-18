var gps = require("gps-tracking");
var express = require('express');
var path = require('path');
var app = express();
var server = app.listen(3000);
var cookieParser = require('cookie-parser');
var session = require('express-session');
var passport = require('passport');
var bodyParser = require('body-parser');
var io = require('socket.io')(server);	
var MongoClient = require('mongodb').MongoClient,
	assert = require('assert');

var mongourl = 'mongodb://localhost:27017/gps_server';

var options = {
	'debug'                 : false, //We don't want to debug info automatically. We are going to log everything manually so you can check what happens everywhere
	'port'                  : 8090,
	'device_adapter'        : "TK103"
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  secret: 'keyboard cat',
  resave: true,
  saveUninitialized: true,
  cookie: { secure: false }
}));
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions

app.use(express.static(__dirname + '/views'));
app.set('view engine', 'ejs');


app.get('/', function (req, res) {

    
   // res.sendFile(__dirname + '/site/index.html');
   // var user = { "user": "demo", "user_id": "123" };
    // req.session.user = user;
    console.log(req.session.user);
  if (req.session.user) {
      res.render('index');
    } else {
      res.render('login');
    }
});
app.post('/login', function (req, res) {
    var user = req.body.user;
    var password = req.body.password;
    if (user==='demo' && password ==='demo')
    {
        var user = {"user":"demo","user_id":"123"};
        req.session.user = user;
        //res.render('somePage.ext', { title: 'Login' })
        //return res.status(200).send();
         
        console.log(req.session);
        return res.redirect("/");
    } else {
        return res.status(401).send();
    }
    //
});
app.get('/login', function (req, res) {
    res.render('login');
    //
});

MongoClient.connect(mongourl, function(err, db) {
	assert.equal(null, err);
	console.log("Connected correctly to mongo DB server");


	var collections = {
		'pings': db.collection('pings')
	};

	io.on('connection', function(socket) {
		collections.pings.find({}).sort({inserted: -1}).limit(300).toArray(function(err, docs) {
			assert.equal(err, null);
			socket.emit('positions', {
				positions: docs
			});

		});
	});

	var server = gps.server(options, function(device, connection) {

		device.on("connected",function(data) {

			console.log("I'm a new device connected");
			return data;

		});

		device.on("login_request",function(device_id, msg_parts) {

			console.log('Hey! I want to start transmiting my position. Please accept me. My name is ' + device_id);

			this.login_authorized(true); 

			console.log("Ok, " + device_id + ", you're accepted!");

		});
		

		device.on("ping",function(data) {
			data.uid = this.getUID();
			io.emit('ping', data);
			data.latitude = data.latitude.toFixed(6);
			data.longitude = data.longitude.toFixed(6);
			//this = device
			console.log("I'm here: " + data.latitude + ", " + data.longitude + " (" + this.getUID() + ")");

			var data_to_insert = data;
			//data_to_insert.userid = session.user.user_id;
			data_to_insert.uid = this.getUID();

			collections.pings.insert(data_to_insert);

			//Look what informations the device sends to you (maybe velocity, gas level, etc)
			//console.log(data);
			return data;

		});

	   device.on("alarm",function(alarm_code, alarm_data, msg_data) {
			console.log("Help! Something happend: " + alarm_code + " (" + alarm_data.msg + ")");
		}); 

		//Also, you can listen on the native connection object
		connection.on('data', function(data) {
			//echo raw data package
			console.log(data.toString()); 
		})

	});
});

