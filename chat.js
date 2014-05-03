/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

var rooms = []; //array of all rooms (identified by travel ID)
var util = require('util');

function chatHandler(io, eventLog, connection) {
    io.set('log level', 1);
    io.sockets.on('connection', function(socket) {
        var address = socket.handshake.address;
        eventLog("CLIENT " + socket.id + " IP: " + address.address + " has just connected to the chat app");
        socket.on('adduser', function(data) {
            checkData(connection, data.userId, data.travelId, function(result) {
                if (!result) {
                    eventLog("Wrong credential for CLIENT " + socket.id + " IP: ".address.address + " it will be disconnected now!");
                    socket.emit('disconnect');
                    socket.disconnect();
                    return;
                }
                socket.nickname = data.userId;
                var index;
                //if the room has not been created yet
                if ((index = rooms.indexOf(data.travelId)) === -1) {
                    rooms.push(data.travelId);
                    index = rooms.indexOf(data.travelId);
                }
                socket.join(rooms[index]);
                eventLog("CLIENT " + socket.id + " IP: " + address.address + " ID: " + data.userId + " has joined travel room with ID: " + rooms[index]);
                var clientList = io.sockets.clients(rooms[index]);
                //list of current users on the room for update chat users status
                var clientListToSend = [];
                clientList.forEach(function(client) {
                    clientListToSend.push({id: client.nickname});
                });
                io.sockets.in(rooms[index]).emit('clientList', clientListToSend);
            });
        });
        socket.on('text', function(data) {
            io.sockets.in(data.travelId).emit('text', {id: data.userId, text: data.text});
        });
        socket.on('disconnect', function() {
            var address = socket.handshake.address;
            eventLog("CLIENT " + socket.id + " IP: " + address.address + " just disconnected his socket");
            //TODO update client list
        });
    });
}

function checkData(connection, idUser, idTrip, callback) {
    var isMember = false, isAdmin = false;
    connection.query('SELECT * FROM user_trip WHERE id_user = ' + connection.escape(idUser) + ' AND id_trip = ' + connection.escape(idTrip), function(err, result) {
        if (!err && result.length === 1) {
            isMember = true;
        }
        connection.query('SELECT id FROM trip WHERE id = ' + connection.escape(idTrip) + ' AND id_admin = ' + connection.escape(idUser), function(error, result2) {
            if (!error && result2.length === 1) {
                isAdmin = true;
            }
            callback(isMember || isAdmin);
        });
    });
}

module.exports.chatHandler = chatHandler;