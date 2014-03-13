/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */




var fs = require('fs');
var express = require('express');
var https = require('https');
var mysql = require('mysql');
var crypto = require('crypto');//md5 for creating token
var tokenSeed = 'itopinonavevanonipoti';//seed for token generator

//load config data from external file
var conf = fs.readFileSync('/home/ubuntu/collabRoute/collabRoute.conf', 'utf8').split('\n');

//load 2048 bit SSL/TSL key and his relative signed certificate
var collabKey = fs.readFileSync(conf[0]);
var collabCert = fs.readFileSync(conf[1]);

var option = {
    key: collabKey,
    cert: collabCert
};

var PORT = conf[2];
var HOST = conf[3];

var app = express();
app.configure(function() {
    app.use(app.router);
});

var connection = mysql.createConnection({
    host: conf[4],
    user: conf[5],
    password: conf[6],
    database: conf[7]
});

connection.connect();

var server = https.createServer(option, app).listen(PORT, HOST);
console.log('Collab Server is running on %s:%s', HOST, PORT);

app.get('/auth/:mail/:pass', function(req, res) {
    var mail = req.params.mail;
    var pass = req.params.pass;
    var ip = req.connection.remoteAddress;
    connection.query('SELECT id, name, token FROM user WHERE password = ' + connection.escape(pass) + ' AND email = ' + connection.escape(mail), function(err, result) {
        //console.log(result[0].token + " " + mail + " " + pass); //used for debugging 
        res.type('application/json');
        if (err) {
            res.json({result: 'DATABASE ERROR'})
            eventLog('[ Database error on login from ' + ip + ' mail: ' + mail + ' password: ' + pass + ' ]');
        }
        else if (result === 'undefined' || result.length === 0) {
            res.json({result: 'AUTH FAILED'});
            eventLog('[ Authentication failed from ' + ip + ' mail: ' + mail + ' password: ' + pass + ' ]');
        }
        else {
            var hash = crypto.createHash('md5').update(tokenSeed + mail + pass).digest('hex');
            if (result[0].token !== hash){
                connection.query("UPDATE user SET token = '" + hash + "' WHERE id = " + result[0].id);
                eventLog('[ Token updated for user: '+result[0].name+' id: '+result[0].id+' ]');
            }
            eventLog('[ user '+result[0].name+' id: '+result[0].id+' IP: '' successfully logged in')
            res.json({result: 'OK', token: hash, id: result[0].id, name: result[0].name});
        }
    });
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

/* function isLogged(connection , token){
 if(connection !== null){
 try{
 connection.query('SELECT id FROM user where token ='+connection.escape(token), 
 function(err , result){
 console.log(result+' '+err);
 
 });
 }catch(err){
 console.log(err);
 }
 } */
//format a string event with currenta date/time for server console.log
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
