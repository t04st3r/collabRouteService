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
app.configure(function(){
    app.use(app.router);
});

var server = https.createServer(option , app).listen(PORT, HOST);
console.log('Collab Server is running on %s:%s',HOST,PORT);

app.get('/fava/:id' , function(req, res){
    res.type(' application/json');
    if(req.params.id > 5)
        res.json('id maggiore di 5');
    else
        res.json('id minore uguale a 5');
    
    console.log('somebody get something by the way');
});
