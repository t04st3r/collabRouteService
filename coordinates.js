/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

function updateCoordinates(req, res, connection, eventLog) {
    var id = req.headers.id;
    var jsonRequest = req.body;
    var longitude = jsonRequest.longitude;
    var latitude = jsonRequest.latitude;
    if(!validateLatLong(latitude, longitude)){
        res.json({type : "update_coordinates" , result : "WRONG_COORDINATES"});
        return;
    }
    connection.query('UPDATE user SET longitude = ' + connection.escape(longitude) +
            ', latitude = ' + connection.escape(latitude) + 
            ' WHERE id = ' + connection.escape(id), function(err){
                if(err){
                    eventLog('[  Error on update coordinates for user id: '+id+
                            ' latitude: '+latitude+' longitude: '+longitude+' ]');
                    res.json({type : "update_coordinates" , result : "DATABASE_ERROR"});
                    return;
                }
                res.json({type : "update_coordinates" , result : "OK"});
            });
}

function validateLatLong(lat, long){
    if(isNaN(lat) || isNaN(long))
        return false;
    if(lat < -90 || lat > 90)
        return false;
    if(long < -180 || long > 180)
        return false;
return true;
}

module.exports.updateCoordinates = updateCoordinates;