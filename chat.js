/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

var rooms = []; //array of all rooms (identified by travel ID)


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
                var clientsList = io.sockets.clients(rooms[index]);
                //list of current users on the room for update chat users status
                var clientsOnLine = [];
                clientsList.forEach(function(client) {
                    clientsOnLine.push({id: client.nickname});
                });
                getUsersLocation(connection, eventLog, clientsOnLine, data.travelId, function(array) {
                    if (array !== null) {
                        io.sockets.in(rooms[index]).emit('clientList', {result: 'OK', list: array});
                        return;
                    }
                    io.sockets.in(rooms[index].emit('clientList', {result: 'DATABASE_ERROR'}));
                });
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

function getUsersLocation(connection, eventLog, clients, idTrip, callback) {
    var query = 'SELECT id, name, longitude, latitude, address FROM user WHERE user.id IN (SELECT id_user FROM user_trip WHERE id_trip = ' + connection.escape(idTrip) + ')';
    connection.query(query, function(err, rows) {
        if (err) {
            eventLog('error on getting users coordinates on travel ID: ' + idTrip);
            callback(null);
            return;
        }
        var adminQuery = 'SELECT user.id, user.name, longitude, latitude, address FROM user, trip WHERE user.id =  trip.id_admin AND trip.id = ' + connection.escape(idTrip);
        connection.query(adminQuery, function(err, row) {
            if (err) {
                eventLog('error on getting administrator coordinates on travel ID: ' + idTrip);
                callback(null);
                return;
            }
            row[0].isAdmin = true;
            var totalResult = rows.concat(row);
            totalResult.forEach(function(item) {
                item.longitude = (item.longitude === null ? 'unknown' : item.longitude);
                item.latitude = (item.latitude === null ? 'unknown' : item.latitude);
            });
            totalResult.forEach(function(row) {
                clients.forEach(function(chatClient) {
                    if (row.id === chatClient.id) {
                        row.onLine = true;
                    }
                });
            });
            //eventLog(JSON.stringify(totalResult));
            callback(totalResult);
        });
    });
}

module.exports.chatHandler = chatHandler;