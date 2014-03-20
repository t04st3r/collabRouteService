/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */




var fs = require('fs');
var express = require('express');
var https = require('https');
var mysql = require('mysql');
var crypto = require('crypto'); //md5 for creating token
var nodemailer = require('nodemailer');
var login = require("./login.js");
var registration = require("./registration.js");

//load config data from external JSON file
var confFile = fs.readFileSync('/home/ubuntu/collabRoute/collabRoute.json', 'utf8');
var conf = JSON.parse(confFile);
var tokenSeed = conf.tokenSeed; //seed for token generator

//load 2048 bit SSL/TSL key and his relative signed certificate
var collabKey = fs.readFileSync(conf.keyPath);
var collabCert = fs.readFileSync(conf.certPath);

var option = {
    key: collabKey,
    cert: collabCert
};

var PORT = conf.serverPort;
var HOST = conf.serverHostname;

var app = express();

app.configure(function() {
    app.use(express.urlencoded());
    app.use(express.json());
    app.use(app.router);
});

var connection = mysql.createConnection({
    host: conf.dbHostname,
    port: conf.dbPort,
    user: conf.dbUser,
    password: conf.dbPassword,
    database: conf.dbName

});

connection.connect();

var mailConfig = {
    service: conf.mailService,
    auth: {
        user: conf.mailUser,
        pass: conf.mailPass
    }
};

var transport = nodemailer.createTransport("SMTP", mailConfig);

var server = https.createServer(option, app).listen(PORT, HOST);
console.log('Collab Server is running on %s:%s', HOST, PORT);

app.get('/auth/:mail/:pass', function(req, res) {
    login.doLogin(res, req, crypto, connection, tokenSeed, eventLog);
});

app.post('/add/user/', function(req, res) {
    registration.checkSendRegister(req, res, connection, eventLog, transport);
});


app.get('/users', function(req, res) {
    res.type('application/json');
    connection.query('SELECT * FROM user', function(err, docs) {
        res.json(docs);
    });
    var currentdate = new Date();
    var datetime = "[" + currentdate.getDate() + "/"
            + (currentdate.getMonth() + 1) + "/"
            + currentdate.getFullYear() + " @ "
            + currentdate.getHours() + ":"
            + currentdate.getMinutes() + ":"
            + currentdate.getSeconds() + "]";
    console.log(datetime + ' somebody get user list');
});

function eventLog(event) {
    var currentdate = new Date();
    var datetime = "[" + currentdate.getDate() + "/"
            + (currentdate.getMonth() + 1) + "/"
            + currentdate.getFullYear() + " @ "
            + currentdate.getHours() + ":"
            + currentdate.getMinutes() + ":"
            + currentdate.getSeconds() + "]";
    console.log(datetime + ' ' + event);
}


function checkHeaderToken(header, req) {
    if (!header.hasOwnProperty(token) || !header.hasOwnProperty(id)) {
        return false;
    }
    var ip = req.connection.remoteAddress;
    connection.query("SELECT token FROM user WHERE id =" + connection.escape(header.id), function(err, result) {
        if (err) {
            res.json({result: 'DATABASE_ERROR'});
            eventLog('[ Database error on header check from ' + ip + ' id: ' + header.id + ' ]');
            return false;
        }
        if (result.length === 0 || result[0].token !== header.token) {
            res.json({result: 'AUTH_FAILED'});
            eventLog('[ Authentication failed from ' + ip + ' id: ' + header.id + ' using token: ' + header.token + ' ]');
            return false;
        }
        return true;
    });

}


