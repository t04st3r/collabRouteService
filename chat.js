/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

var rooms = [];
var util = require('util');

function chatHandler(io, eventLog, connection) {
    io.sockets.on('connection', function(socket) {
        //eventLog(util.inspect(socket) , {showHidden : true , depth : null});
        socket.on('adduser', function(data) {
            checkData(connection, data.userId, data.travelId, function(result) {
                if (!result) {
                    eventLog(JSON.stringify(data));
                    socket.emit('disconnect');
                    socket.disconnect();
                    return;
                }
                socket.emit('message', data);
            });


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