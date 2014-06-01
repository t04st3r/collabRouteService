/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */




var fs = require('fs'),
        express = require('express'),
        https = require('https'),
        mysql = require('mysql'),
        queues = require('mysql-queues'), //syncronous multiple query and transaction support library 
        crypto = require('crypto'), //md5 for creating token
        nodemailer = require('nodemailer'),
        login = require("./login.js"),
        registration = require("./registration.js"),
        travelList = require("./travelList.js"),
        coordinates = require("./coordinates.js"),
        chat = require("./chat.js"),
        request = require('request'),
        //load config data from external JSON file
        confFile = fs.readFileSync('/home/raffaele/collabRoute/collabRoute.json', 'utf8'),
        conf = JSON.parse(confFile),
        //load 2048 bit SSL/TSL key and his relative signed certificate
        collabKey = fs.readFileSync(conf.keyPath),
        collabCert = fs.readFileSync(conf.certPath),
        option = {
            key: collabKey,
            cert: collabCert
        },
PORT = conf.serverPort,
        HOST = conf.serverHostname,
        CHATPORT = conf.serverChatPort,
        //chat variables
        chatHttp = require('http'),
        app = express();

app.configure(function() {
    app.use(express.urlencoded());
    app.use(express.json());
    app.use(app.router);
});

var chatApp = express();

chatApp.configure(function() {
    chatApp.use(express.urlencoded());
    chatApp.use(express.json());
    chatApp.use(chatApp.router);
});

var connection = mysql.createConnection({
    host: conf.dbHostname,
    port: conf.dbPort,
    user: conf.dbUser,
    password: conf.dbPassword,
    database: conf.dbName

});
queues(connection, true); //true on debug support
connection.connect();

var mailConfig = {
    service :conf.service,
    auth: {
        user: conf.mailUser,
        pass: conf.mailPass
    }
},
transport = nodemailer.createTransport("SMTP", mailConfig),
        server = https.createServer(option, app).listen(PORT, HOST);
eventLog('CollabRoute Server is running on ' + HOST + ':' + PORT);
var chatServer = chatHttp.createServer(chatApp).listen(CHATPORT, HOST);
eventLog('CollabRoute ChatServer is running on ' + HOST + ':' + CHATPORT);

var io = require('socket.io').listen(chatServer);

chat.chatHandler(io, eventLog, connection);

app.get('/auth/:mail/:pass', function(req, res) {
    login.doLogin(res, req, crypto, connection, eventLog, transport);
});

app.post('/add/user/', function(req, res) {
    registration.checkSendRegister(req, res, connection, eventLog, transport);
});

app.post('/confirm/user', function(req, res) {
    registration.confirmRegistration(req, res, connection, eventLog);
});

app.get('/travels/', function(req, res) {
    res.type('application/json');
    checkHeaderToken(req, connection, function(returnValue) {
        if (!returnValue) {
            res.json({type: 'adm_mbr_list', result: 'AUTH_FAILED'});
            return;
        }
        travelList.sendTravelUsersList(req, res, connection, eventLog);
    });
});

app.post('/add/travel/', function(req, res) {
    res.type('application/json');
    //need to create a separate connection for locking tables in race condition
    var lockConnection = mysql.createConnection({
        host: conf.dbHostname,
        port: conf.dbPort,
        user: conf.dbUser,
        password: conf.dbPassword,
        database: conf.dbName
    });
    queues(lockConnection, true);
    lockConnection.connect();
    checkHeaderToken(req, lockConnection, function(returnValue) {
        if (!returnValue) {
            res.json({type: 'add_new_travel', result: 'AUTH_FAILED'});
            return;
        }
        travelList.addNewTravel(req, res, lockConnection, eventLog);
        setTimeout(function() {
            lockConnection.destroy();
        }, 5000); //necessary delay, waiting to complete transaction
    });
});

app.post('/add/routes/', function(req, res) {
    res.type('application/json');
    //need to create a separate connection for locking tables in race condition
    var lockConnection = mysql.createConnection({
        host: conf.dbHostname,
        port: conf.dbPort,
        user: conf.dbUser,
        password: conf.dbPassword,
        database: conf.dbName
    });
    queues(lockConnection, true);
    lockConnection.connect();
    checkHeaderToken(req, lockConnection, function(returnValue) {
        if (!returnValue) {
            res.json({type: 'add_new_routes', result: 'AUTH_FAILED'});
            return;
        }
        travelList.addNewRoute(req, res, lockConnection, eventLog, chat);
        setTimeout(function() {
            lockConnection.destroy();
        }, 5000); //necessary delay, waiting to complete transaction
    });
});

app.post('/delete/routes/', function(req, res) {
    res.type('application/json');
    checkHeaderToken(req, connection, function(returnValue) {
        if (!returnValue) {
            res.json({type: 'delete_route', result: 'AUTH_FAILED'});
            return;
        }
        travelList.deleteRoute(req, res, connection, chat, eventLog);
    });
});

app.post('/delete/travel/', function(req, res) {
    res.type('application/json');
    checkHeaderToken(req, connection, function(returnValue) {
        if (!returnValue) {
            res.json({type: 'leave_delete_travel', result: 'AUTH_FAILED'});
            return;
        }
        travelList.deleteTravel(req, res, connection, chat, eventLog);
    });
});

app.post('/update/coordinates/', function(req, res) {
    res.type('application/json');
    checkHeaderToken(req, connection, function(returnValue) {
        if (!returnValue) {
            res.json({type: 'leave_delete_travel', result: 'AUTH_FAILED'});
            return;
        }
        coordinates.updateCoordinates(req, res, connection, eventLog, request, conf.APIKey, chat);
    });
});

app.get('/routes/:id', function(req, res) {
    res.type('application/json');
    checkHeaderToken(req, connection, function(returnValue) {
        if (!returnValue) {
            res.json({type: 'routes_list', result: 'AUTH_FAILED'});
            return;
        }
        travelList.getRoutes(req, res, connection, eventLog);
    });
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


function checkHeaderToken(req, connection, callback) { //callback function return synchronously the result of the query
    if (!req.headers.hasOwnProperty("token") || !req.headers.hasOwnProperty("id")) {
        callback(false);
        return;
    }
    var ip = req.connection.remoteAddress;
    var id = req.headers.id;
    var token = req.headers.token;
    connection.query("SELECT token FROM user WHERE id =" + connection.escape(id), function(err, result) {
        if (err) {
            eventLog('[ Database error on header check from ' + ip + ' id: ' + id + ' ]');
            callback(false);
            return;
        }
        if (result.length === 0 || result[0].token !== token) {
            eventLog('[ Authentication failed from ' + ip + ' id: ' + id + ' using token: ' + token + ' ]');
            callback(false);
            return;
        }
        callback(true);
    });
}