/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
function sendTravelUsersList(req, res, connection, eventLog) {
    var id = req.headers.id;
    var ip = req.connection.remoteAddress;
    var resultSet = [];
    var query = 'SELECT trip.id, trip.name, trip.description, user.name AS user_name, user.id AS user_id, user.email AS user_email FROM trip, user, user_trip WHERE trip.id = user_trip.id_trip AND user.id = user_trip.id_user AND trip.id_admin = ' + connection.escape(id);
    var options = {sql: query, nestTables: true};
    connection.query(options, function(err, result) {
        if (err) {
            res.json({type: 'adm_list_request', result: 'DATABASE_ERROR'});
            eventLog('[ Database error on travel list request from ' + ip + 'where id: ' + id + ' is admin ]');
            return;
        }
        query = 'SELECT trip.id, trip.name, trip.description, trip.id_admin, user_adm.name AS adm_name, user_adm.email AS adm_mail, user.name AS user_name, user.id AS user_id, user.email AS user_email FROM trip, user, user_trip, user AS user_adm WHERE user_adm.id = trip.id_admin AND trip.id = user_trip.id_trip AND user.id = user_trip.id_user AND trip.id = ANY (SELECT user_trip.id_trip FROM user_trip WHERE user_trip.id_user = ' + connection.escape(id) + ')';
        options.sql = query;
        connection.query(options, function(err, rows) {
            if (err) {
                res.json({type: 'mbr_list_request', result: 'DATABASE_ERROR'});
                eventLog('[ Database error on travel list request from ' + ip + ' where id: ' + id + ' is a member ]');
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
            query = 'SELECT id, email, name FROM user WHERE id <> ' + connection.escape(id) + ' AND confirmed = 1';
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
    var id = []; //travel id array 
    var orderedTravels = [];
    for (var key in result) {
        if ((current = id.indexOf(result[key].trip.id)) === -1) { //if the travel is not present in orderedTravels
            id.push(result[key].trip.id);
            var newTrip = result[key].trip;
            if (result[key].trip.hasOwnProperty('id_admin')) { //if is a travel where the user is NOT the admin set adm_name as trip property
                newTrip.adm_name = result[key].user_adm.adm_name;
                newTrip.adm_mail = result[key].user_adm.adm_mail;
            }
            newTrip.user = [];
            newTrip.user.push(result[key].user); //{id : result[key].user.user_id , name: result[key].user.user_name})
            orderedTravels.push(newTrip);
        } else {
            var trip = orderedTravels.filter(function(v) {
                return v["id"] === id[current];
            }); //filter object with given id
            trip["0"].user.push(result[key].user); //push new user
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
    var query = 'SELECT id, address, latitude, longitude, id_user FROM route WHERE id_trip = ' + connection.escape(id);
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
    var transaction = connection.startTransaction();
    transaction.query('LOCK TABLE trip WRITE', function(err) {
        if (err) {
            transaction.rollback();
            eventLog('[ Database error on locking trip table for inserting new travel named: ' + travelName + ' done by user id: ' + adminId + ' ip: ' + ip + ' ]');
            res.json({type: "add_new_travel", result: "DATABASE_ERROR"});
            return;
        }
        var query = "INSERT INTO trip (name, id_admin, description) VALUES("
                + connection.escape(travelName) + " , " + connection.escape(adminId) +
                " , " + connection.escape(travelDes) + " ); ";
        transaction.query(query, function(err) {
            if (err) {
                transaction.rollback();
                eventLog('[ Database error on inserting new travel named: ' + travelName + ' done by user id: ' + adminId + ' ip: ' + ip + ' ]');
                res.json({type: "add_new_travel", result: "DATABASE_ERROR"});
                return;
            }
            transaction.query('SELECT MAX(id) AS newId FROM trip', function(err, row) {
                if (err) {
                    transaction.rollback();
                    eventLog('[ Database error on getting brand new travel id named: ' + travelName + ' done by user id: ' + adminId + ' ip: ' + ip + ' ]');
                    res.json({type: "add_new_travel", result: "DATABASE_ERROR"});
                    return;
                }
                transaction.query("UNLOCK TABLES", function(err) {
                    if (err) {
                        transaction.rollback();
                        eventLog('[ Database error on unlock trip table after inserting new travel named: ' + travelName + ' done by user id: ' + adminId + ' ip: ' + ip + ' ]');
                        res.json({type: "add_new_travel", result: "DATABASE_ERROR"});
                        return;
                    }
                    query = buildUsersMultipleInsertQuery(userArray, row[0].newId);
                    transaction.query(query, function(err) {
                        if (err) {
                            transaction.rollback();
                            eventLog('[ Database error on inserting data on user_trip table of new travel named: ' + travelName + ' done by user id: ' + adminId + ' ip: ' + ip + ' ]');
                            res.json({type: "add_new_travel", result: "DATABASE_ERROR"});
                            return;
                        }
                        transaction.commit();
                        res.json({type: "add_new_travel", result: "OK", id: row[0].newId});
                    });
                });
            });
        });
    });
    transaction.execute();
}

function buildUsersMultipleInsertQuery(array, travelId) {
    var insertQuery = "INSERT INTO user_trip (id_user,id_trip) VALUES ";
    for (var key in array) {
        if (key < array.length - 1)
            insertQuery += "(" + array[key].id + "," + travelId + "),";
        else
            insertQuery += "(" + array[key].id + "," + travelId + ");";
    }
    return insertQuery;
}

function deleteTravel(req, res, connection, eventLog) {
    var id = req.headers.id;
    var ip = req.connection.remoteAddress;
    var travelId = req.params.travelId;
    connection.query('SELECT id_admin FROM trip WHERE id = ' + connection.escape(travelId), function(err, row) {
        if (err || row.length === 0) {
            eventLog('[ Database error on check trip administrator with given id: ' + id + ' on travel id: ' + travelId + ' ip: ' + ip + ' ]');
            res.json({type: "delete_travel", result: "DATABASE_ERROR"});
            return;
        }
        if (row[0].id_admin === parseInt(id)) {
            connection.query('DELETE FROM trip WHERE id =' + connection.escape(travelId), function(err) {
                if (err) {
                    eventLog('[ Database error on delete trip id:' + travelId + ' done by trip administrator with id: ' + id + ' ip: ' + ip + ' ]');
                    res.json({type: "delete_travel", result: "DATABASE_ERROR"});
                    return;
                }
                res.json({type: "delete_travel", result: "OK"});
                return;
            });
        }
        connection.query('DELETE FROM user_trip WHERE id_user = ' + connection.escape(id) + ' AND id_trip = ' + connection.escape(travelId), function(err) {
            if (err) {
                eventLog('[ Database error on delete row on user_trip using trip id:' + travelId + ' done by user with id: ' + travelId + ' ip: ' + ip + ' ]');
                res.json({type: "delete_travel", result: "DATABASE_ERROR"});
                return;
            }
            res.json({type: "delete_travel", result: "OK"});
        });
    });
}

function addNewRoute(req, res, connection, eventLog, chat) {
    var id = req.headers.id;
    var ip = req.connection.remoteAddress;
    var jsonRequest = req.body;
    var travelId = jsonRequest.travelId;
    var routesArray = jsonRequest.routes;
    var transaction = connection.startTransaction();
    transaction.query('LOCK TABLE route WRITE', function(err) {
        if (err) {
            transaction.rollback();
            eventLog('[ Database error on locking route table for inserting new routes on travel id: ' + travelId + ' done by user id: ' + id + ' ip: ' + ip + ' ]');
            res.json({type: "add_new_routes", result: "DATABASE_ERROR"});
            return;
        }
        var query = addRouteQueryBuilder(routesArray, travelId, id, connection);
        if (query === null) {
            eventLog('[ Database error on building route insert query on travel id: ' + travelId + ' done by user id: ' + id + ' ip: ' + ip + ' ]');
            res.json({type: "add_new_routes", result: "DATABASE_ERROR"});
            return;
        }
        transaction.query(query, function(err) {
            if (err) {
                transaction.rollback();
                eventLog('[ Database error on inserting new routes on travel id: ' + travelId + ' done by user id: ' + id + ' ip: ' + ip + ' ]');
                res.json({type: "add_new_routes", result: "DATABASE_ERROR"});
                return;
            }
            transaction.query("SELECT id, longitude, latitude, id_user AS idUser, address, id_trip AS idTravel FROM route WHERE id_trip = " + connection.escape(travelId), function(err, rows) {
                if (err) {
                    transaction.rollback();
                    eventLog('[ Database error on getting routes on travel id: ' + travelId + ' done by user id: ' + id + ' ip: ' + ip + ' ]');
                    res.json({type: "add_new_routes", result: "DATABASE_ERROR"});
                    return;
                }
                transaction.query("UNLOCK TABLES", function(err) {
                    if (err) {
                        transaction.rollback();
                        eventLog('[ Database error on unlock route table after inserting new routes on travel id: ' + travelId + ' done by user id: ' + id + ' ip: ' + ip + ' ]');
                        res.json({type: "add_new_travel", result: "DATABASE_ERROR"});
                        return;
                    }
                    transaction.commit();
                    res.json({type: "add_new_routes", result: "OK"});
                    chat.sendRoutesListOnUpdate(travelId, rows);
                });
            });
        });
    });
    transaction.execute();
}

function addRouteQueryBuilder(array, travelId, userId, connection) {
    if (array.length > 0 && Array.isArray(array)) {
        var query = "INSERT INTO route (id_trip, address, latitude, longitude, id_user) VALUES ";
        for (var key in array) {
            if (key < array.length - 1) {
                query += "(" + connection.escape(travelId) + "," + connection.escape(array[key].address) + "," + connection.escape(array[key].latitude) + "," + connection.escape(array[key].longitude) + "," + connection.escape(userId) + "),";
            } else {
                query += "(" + connection.escape(travelId) + "," + connection.escape(array[key].address) + "," + connection.escape(array[key].latitude) + "," + connection.escape(array[key].longitude) + "," + connection.escape(userId) + ");";
            }
        }
        return query;
    }
    return null;
}

function deleteRoute(req, res, connection, chat, eventLog) {
    var id = req.headers.id;
    var ip = req.connection.remoteAddress;
    var travelId = req.params.travelId;
    var routeId = req.params.routeId;
    connection.query('SELECT * FROM route WHERE id_trip = ' + connection.escape(travelId) + ' AND id = ' + connection.escape(routeId), function(err, row) {
        if (err) {
            eventLog('[ Database error on check route to delete route id: ' + routeId + ' request by id: ' + id + ' on travel id: ' + travelId + ' ip: ' + ip + ' ]');
            res.json({type: "delete_route", result: "DATABASE_ERROR"});
            return;
        }
        if (row.length !== 1) {
            eventLog('[ Error route to delete not found route id: ' + routeId + ' request done by user id: ' + id + ' on travel id: ' + travelId + ' ip: ' + ip + ' ]');
            res.json({type: "delete_route", result: "ROUTE_NOT_FOUND"});
            return;
        }
        connection.query('DELETE FROM route WHERE id =' + connection.escape(routeId) + ' AND id_trip = ' + connection.escape(travelId), function(err) {
            if (err) {
                eventLog('[ Database error on delete route id:' + routeId + ' on trip id: ' + travelId + ' done by user with id: ' + travelId + ' ip: ' + ip + ' ]');
                res.json({type: "delete_route", result: "DATABASE_ERROR"});
                return;
            }
            connection.query("SELECT id, longitude, latitude, id_user AS idUser, address, id_trip AS idTravel FROM route WHERE id_trip = " + connection.escape(travelId), function(err, rows) {
                if (err) {
                    eventLog('[ Database error on getting routes on travel id: ' + travelId + ' done by user id: ' + id + ' ip: ' + ip + ' ]');
                    res.json({type: "delete_routes", result: "DATABASE_ERROR"});
                    return;
                }
                res.json({type: "delete_route", result: "OK"});
                chat.sendRoutesListOnUpdate(travelId, rows);
            });
        });
    });
}

module.exports.deleteTravel = deleteTravel;
module.exports.addNewTravel = addNewTravel;
module.exports.addNewRoute = addNewRoute;
module.exports.sendTravelUsersList = sendTravelUsersList;
module.exports.getRoutes = getRoutes;
module.exports.deleteRoute = deleteRoute;