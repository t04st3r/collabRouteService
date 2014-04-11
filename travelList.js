/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
function sendTravelUsersList(req, res, connection, eventLog) {
    var id = req.headers.id;
    var ip = req.connection.remoteAddress;
    var resultSet = [];
    var query = 'SELECT trip.id, trip.name, trip.description, user.name AS user_name, user.id AS user_id FROM trip, user, user_trip WHERE trip.id = user_trip.id_trip AND user.id = user_trip.id_user AND trip.id_admin = ' + connection.escape(id);
    var options = {sql: query, nestTables: true};
    connection.query(options, function(err, result) {
        if (err) {
            res.json({type: 'adm_list_request', result: 'DATABASE_ERROR'});
            eventLog('[ Database error on travel list request from ' + ip + 'where id: ' + id + ' is admin ]');
            return;
        }
        query = 'SELECT trip.id, trip.name, trip.description, trip.id_admin, user_adm.name AS adm_name, user.name AS user_name, user.id AS user_id FROM trip, user, user_trip, user AS user_adm WHERE user_adm.id = trip.id_admin AND trip.id = user_trip.id_trip AND user.id = user_trip.id_user AND user.id <> ' + connection.escape(id) + 'AND trip.id = ANY (SELECT trip.id FROM trip, user_trip WHERE user_trip.id_trip = trip.id ANd user_trip.id_user =' + connection.escape(id) + ')';
        options.sql = query;
        connection.query(options, function(err, rows) {
            if (err) {
                res.json({type: 'mbr_list_request', result: 'DATABASE_ERROR'});
                eventLog('[ Database error on travel list request from ' + ip + 'where id: ' + id + ' is a member ]');
                return;
            }
            var len;
            if ((len = result.length) > 0) {
                for (var i = 0; i < len; i++) {
                    resultSet.push(result[i]);
                }
            }
            if ((len = rows.length) > 0) {
                for (var i = 0; i < len; i++) {
                    resultSet.push(rows[i]);
                }
            }
            resultSet = orderResult(resultSet);
            query = 'SELECT id, email, name FROM user WHERE id <> ' + connection.escape(id);
            connection.query(query, function(err, users) {
                if (err) {
                    res.json({type: 'usr_list_request', result: 'DATABASE_ERROR'});
                    eventLog('[ Database error on user list request from ' + ip + ' id: ' + id + ' ]');
                    return;
                }
                res.json({type: "adm_mbr_list", result: "OK", array: resultSet, users: users});
            });
        });
    });
}

function orderResult(result) {
    var current; //id index of a existing travel in orderedTravels array 
    var id = [];//travel id array 
    var orderedTravels = [];
    for (var key in result) {
        if ((current = id.indexOf(result[key].trip.id)) === -1) { //if the travel is not present in orderedTravels
            id.push(result[key].trip.id);
            var newTrip = result[key].trip;
            if (result[key].trip.hasOwnProperty('id_admin')) { //if is a travel where the user is NOT the admin set adm_name as trip property
                newTrip.adm_name = result[key].user_adm.adm_name;
            }
            newTrip.user = [];
            newTrip.user.push(result[key].user);//{id : result[key].user.user_id , name: result[key].user.user_name})
            orderedTravels.push(newTrip);
        } else {
            var trip = orderedTravels.filter(function(v) {
                return v["id"] === id[current];
            }); //filter object with given id
            trip["0"].user.push(result[key].user);//push new user
        }
    }
    return orderedTravels;
}

function dump(obj) { //debug function
    console.log(JSON.stringify(obj));
}

function getRoutes(req, res, connection, eventLog) {
    var id = req.params.id;
    var ip = req.connection.remoteAddress;
    var query = 'SELECT id, address, latitude, longitude FROM route WHERE id_trip = ' + connection.escape(id);
    var options = {sql: query, nestTables: false};
    connection.query(options, function(err, result) {
        if (err) {
            res.json({type: 'routes_request', result: 'DATABASE_ERROR'});
            eventLog('[ Database error on route list request from ' + ip + 'using trip id: ' + id + ' ]');
            return;
        }
        //dump(result);
        res.json({type: "routes_list", result: "OK", array: result});
    });
}

function addNewTravel(req, res, connection, eventLog) {
    var adminId = req.headers.id;
    var ip = req.connection.remoteAddress;
    var jsonRequest = req.body;
    var travelName = jsonRequest.name;
    var travelDes = jsonRequest.description;
    var userArray = jsonRequest.users;
    lockTripTable(ip, adminId, travelName, connection, eventLog, function(returnValueLock) {
        if (!returnValueLock) {
            res.json({type: "add_new_travel", result: "DATABASE_ERROR"});
            return;
        }
        insertNewTrip(ip, adminId, travelName, travelDes, connection, eventLog, function(returnValueInsert) {
            if (!returnValueInsert) {
                res.json({type: "add_new_travel", result: "DATABASE_ERROR"});
                return;
            }
            getNewTravelId(ip, adminId, travelName, connection, eventLog, function(returnValueId, id) {
                if (!returnValueId) {
                    res.json({type: "add_new_travel", result: "DATABASE_ERROR"});
                    return;
                }
                unlockTripTable(ip, adminId, travelName, connection, eventLog, function(returnValueUnlock){
                    if (!returnValueUnlock) {
                    res.json({type: "add_new_travel", result: "DATABASE_ERROR"});
                    return;
                }
                res.json({response: "OK", id: id});
                });               
            });
        });
    });
}

function unlockTripTable(ip, id, travelName, connection, eventLog, callback){
    connection.query("UNLOCK TABLES" , function(err){
        if (err) {
            eventLog('[ Database error on unlock trip table after inserting new travel named: ' + travelName + ' done by user id: ' + id + ' ip: ' + ip + ' ]');
            callback(false);
        }
    });
}

function getNewTravelId(ip, id, travelName, connection, eventLog, callback) {
    connection.query('SELECT MAX(id) AS newId FROM trip', function(err, row) {
        if (err) {
            eventLog('[ Database error on getting brand new travel id named: ' + travelName + ' done by user id: ' + id + ' ip: ' + ip + ' ]');
            callback(false);
            connection.query("UNLOCK TABLES");
            return;
        }
        callback(true, row[0].newId);
        return;
    });
}

function lockTripTable(ip, id, travelName, connection, eventLog, callback) {
    connection.query('LOCK TABLE trip WRITE', function(err) {
        if (err) {
            eventLog('[ Database error on locking trip table on inserting new travel named: ' + travelName + ' done by user id: ' + id + ' ip: ' + ip + ' ]');
            callback(false);
            return;
        }
        callback(true);
    });
}

function insertNewTrip(ip, id, travelName, travelDes, connection, eventLog, callback) {
    var query = "INSERT INTO trip (name, id_admin, description) VALUES("
            + connection.escape(travelName) + " , " + connection.escape(id) +
            " , " + connection.escape(travelDes) + " ); ";
    connection.query(query, function(err) {
        if (err) {
            eventLog('[ Database error on inserting new travel named: ' + travelName + ' done by user id: ' + id + ' ip: ' + ip + ' ]');
            connection.query("UNLOCK TABLES");
            callback(false);
            return;
        }
        callback(true);
    });
}

module.exports.addNewTravel = addNewTravel;
module.exports.sendTravelUsersList = sendTravelUsersList;
module.exports.getRoutes = getRoutes;