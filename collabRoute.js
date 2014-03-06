/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


var fs = require('fs');
var express = require('express');
var https = require('https');
var mysql = require('mysql');

//load 2048 bit SSL/TSL key and his relative signed certificate
var collabKey = fs.readFileSync('/home/raffaele/collabRoute/serverKeys/collabKey.pem');
var collabCert = fs.readFileSync('/home/raffaele/collabRoute/serverKeys/collabCert.pem');

var option = {
    key: collabKey,
    cert: collabCert
};

var PORT = 8000;
var HOST = '192.168.1.131';

var app = express();
app.configure(function() {
    app.use(app.router);
});

var connection = mysql.createConnection({
    host: '192.168.1.131',
    user: 'raffaele',
    password: 'pluto',
    database: 'collab_route'
});

var server = https.createServer(option, app).listen(PORT, HOST);
console.log('Collab Server is running on %s:%s', HOST, PORT);

connection.connect();

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
            + currentdate.getSeconds()+"]";
    console.log(datetime+' somebody get user list');
});
