/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
function sendTravelList(req, res, connection, eventLog) {
    var id = req.headers.id;
    var ip = req.connection.remoteAddress;
    var resultSet = [];
    var query = 'SELECT trip.id, trip.name, trip.description, user.name AS user_name, user.id AS user_id FROM trip, user, user_trip WHERE trip.id = user_trip.id_trip AND user.id = user_trip.id_user AND trip.id_admin = ' + connection.escape(id);
    var options = {sql: query, nestTables: true};
    connection.query(options, function(err, result) {
        if (err) {
            res.json({type: 'list_request', result: 'DATABASE_ERROR', err: err});
            eventLog('[ Database error on travel list request from ' + ip + 'where id: ' + id + ' is admin ]');
            return;
        }
        query = 'SELECT trip.id, trip.name, trip.description, trip.id_admin, user_adm.name AS adm_name, user.name AS user_name, user.id AS user_id FROM trip, user, user_trip, user AS user_adm WHERE user_adm.id = trip.id_admin AND trip.id = user_trip.id_trip AND user.id = user_trip.id_user AND trip.id = ANY (SELECT trip.id FROM trip, user_trip WHERE user_trip.id_trip = trip.id ANd user_trip.id_user =' + id + ')';
        options.sql = query;
        connection.query(options, function(err, rows) {
            if (err) {
                res.json({type: 'list_request', result: 'DATABASE_ERROR', err: err});
                eventLog('[ Database error on travel list request from ' + ip + 'where id: ' + id + ' is a member ]');
                return;
            }
            var len;
            if ((len = result.length) > 0) {
                for (var i = 0; i < len; i++) {
                    result[i].trip.isAdmin = true;
                    resultSet.push(result[i]);
                }
            }
            if ((len = rows.length) > 0) {
                for (var i = 0; i < len; i++) {
                    resultSet.push(rows[i]);
                }
            }
            //dump(resultSet);
            res.json(orderResult(resultSet));
        });

    });

}
function orderResult(result) {
    var current; //id index of a existing travel in toReturn array 
    var id = [];//travel id array 
    var toReturn = [];
    for (var key in result) {
        if ((current = id.indexOf(result[key].trip.id)) === -1) { //if the travel is not present in toReturn
            id.push(result[key].trip.id);
            var newTrip = result[key].trip;
            if (result[key].trip.hasOwnProperty('id_admin')) { //if is a travel where the user is NOT the admin set adm_name as trip property
                newTrip.adm_name = result[key].user_adm.adm_name;
            }
            newTrip.user = [];
            newTrip.user.push(result[key].user);//{id : result[key].user.user_id , name: result[key].user.user_name})
            toReturn.push(newTrip);
        } else {
            var trip = toReturn.filter(function(v) {
                return v["id"] === id[current];
            }); //filter object with given id
            trip["0"].user.push(result[key].user);//push new user
        }
    }
    return toReturn;
}

function dump(obj) { //debug function
    console.log(JSON.stringify(obj));
}

module.exports.sendTravelList = sendTravelList;