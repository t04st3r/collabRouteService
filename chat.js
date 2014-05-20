/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
var io;
function chatHandler(ioSocket, eventLog, connection) {
    io = ioSocket;
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
                socket.join(data.travelId);
                eventLog("CLIENT " + socket.id + " IP: " + address.address + " ID: " + data.userId + " has joined travel room with ID: " + data.travelId);
              });
        });

        socket.on('text', function(data) {
            io.sockets.in(data.travelId).emit('text', {id: data.userId, text: data.text});
        });

        socket.on('update_request', function(data) {
            sendListOnUpdate(data.travelId, socket.nickname, eventLog, connection, false);
        });

        socket.on('disconnect', function() {
            var id = getTravelId(socket);
            sendListOnUpdate(id, socket.nickname, eventLog, connection, true);
            eventLog("CLIENT " + socket.id + " IP: " + socket.handshake.address.address + " ID: " + socket.nickname + " just disconnected his socket");


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

function getUsersLocation(connection, eventLog, clients, idTrip, callback) {
    var query = 'SELECT id, name, longitude, latitude, address, email FROM user WHERE user.id IN (SELECT id_user FROM user_trip WHERE id_trip = ' + connection.escape(idTrip) + ')';
    connection.query(query, function(err, rows) {
        if (err) {
            eventLog('error on getting users coordinates on travel ID: ' + idTrip);
            callback(null);
            return;
        }
        var adminQuery = 'SELECT user.id, user.name, longitude, latitude, address, email FROM user, trip WHERE user.id =  trip.id_admin AND trip.id = ' + connection.escape(idTrip);
        connection.query(adminQuery, function(err, row) {
            if (err) {
                eventLog('error on getting administrator coordinates on travel ID: ' + idTrip);
                callback(null);
                return;
            }
            var totalResult = row.concat(rows);
            totalResult.forEach(function(item) {
                item.longitude = (item.longitude === null ? '0' : item.longitude);
                item.latitude = (item.latitude === null ? '0' : item.latitude);
            });
            totalResult.forEach(function(row) {
                clients.forEach(function(chatClient) {
                    if (row.id === chatClient.id) {
                        row.onLine = true;
                    } else if (!row.hasOwnProperty('onLine')) {
                        row.onLine = false;
                    }
                });
            });
            //avoid showing coordinates and address of users not 
            // actually connected in that room/trip
            totalResult.forEach(function(row){
                if(row.onLine === false){
                    row.latitude = '0';
                    row.longitude = '0';
                    row.address = 'unknown';
                }
            });
            callback(totalResult);
        });
    });
}
function getTravelId(socket) {
    var obj = io.sockets.manager.rooms;
    var socketId = socket.id;
    var result = -1;
    for (var prop in obj) {
        if (prop !== '') {
            var array = obj[prop];
            array.forEach(function(item) {
                if (item === socketId) {
                    result = prop.substring(1);
                }
            });
        }
    }
    return result;
}
function sendListOnUpdate(travelId, userId, eventLog, connection, isDisconnecting) {
    var clientsList = io.sockets.clients(travelId);
    //list of current users on the room for update chat users status
    var clientsOnLine = [];
    clientsList.forEach(function(client) {
        if (!isDisconnecting)
            clientsOnLine.push({id: client.nickname});
        else if (client.nickname !== userId)
            clientsOnLine.push({id: client.nickname});
    });
    getUsersLocation(connection, eventLog, clientsOnLine, travelId, function(array) {
        if (array !== null) {
            io.sockets.in(travelId).emit('clientList', {result: 'OK', list: array});
            return;
        }
        io.sockets.in(travelId).emit('clientList', {result: 'DATABASE_ERROR'});
    });
}


module.exports.chatHandler = chatHandler;
module.exports.sendListOnUpdate = sendListOnUpdate;